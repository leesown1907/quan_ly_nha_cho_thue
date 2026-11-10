import { Router } from 'express';
import { query } from '../db/index.js';
import { authenticate, adminOnly } from '../middleware/auth.js';
import { HttpError, requireFields, num, str, oneOf, where, tenantIdOf } from '../utils/http.js';

const r = Router();
r.use(authenticate);

const ROOM_SELECT = `
  SELECT r.*, c.id AS contract_id, c.code AS contract_code, c.end_date AS contract_end_date,
         c.occupants, t.id AS tenant_id, t.full_name AS tenant_name, t.phone AS tenant_phone
  FROM rooms r
  LEFT JOIN contracts c ON c.room_id = r.id AND c.status = 'active'
  LEFT JOIN tenants t ON t.id = c.tenant_id`;

// FR09, FR25 - Danh sách / tìm kiếm phòng
r.get('/', async (req, res) => {
  const w = where();
  const { search, status, floor } = req.query;
  if (req.user.role === 'tenant') {
    w.add((p) => `r.id IN (SELECT room_id FROM contracts WHERE tenant_id = ${p} AND status = 'active')`, tenantIdOf(req));
  }
  if (search) w.add((p) => `(r.code ILIKE ${p} OR r.description ILIKE ${p} OR t.full_name ILIKE ${p})`, `%${search}%`);
  if (status) w.add((p) => `r.status = ${p}`, status);
  if (floor) w.add((p) => `r.floor = ${p}`, Number(floor));
  const { rows } = await query(`${ROOM_SELECT} ${w.sql()} ORDER BY r.floor, r.code`, w.params);
  res.json(rows);
});

r.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { rows } = await query(`${ROOM_SELECT} WHERE r.id = $1`, [id]);
  const room = rows[0];
  if (!room) throw new HttpError(404, 'Không tìm thấy phòng');

  if (req.user.role === 'tenant') {
    const ok = await query('SELECT 1 FROM contracts WHERE room_id = $1 AND tenant_id = $2', [id, tenantIdOf(req)]);
    if (!ok.rows.length) throw new HttpError(403, 'Bạn không có quyền xem phòng này');
    return res.json(room);
  }
  const history = await query(
    `SELECT c.id, c.code, c.start_date, c.end_date, c.ended_at, c.status, c.monthly_rent, t.full_name AS tenant_name
     FROM contracts c JOIN tenants t ON t.id = c.tenant_id WHERE c.room_id = $1 ORDER BY c.start_date DESC`,
    [id],
  );
  res.json({ ...room, contracts: history.rows });
});

function parseRoom(b) {
  requireFields(b, { code: 'Mã phòng', area: 'Diện tích', base_price: 'Giá thuê' });
  return {
    code: String(b.code).trim().toUpperCase(),
    floor: num(b.floor ?? 1, 'Tầng', { min: 0, max: 100 }),
    area: num(b.area, 'Diện tích', { min: 1, int: false }),
    base_price: num(b.base_price, 'Giá thuê', { min: 0 }),
    max_occupants: num(b.max_occupants ?? 2, 'Số người tối đa', { min: 1, max: 20 }),
    description: str(b.description),
  };
}

// FR05 - Thêm phòng
r.post('/', adminOnly, async (req, res) => {
  const room = parseRoom(req.body || {});
  const status = req.body.status === 'maintenance' ? 'maintenance' : 'available';
  const { rows } = await query(
    `INSERT INTO rooms (code, floor, area, base_price, max_occupants, description, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [room.code, room.floor, room.area, room.base_price, room.max_occupants, room.description, status],
  );
  res.status(201).json(rows[0]);
});

// FR05, FR06 - Sửa phòng / trạng thái
r.put('/:id', adminOnly, async (req, res) => {
  const id = Number(req.params.id);
  const room = parseRoom(req.body || {});
  const status = oneOf(req.body.status || 'available', ['available', 'occupied', 'maintenance'], 'Trạng thái');

  const active = await query("SELECT id FROM contracts WHERE room_id = $1 AND status = 'active'", [id]);
  if (active.rows.length && status !== 'occupied') {
    throw new HttpError(409, 'Phòng đang có hợp đồng hiệu lực, không thể đổi trạng thái. Hãy kết thúc hợp đồng trước.');
  }
  if (!active.rows.length && status === 'occupied') {
    throw new HttpError(400, 'Phòng chỉ chuyển sang "Đang cho thuê" khi lập hợp đồng');
  }
  const { rows } = await query(
    `UPDATE rooms SET code = $1, floor = $2, area = $3, base_price = $4, max_occupants = $5,
            description = $6, status = $7 WHERE id = $8 RETURNING *`,
    [room.code, room.floor, room.area, room.base_price, room.max_occupants, room.description, status, id],
  );
  if (!rows[0]) throw new HttpError(404, 'Không tìm thấy phòng');
  res.json(rows[0]);
});

// FR08 - Xóa phòng (chỉ khi trống, không có hợp đồng)
r.delete('/:id', adminOnly, async (req, res) => {
  const id = Number(req.params.id);
  const { rows } = await query('SELECT * FROM rooms WHERE id = $1', [id]);
  if (!rows[0]) throw new HttpError(404, 'Không tìm thấy phòng');
  if (rows[0].status === 'occupied') throw new HttpError(409, 'Phòng đang cho thuê, không thể xóa');
  const used = await query('SELECT COUNT(*)::int AS n FROM contracts WHERE room_id = $1', [id]);
  if (used.rows[0].n > 0) {
    throw new HttpError(409, 'Phòng đã có lịch sử hợp đồng/hóa đơn nên không thể xóa (để bảo toàn dữ liệu)');
  }
  await query('DELETE FROM rooms WHERE id = $1', [id]);
  res.json({ message: 'Đã xóa phòng' });
});

export default r;
