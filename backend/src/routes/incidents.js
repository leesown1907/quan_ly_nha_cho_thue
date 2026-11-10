import { Router } from 'express';
import { query } from '../db/index.js';
import { authenticate, adminOnly, tenantOnly } from '../middleware/auth.js';
import { HttpError, requireFields, str, oneOf, where, tenantIdOf } from '../utils/http.js';
import { notifyAdmins, notifyUser } from '../utils/notify.js';

const r = Router();
r.use(authenticate);

const STATUS_LABEL = { pending: 'Chờ tiếp nhận', in_progress: 'Đang xử lý', resolved: 'Đã xử lý xong', rejected: 'Từ chối' };
const CATEGORIES = ['electric', 'water', 'furniture', 'internet', 'security', 'other'];

const INCIDENT_SELECT = `
  SELECT i.*, r.code AS room_code, t.full_name AS tenant_name, t.phone AS tenant_phone
  FROM incidents i
  JOIN rooms r ON r.id = i.room_id
  LEFT JOIN tenants t ON t.id = i.tenant_id`;

// FR29, FR30 - Danh sách sự cố
r.get('/', async (req, res) => {
  const w = where();
  const { status, priority, search } = req.query;
  if (req.user.role === 'tenant') w.add((p) => `i.tenant_id = ${p}`, tenantIdOf(req));
  if (status) w.add((p) => `i.status = ${p}`, status);
  if (priority) w.add((p) => `i.priority = ${p}`, priority);
  if (search) w.add((p) => `(i.title ILIKE ${p} OR r.code ILIKE ${p} OR t.full_name ILIKE ${p})`, `%${search}%`);
  const { rows } = await query(
    `${INCIDENT_SELECT} ${w.sql()}
     ORDER BY CASE i.status WHEN 'pending' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END,
              CASE i.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, i.created_at DESC`,
    w.params,
  );
  res.json(rows);
});

// FR28 - Người thuê gửi báo cáo sự cố
r.post('/', tenantOnly, async (req, res) => {
  const b = req.body || {};
  requireFields(b, { title: 'Tiêu đề', description: 'Mô tả sự cố' });
  const tenantId = tenantIdOf(req);
  const contracts = await query(
    `SELECT c.room_id, r.code FROM contracts c JOIN rooms r ON r.id = c.room_id
     WHERE c.tenant_id = $1 AND c.status = 'active'`,
    [tenantId],
  );
  if (!contracts.rows.length) throw new HttpError(409, 'Bạn không có hợp đồng thuê đang hiệu lực');
  const room = b.room_id
    ? contracts.rows.find((c) => c.room_id === Number(b.room_id))
    : contracts.rows[0];
  if (!room) throw new HttpError(403, 'Bạn không thuê phòng này');

  const category = CATEGORIES.includes(b.category) ? b.category : 'other';
  const priority = oneOf(b.priority || 'medium', ['low', 'medium', 'high'], 'Mức độ');
  const { rows } = await query(
    `INSERT INTO incidents (room_id, tenant_id, reported_by, title, description, category, priority)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [room.room_id, tenantId, req.user.id, str(b.title), str(b.description), category, priority],
  );
  // FR32 - Thông báo cho chủ nhà
  await notifyAdmins({
    title: `Sự cố mới tại phòng ${room.code}`,
    message: `${req.user.full_name}: ${str(b.title)}`,
    type: 'incident',
    link: '/incidents',
  });
  const created = await query(`${INCIDENT_SELECT} WHERE i.id = $1`, [rows[0].id]);
  res.status(201).json(created.rows[0]);
});

// FR29 - Chủ nhà cập nhật trạng thái xử lý
r.put('/:id', adminOnly, async (req, res) => {
  const id = Number(req.params.id);
  const status = oneOf(req.body?.status, Object.keys(STATUS_LABEL), 'Trạng thái');
  const { rows } = await query(
    `UPDATE incidents SET status = $1, admin_note = $2, updated_at = NOW(),
            resolved_at = CASE WHEN $1 = 'resolved' THEN NOW() ELSE NULL END
     WHERE id = $3 RETURNING *`,
    [status, str(req.body?.admin_note), id],
  );
  const inc = rows[0];
  if (!inc) throw new HttpError(404, 'Không tìm thấy sự cố');
  // FR32 - Thông báo cho người thuê
  await notifyUser(inc.reported_by, {
    title: `Sự cố "${inc.title}": ${STATUS_LABEL[status]}`,
    message: inc.admin_note || null,
    type: 'incident',
    link: '/incidents',
  });
  const updated = await query(`${INCIDENT_SELECT} WHERE i.id = $1`, [id]);
  res.json(updated.rows[0]);
});

// Người thuê hủy báo cáo khi chưa được tiếp nhận
r.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { rows } = await query('SELECT * FROM incidents WHERE id = $1', [id]);
  const inc = rows[0];
  if (!inc) throw new HttpError(404, 'Không tìm thấy sự cố');
  if (req.user.role === 'tenant') {
    if (inc.tenant_id !== tenantIdOf(req)) throw new HttpError(403, 'Bạn không có quyền xóa báo cáo này');
    if (inc.status !== 'pending') throw new HttpError(409, 'Chỉ có thể hủy báo cáo đang chờ tiếp nhận');
  }
  await query('DELETE FROM incidents WHERE id = $1', [id]);
  res.json({ message: 'Đã xóa báo cáo sự cố' });
});

export default r;
