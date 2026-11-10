import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query, transaction } from '../db/index.js';
import { authenticate, adminOnly } from '../middleware/auth.js';
import { HttpError, requireFields, str, oneOf, where } from '../utils/http.js';

const r = Router();
r.use(authenticate, adminOnly);

const USER_SELECT = `
  SELECT u.id, u.username, u.full_name, u.phone, u.email, u.role, u.is_active, u.created_at,
         t.id AS tenant_id, t.full_name AS tenant_name
  FROM users u LEFT JOIN tenants t ON t.user_id = u.id`;

// FR03 - Danh sách tài khoản
r.get('/', async (req, res) => {
  const w = where();
  const { search, role } = req.query;
  if (search) w.add((p) => `(u.username ILIKE ${p} OR u.full_name ILIKE ${p} OR u.phone ILIKE ${p})`, `%${search}%`);
  if (role) w.add((p) => `u.role = ${p}`, role);
  const { rows } = await query(`${USER_SELECT} ${w.sql()} ORDER BY u.role, u.username`, w.params);
  res.json(rows);
});

async function linkTenant(tx, userId, tenantId) {
  await tx.query('UPDATE tenants SET user_id = NULL WHERE user_id = $1', [userId]);
  if (!tenantId) return;
  const t = await tx.query('SELECT id, user_id FROM tenants WHERE id = $1', [tenantId]);
  if (!t.rows[0]) throw new HttpError(404, 'Không tìm thấy hồ sơ người thuê');
  if (t.rows[0].user_id && t.rows[0].user_id !== userId) {
    throw new HttpError(409, 'Hồ sơ người thuê này đã được gán cho tài khoản khác');
  }
  await tx.query('UPDATE tenants SET user_id = $1 WHERE id = $2', [userId, tenantId]);
}

// FR03 - Cấp tài khoản mới
r.post('/', async (req, res) => {
  const b = req.body || {};
  requireFields(b, { username: 'Tên đăng nhập', password: 'Mật khẩu', full_name: 'Họ tên', role: 'Vai trò' });
  oneOf(b.role, ['admin', 'tenant'], 'Vai trò');
  if (!/^[a-zA-Z0-9_.]{3,50}$/.test(b.username)) {
    throw new HttpError(400, 'Tên đăng nhập 3-50 ký tự, chỉ gồm chữ, số, dấu chấm hoặc gạch dưới');
  }
  if (String(b.password).length < 6) throw new HttpError(400, 'Mật khẩu phải có ít nhất 6 ký tự');
  const hash = await bcrypt.hash(String(b.password), 10);

  const user = await transaction(async (tx) => {
    const exists = await tx.query('SELECT 1 FROM users WHERE LOWER(username) = LOWER($1)', [b.username]);
    if (exists.rows.length) throw new HttpError(409, 'Tên đăng nhập đã tồn tại');
    const { rows } = await tx.query(
      `INSERT INTO users (username, password_hash, full_name, phone, email, role)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [b.username.trim(), hash, str(b.full_name), str(b.phone), str(b.email), b.role],
    );
    if (b.role === 'tenant' && b.tenant_id) await linkTenant(tx, rows[0].id, Number(b.tenant_id));
    return rows[0];
  });
  const { rows } = await query(`${USER_SELECT} WHERE u.id = $1`, [user.id]);
  res.status(201).json(rows[0]);
});

// Cập nhật tài khoản / khóa / đặt lại mật khẩu
r.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const b = req.body || {};
  requireFields(b, { full_name: 'Họ tên', role: 'Vai trò' });
  oneOf(b.role, ['admin', 'tenant'], 'Vai trò');
  const isActive = b.is_active !== false;
  if (id === req.user.id && (!isActive || b.role !== 'admin')) {
    throw new HttpError(400, 'Bạn không thể khóa hoặc hạ quyền tài khoản của chính mình');
  }

  await transaction(async (tx) => {
    const cur = await tx.query('SELECT * FROM users WHERE id = $1', [id]);
    if (!cur.rows[0]) throw new HttpError(404, 'Không tìm thấy tài khoản');
    let bump = !isActive || cur.rows[0].role !== b.role;
    if (b.password) {
      if (String(b.password).length < 6) throw new HttpError(400, 'Mật khẩu phải có ít nhất 6 ký tự');
      const hash = await bcrypt.hash(String(b.password), 10);
      await tx.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, id]);
      bump = true;
    }
    await tx.query(
      `UPDATE users SET full_name = $1, phone = $2, email = $3, role = $4, is_active = $5,
              token_version = token_version + $6 WHERE id = $7`,
      [str(b.full_name), str(b.phone), str(b.email), b.role, isActive, bump ? 1 : 0, id],
    );
    if (b.tenant_id !== undefined) {
      await linkTenant(tx, id, b.role === 'tenant' && b.tenant_id ? Number(b.tenant_id) : null);
    }
  });
  const { rows } = await query(`${USER_SELECT} WHERE u.id = $1`, [id]);
  res.json(rows[0]);
});

r.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) throw new HttpError(400, 'Bạn không thể xóa tài khoản của chính mình');
  const { rowCount } = await query('DELETE FROM users WHERE id = $1', [id]);
  if (!rowCount) throw new HttpError(404, 'Không tìm thấy tài khoản');
  res.json({ message: 'Đã xóa tài khoản' });
});

export default r;
