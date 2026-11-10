import { Router } from 'express';
import { query, transaction } from '../db/index.js';
import { authenticate, adminOnly } from '../middleware/auth.js';
import { HttpError, requireFields, num, str, where, isDate, tenantIdOf, todayStr } from '../utils/http.js';
import { notifyTenant } from '../utils/notify.js';

const r = Router();
r.use(authenticate);

const CONTRACT_SELECT = `
  SELECT c.*, r.code AS room_code, r.area AS room_area, r.floor AS room_floor,
         t.full_name AS tenant_name, t.phone AS tenant_phone, t.id_card AS tenant_id_card,
         (c.end_date - CURRENT_DATE) AS days_left
  FROM contracts c
  JOIN rooms r ON r.id = c.room_id
  JOIN tenants t ON t.id = c.tenant_id`;

// FR16, FR25 - Danh sách / tìm kiếm hợp đồng
r.get('/', async (req, res) => {
  const w = where();
  const { search, status, expiring } = req.query;
  if (req.user.role === 'tenant') w.add((p) => `c.tenant_id = ${p}`, tenantIdOf(req));
  if (search) w.add((p) => `(c.code ILIKE ${p} OR r.code ILIKE ${p} OR t.full_name ILIKE ${p} OR t.phone ILIKE ${p})`, `%${search}%`);
  if (status) w.add((p) => `c.status = ${p}`, status);
  if (expiring) w.raw(`c.status = 'active' AND c.end_date <= CURRENT_DATE + 30`);
  const { rows } = await query(`${CONTRACT_SELECT} ${w.sql()} ORDER BY c.status, c.start_date DESC`, w.params);
  res.json(rows);
});

async function getContract(id) {
  const { rows } = await query(`${CONTRACT_SELECT} WHERE c.id = $1`, [id]);
  if (!rows[0]) throw new HttpError(404, 'Không tìm thấy hợp đồng');
  return rows[0];
}

r.get('/:id', async (req, res) => {
  const c = await getContract(Number(req.params.id));
  if (req.user.role === 'tenant' && c.tenant_id !== tenantIdOf(req)) {
    throw new HttpError(403, 'Bạn không có quyền xem hợp đồng này');
  }
  res.json(c);
});

