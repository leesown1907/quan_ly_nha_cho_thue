import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query, transaction } from '../db/index.js';
import { authenticate, adminOnly } from '../middleware/auth.js';
import { HttpError, requireFields, str, where, isDate, tenantIdOf } from '../utils/http.js';

const r = Router();
r.use(authenticate);

const TENANT_SELECT = `
  SELECT t.*, u.username, u.is_active AS account_active,
         c.id AS contract_id, c.code AS contract_code, rm.id AS room_id, rm.code AS room_code
  FROM tenants t
  LEFT JOIN users u ON u.id = t.user_id
  LEFT JOIN contracts c ON c.tenant_id = t.id AND c.status = 'active'
  LEFT JOIN rooms rm ON rm.id = c.room_id`;

// US12 - Người thuê xem hồ sơ của mình
r.get('/me', async (req, res) => {
  const { rows } = await query(`${TENANT_SELECT} WHERE t.id = $1`, [tenantIdOf(req)]);
  res.json(rows[0] || null);
});

// FR12, FR25 - Danh sách / tìm kiếm người thuê
r.get('/', adminOnly, async (req, res) => {
  const w = where();
  const { search, status } = req.query;
  if (search) {
    w.add((p) => `(t.full_name ILIKE ${p} OR t.phone ILIKE ${p} OR t.id_card ILIKE ${p} OR rm.code ILIKE ${p})`, `%${search}%`);
  }
  if (status) w.add((p) => `t.status = ${p}`, status);
  const { rows } = await query(`${TENANT_SELECT} ${w.sql()} ORDER BY t.status, t.full_name`, w.params);
  res.json(rows);
});

r.get('/:id', adminOnly, async (req, res) => {
  const id = Number(req.params.id);
  const { rows } = await query(`${TENANT_SELECT} WHERE t.id = $1`, [id]);
  if (!rows[0]) throw new HttpError(404, 'Không tìm thấy người thuê');
  const contracts = await query(
    `SELECT c.id, c.code, c.start_date, c.end_date, c.ended_at, c.status, c.monthly_rent, r.code AS room_code
     FROM contracts c JOIN rooms r ON r.id = c.room_id WHERE c.tenant_id = $1 ORDER BY c.start_date DESC`,
    [id],
  );
  res.json({ ...rows[0], contracts: contracts.rows });
});

function parseTenant(b) {
  requireFields(b, { full_name: 'Họ tên', phone: 'Số điện thoại' });
  if (!/^[0-9+\s.-]{8,15}$/.test(String(b.phone).trim())) throw new HttpError(400, 'Số điện thoại không hợp lệ');
  if (b.email && !/^\S+@\S+\.\S+$/.test(b.email)) throw new HttpError(400, 'Email không hợp lệ');
  if (b.birth_date && !isDate(b.birth_date)) throw new HttpError(400, 'Ngày sinh không hợp lệ');
  return [
    str(b.full_name), str(b.phone), str(b.email), str(b.id_card), str(b.birth_date),
    str(b.gender), str(b.hometown), str(b.occupation), str(b.note),
  ];
}

