import { Router } from 'express';
import { query } from '../db/index.js';
import { authenticate, adminOnly } from '../middleware/auth.js';
import { HttpError, num, where, isPeriod, tenantIdOf, periodLabel } from '../utils/http.js';
import { notifyUser } from '../utils/notify.js';
import { getSettings } from '../services/invoiceService.js';

const r = Router();
r.use(authenticate);

const READING_SELECT = `
  SELECT ur.*, r.code AS room_code,
         (ur.elec_new - ur.elec_old) AS elec_usage,
         (ur.water_new - ur.water_old) AS water_usage,
         (ur.elec_new - ur.elec_old) * ur.elec_price AS elec_amount,
         (ur.water_new - ur.water_old) * ur.water_price AS water_amount,
         EXISTS (SELECT 1 FROM invoices i WHERE i.room_id = ur.room_id AND i.period = ur.period) AS invoiced
  FROM utility_readings ur JOIN rooms r ON r.id = ur.room_id`;

// FR18, FR20 - Danh sách chỉ số điện nước
r.get('/', async (req, res) => {
  const w = where();
  const { period, room_id, search } = req.query;
  if (req.user.role === 'tenant') {
    w.add((p) => `EXISTS (SELECT 1 FROM contracts c WHERE c.tenant_id = ${p} AND c.room_id = ur.room_id
      AND ur.period >= to_char(c.start_date, 'YYYY-MM')
      AND ur.period <= to_char(COALESCE(c.ended_at, GREATEST(c.end_date, CURRENT_DATE)), 'YYYY-MM'))`, tenantIdOf(req));
  }
  if (period) w.add((p) => `ur.period = ${p}`, period);
  if (room_id) w.add((p) => `ur.room_id = ${p}`, Number(room_id));
  if (search) w.add((p) => `r.code ILIKE ${p}`, `%${search}%`);
  const { rows } = await query(`${READING_SELECT} ${w.sql()} ORDER BY ur.period DESC, r.code`, w.params);
  res.json(rows);
});

// Bảng ghi chỉ số theo kỳ: liệt kê các phòng kèm chỉ số cũ (lấy từ kỳ trước)
r.get('/sheet', adminOnly, async (req, res) => {
  const { period } = req.query;
  if (!isPeriod(period)) throw new HttpError(400, 'Kỳ không hợp lệ (YYYY-MM)');
  const { rows } = await query(
    `SELECT r.id AS room_id, r.code AS room_code, r.status, t.full_name AS tenant_name,
            cur.id AS reading_id, cur.elec_old, cur.elec_new, cur.water_old, cur.water_new,
            prev.elec_new AS prev_elec, prev.water_new AS prev_water, prev.period AS prev_period,
            EXISTS (SELECT 1 FROM invoices i WHERE i.room_id = r.id AND i.period = $1) AS invoiced
     FROM rooms r
     LEFT JOIN contracts c ON c.room_id = r.id AND c.status = 'active'
     LEFT JOIN tenants t ON t.id = c.tenant_id
     LEFT JOIN utility_readings cur ON cur.room_id = r.id AND cur.period = $1
     LEFT JOIN LATERAL (
       SELECT * FROM utility_readings p WHERE p.room_id = r.id AND p.period < $1 ORDER BY p.period DESC LIMIT 1
     ) prev ON TRUE
     ORDER BY (r.status = 'occupied') DESC, r.code`,
    [period],
  );
  res.json({ period, ...(await getSettings({ query })), rooms: rows });
});

// FR18 - Nhập / cập nhật chỉ số điện nước (tính theo đơn giá hiện hành)
r.post('/', adminOnly, async (req, res) => {
  const b = req.body || {};
  if (!isPeriod(b.period)) throw new HttpError(400, 'Kỳ không hợp lệ (YYYY-MM)');
  const roomId = num(b.room_id, 'Phòng', { min: 1 });
  const elecOld = num(b.elec_old, 'Chỉ số điện cũ');
  const elecNew = num(b.elec_new, 'Chỉ số điện mới');
  const waterOld = num(b.water_old, 'Chỉ số nước cũ');
  const waterNew = num(b.water_new, 'Chỉ số nước mới');
  if (elecNew < elecOld) throw new HttpError(400, 'Chỉ số điện mới phải lớn hơn hoặc bằng chỉ số cũ');
  if (waterNew < waterOld) throw new HttpError(400, 'Chỉ số nước mới phải lớn hơn hoặc bằng chỉ số cũ');

  const inv = await query('SELECT 1 FROM invoices WHERE room_id = $1 AND period = $2', [roomId, b.period]);
  if (inv.rows.length) {
    throw new HttpError(409, 'Kỳ này đã lập hóa đơn. Hãy xóa hóa đơn trước khi sửa chỉ số.');
  }
  const s = await getSettings({ query });
  const { rows } = await query(
    `INSERT INTO utility_readings (room_id, period, elec_old, elec_new, water_old, water_new, elec_price, water_price)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (room_id, period) DO UPDATE SET
       elec_old = EXCLUDED.elec_old, elec_new = EXCLUDED.elec_new,
       water_old = EXCLUDED.water_old, water_new = EXCLUDED.water_new,
       elec_price = EXCLUDED.elec_price, water_price = EXCLUDED.water_price, recorded_at = NOW()
     RETURNING id`,
    [roomId, b.period, elecOld, elecNew, waterOld, waterNew, s.electricity_price, s.water_price],
  );
  const reading = (await query(`${READING_SELECT} WHERE ur.id = $1`, [rows[0].id])).rows[0];

  // Thông báo cho người thuê phòng
  const t = await query(
    `SELECT t.user_id FROM contracts c JOIN tenants t ON t.id = c.tenant_id WHERE c.room_id = $1 AND c.status = 'active'`,
    [roomId],
  );
  if (t.rows[0]?.user_id) {
    await notifyUser(t.rows[0].user_id, {
      title: `Chỉ số điện nước tháng ${periodLabel(b.period)}`,
      message: `Điện: ${reading.elec_usage} kWh (${Number(reading.elec_amount).toLocaleString('vi-VN')} đ), nước: ${reading.water_usage} m³ (${Number(reading.water_amount).toLocaleString('vi-VN')} đ).`,
      type: 'fee',
      link: '/readings',
    });
  }
  res.status(201).json(reading);
});

r.delete('/:id', adminOnly, async (req, res) => {
  const id = Number(req.params.id);
  const { rows } = await query(`${READING_SELECT} WHERE ur.id = $1`, [id]);
  if (!rows[0]) throw new HttpError(404, 'Không tìm thấy bản ghi');
  if (rows[0].invoiced) throw new HttpError(409, 'Kỳ này đã lập hóa đơn, không thể xóa chỉ số');
  await query('DELETE FROM utility_readings WHERE id = $1', [id]);
  res.json({ message: 'Đã xóa chỉ số' });
});

export default r;