// FR13 - Lập hợp đồng mới (tự động chuyển phòng sang "Đang cho thuê")
r.post('/', adminOnly, async (req, res) => {
  const b = req.body || {};
  requireFields(b, { room_id: 'Phòng', tenant_id: 'Người thuê', start_date: 'Ngày bắt đầu', end_date: 'Ngày kết thúc' });
  if (!isDate(b.start_date) || !isDate(b.end_date)) throw new HttpError(400, 'Ngày không hợp lệ');
  if (b.end_date <= b.start_date) throw new HttpError(400, 'Ngày kết thúc phải sau ngày bắt đầu');

  const id = await transaction(async (tx) => {
    const room = (await tx.query('SELECT * FROM rooms WHERE id = $1 FOR UPDATE', [Number(b.room_id)])).rows[0];
    if (!room) throw new HttpError(404, 'Không tìm thấy phòng');
    if (room.status !== 'available') throw new HttpError(409, `Phòng ${room.code} không ở trạng thái trống`);
    const tenant = (await tx.query('SELECT * FROM tenants WHERE id = $1', [Number(b.tenant_id)])).rows[0];
    if (!tenant) throw new HttpError(404, 'Không tìm thấy người thuê');

    const occupants = num(b.occupants ?? 1, 'Số người ở', { min: 1, max: room.max_occupants });
    const monthlyRent = num(b.monthly_rent ?? room.base_price, 'Giá thuê', { min: 0 });
    const deposit = num(b.deposit ?? 0, 'Tiền cọc', { min: 0 });
    const paymentDay = num(b.payment_day ?? 5, 'Ngày thanh toán', { min: 1, max: 28 });

    const { rows } = await tx.query(
      `INSERT INTO contracts (room_id, tenant_id, start_date, end_date, monthly_rent, deposit, payment_day, occupants, terms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [room.id, tenant.id, b.start_date, b.end_date, monthlyRent, deposit, paymentDay, occupants, str(b.terms)],
    );
    const cid = rows[0].id;
    await tx.query(
      `UPDATE contracts SET code = 'HD' || to_char(start_date, 'YYYY') || '-' || lpad(id::text, 4, '0') WHERE id = $1`,
      [cid],
    );
    await tx.query("UPDATE rooms SET status = 'occupied' WHERE id = $1", [room.id]);
    await tx.query("UPDATE tenants SET status = 'active' WHERE id = $1", [tenant.id]);
    await notifyTenant(tenant.id, {
      title: `Hợp đồng thuê phòng ${room.code} đã được lập`,
      message: `Thời hạn từ ${b.start_date} đến ${b.end_date}. Giá thuê ${monthlyRent.toLocaleString('vi-VN')} đ/tháng.`,
      type: 'contract',
      link: '/my-room',
    }, tx);
    return cid;
  });
  res.status(201).json(await getContract(id));
});

// FR14 - Cập nhật điều khoản hợp đồng
r.put('/:id', adminOnly, async (req, res) => {
  const id = Number(req.params.id);
  const b = req.body || {};
  const c = await getContract(id);
  if (c.status !== 'active') throw new HttpError(409, 'Chỉ có thể sửa hợp đồng đang hiệu lực');
  const endDate = b.end_date || c.end_date;
  if (!isDate(endDate) || endDate <= c.start_date) throw new HttpError(400, 'Ngày kết thúc phải sau ngày bắt đầu');

  await query(
    `UPDATE contracts SET end_date = $1, monthly_rent = $2, deposit = $3, payment_day = $4, occupants = $5, terms = $6
     WHERE id = $7`,
    [
      endDate,
      num(b.monthly_rent ?? c.monthly_rent, 'Giá thuê', { min: 0 }),
      num(b.deposit ?? c.deposit, 'Tiền cọc', { min: 0 }),
      num(b.payment_day ?? c.payment_day, 'Ngày thanh toán', { min: 1, max: 28 }),
      num(b.occupants ?? c.occupants, 'Số người ở', { min: 1 }),
      b.terms !== undefined ? str(b.terms) : c.terms,
      id,
    ],
  );
  await notifyTenant(c.tenant_id, {
    title: `Hợp đồng ${c.code} đã được cập nhật`,
    message: 'Chủ nhà vừa cập nhật điều khoản hợp đồng thuê phòng của bạn.',
    type: 'contract',
    link: '/my-room',
  });
  res.json(await getContract(id));
});

// FR14 - Gia hạn hợp đồng
r.post('/:id/extend', adminOnly, async (req, res) => {
  const id = Number(req.params.id);
  const c = await getContract(id);
  const { end_date } = req.body || {};
  if (c.status !== 'active') throw new HttpError(409, 'Chỉ có thể gia hạn hợp đồng đang hiệu lực');
  if (!isDate(end_date) || end_date <= c.end_date) throw new HttpError(400, 'Ngày gia hạn phải sau ngày kết thúc hiện tại');
  const rent = req.body.monthly_rent !== undefined && req.body.monthly_rent !== ''
    ? num(req.body.monthly_rent, 'Giá thuê', { min: 0 })
    : c.monthly_rent;
  await query('UPDATE contracts SET end_date = $1, monthly_rent = $2 WHERE id = $3', [end_date, rent, id]);
  await notifyTenant(c.tenant_id, {
    title: `Hợp đồng ${c.code} đã được gia hạn`,
    message: `Thời hạn mới đến ngày ${end_date}.`,
    type: 'contract',
    link: '/my-room',
  });
  res.json(await getContract(id));
});

// FR15 - Kết thúc / thanh lý hợp đồng (tự động chuyển phòng về "Trống")
r.post('/:id/terminate', adminOnly, async (req, res) => {
  const id = Number(req.params.id);
  const endedAt = req.body?.ended_at || todayStr();
  if (!isDate(endedAt)) throw new HttpError(400, 'Ngày kết thúc không hợp lệ');

  await transaction(async (tx) => {
    const c = (await tx.query('SELECT c.*, r.code AS room_code FROM contracts c JOIN rooms r ON r.id = c.room_id WHERE c.id = $1 FOR UPDATE OF c', [id])).rows[0];
    if (!c) throw new HttpError(404, 'Không tìm thấy hợp đồng');
    if (c.status !== 'active') throw new HttpError(409, 'Hợp đồng đã kết thúc trước đó');
    await tx.query("UPDATE contracts SET status = 'ended', ended_at = $1, end_reason = $2 WHERE id = $3", [
      endedAt, str(req.body?.end_reason), id,
    ]);
    await tx.query("UPDATE rooms SET status = 'available' WHERE id = $1", [c.room_id]);
    const other = await tx.query("SELECT 1 FROM contracts WHERE tenant_id = $1 AND status = 'active'", [c.tenant_id]);
    if (!other.rows.length) await tx.query("UPDATE tenants SET status = 'moved_out' WHERE id = $1", [c.tenant_id]);
    await notifyTenant(c.tenant_id, {
      title: `Hợp đồng ${c.code} đã kết thúc`,
      message: `Hợp đồng thuê phòng ${c.room_code} đã được thanh lý ngày ${endedAt}.`,
      type: 'contract',
      link: '/my-room',
    }, tx);
  });
  res.json(await getContract(id));
});

export default r;