// FR10 + FR03 - Thêm người thuê (tùy chọn cấp tài khoản)
r.post('/', adminOnly, async (req, res) => {
  const b = req.body || {};
  const values = parseTenant(b);
  const account = b.create_account ? { username: str(b.username), password: b.password } : null;
  if (account) {
    if (!account.username || !/^[a-zA-Z0-9_.]{3,50}$/.test(account.username)) {
      throw new HttpError(400, 'Tên đăng nhập 3-50 ký tự, chỉ gồm chữ, số, dấu chấm hoặc gạch dưới');
    }
    if (!account.password || String(account.password).length < 6) {
      throw new HttpError(400, 'Mật khẩu phải có ít nhất 6 ký tự');
    }
  }

  const id = await transaction(async (tx) => {
    let userId = null;
    if (account) {
      const exists = await tx.query('SELECT 1 FROM users WHERE LOWER(username) = LOWER($1)', [account.username]);
      if (exists.rows.length) throw new HttpError(409, 'Tên đăng nhập đã tồn tại');
      const hash = await bcrypt.hash(String(account.password), 10);
      const u = await tx.query(
        `INSERT INTO users (username, password_hash, full_name, phone, email, role)
         VALUES ($1, $2, $3, $4, $5, 'tenant') RETURNING id`,
        [account.username, hash, values[0], values[1], values[2]],
      );
      userId = u.rows[0].id;
    }
    const t = await tx.query(
      `INSERT INTO tenants (full_name, phone, email, id_card, birth_date, gender, hometown, occupation, note, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [...values, userId],
    );
    return t.rows[0].id;
  });
  const { rows } = await query(`${TENANT_SELECT} WHERE t.id = $1`, [id]);
  res.status(201).json(rows[0]);
});

// FR10 - Cập nhật người thuê
r.put('/:id', adminOnly, async (req, res) => {
  const id = Number(req.params.id);
  const values = parseTenant(req.body || {});
  const { rowCount } = await query(
    `UPDATE tenants SET full_name = $1, phone = $2, email = $3, id_card = $4, birth_date = $5,
            gender = $6, hometown = $7, occupation = $8, note = $9 WHERE id = $10`,
    [...values, id],
  );
  if (!rowCount) throw new HttpError(404, 'Không tìm thấy người thuê');
  // Đồng bộ thông tin liên hệ sang tài khoản
  await query(
    `UPDATE users SET full_name = $1, phone = $2, email = $3
     WHERE id = (SELECT user_id FROM tenants WHERE id = $4)`,
    [values[0], values[1], values[2], id],
  );
  const { rows } = await query(`${TENANT_SELECT} WHERE t.id = $1`, [id]);
  res.json(rows[0]);
});

// FR11 - Xóa người thuê / chuyển sang lịch sử
r.delete('/:id', adminOnly, async (req, res) => {
  const id = Number(req.params.id);
  const result = await transaction(async (tx) => {
    const t = await tx.query('SELECT * FROM tenants WHERE id = $1', [id]);
    if (!t.rows[0]) throw new HttpError(404, 'Không tìm thấy người thuê');
    const c = await tx.query(
      `SELECT COUNT(*) FILTER (WHERE status = 'active')::int AS active, COUNT(*)::int AS total
       FROM contracts WHERE tenant_id = $1`,
      [id],
    );
    if (c.rows[0].active > 0) {
      throw new HttpError(409, 'Người thuê đang có hợp đồng hiệu lực, cần kết thúc hợp đồng trước khi xóa');
    }
    if (c.rows[0].total > 0) {
      // Có lịch sử thuê => lưu trữ, không xóa cứng
      await tx.query("UPDATE tenants SET status = 'moved_out' WHERE id = $1", [id]);
      if (t.rows[0].user_id) await tx.query('UPDATE users SET is_active = FALSE WHERE id = $1', [t.rows[0].user_id]);
      return { archived: true, message: 'Người thuê có lịch sử hợp đồng nên đã được chuyển sang danh sách "Đã chuyển đi"' };
    }
    await tx.query('DELETE FROM tenants WHERE id = $1', [id]);
    if (t.rows[0].user_id) await tx.query('DELETE FROM users WHERE id = $1', [t.rows[0].user_id]);
    return { archived: false, message: 'Đã xóa người thuê' };
  });
  res.json(result);
});

// Khôi phục người thuê đã chuyển đi
r.post('/:id/restore', adminOnly, async (req, res) => {
  const id = Number(req.params.id);
  const { rows } = await query("UPDATE tenants SET status = 'active' WHERE id = $1 RETURNING user_id", [id]);
  if (!rows[0]) throw new HttpError(404, 'Không tìm thấy người thuê');
  if (rows[0].user_id) await query('UPDATE users SET is_active = TRUE WHERE id = $1', [rows[0].user_id]);
  res.json({ message: 'Đã khôi phục người thuê' });
});

export default r;
