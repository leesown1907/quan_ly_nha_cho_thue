import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db/index.js';
import { authenticate, signToken } from '../middleware/auth.js';
import { HttpError, str } from '../utils/http.js';

const r = Router();

const publicUser = (u, tenantId = null) => ({
  id: u.id,
  username: u.username,
  full_name: u.full_name,
  phone: u.phone,
  email: u.email,
  role: u.role,
  tenant_id: tenantId,
});

// FR01 - Đăng nhập
r.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) throw new HttpError(400, 'Vui lòng nhập tên đăng nhập và mật khẩu');

  const { rows } = await query(
    `SELECT u.*, t.id AS tenant_id FROM users u LEFT JOIN tenants t ON t.user_id = u.id
     WHERE LOWER(u.username) = LOWER($1)`,
    [String(username).trim()],
  );
  const user = rows[0];
  if (!user || !(await bcrypt.compare(String(password), user.password_hash))) {
    throw new HttpError(401, 'Tên đăng nhập hoặc mật khẩu không đúng');
  }
  if (!user.is_active) throw new HttpError(403, 'Tài khoản đã bị khóa, vui lòng liên hệ chủ nhà');

  res.json({ token: signToken(user), user: publicUser(user, user.tenant_id) });
});

// Thông tin người dùng hiện tại
r.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// FR04 - Đăng xuất: vô hiệu hóa token hiện tại
r.post('/logout', authenticate, async (req, res) => {
  await query('UPDATE users SET token_version = token_version + 1 WHERE id = $1', [req.user.id]);
  res.json({ message: 'Đã đăng xuất' });
});

// FR04 - Đổi mật khẩu
r.post('/change-password', authenticate, async (req, res) => {
  const { current_password, new_password } = req.body || {};
  if (!current_password || !new_password) throw new HttpError(400, 'Vui lòng nhập đầy đủ mật khẩu');
  if (String(new_password).length < 6) throw new HttpError(400, 'Mật khẩu mới phải có ít nhất 6 ký tự');

  const { rows } = await query('SELECT * FROM users WHERE id = $1', [req.user.id]);
  if (!(await bcrypt.compare(String(current_password), rows[0].password_hash))) {
    throw new HttpError(400, 'Mật khẩu hiện tại không đúng');
  }
  const hash = await bcrypt.hash(String(new_password), 10);
  const updated = await query(
    'UPDATE users SET password_hash = $1, token_version = token_version + 1 WHERE id = $2 RETURNING *',
    [hash, req.user.id],
  );
  res.json({ message: 'Đổi mật khẩu thành công', token: signToken(updated.rows[0]) });
});

// US12 - Cập nhật thông tin cá nhân
r.put('/profile', authenticate, async (req, res) => {
  const full_name = str(req.body.full_name);
  if (!full_name) throw new HttpError(400, 'Vui lòng nhập họ tên');
  const phone = str(req.body.phone);
  const email = str(req.body.email);
  if (email && !/^\S+@\S+\.\S+$/.test(email)) throw new HttpError(400, 'Email không hợp lệ');

  await query('UPDATE users SET full_name = $1, phone = $2, email = $3 WHERE id = $4', [
    full_name, phone, email, req.user.id,
  ]);
  if (req.user.tenant_id) {
    await query('UPDATE tenants SET phone = COALESCE($1, phone), email = $2 WHERE id = $3', [
      phone, email, req.user.tenant_id,
    ]);
  }
  res.json({ message: 'Cập nhật thông tin thành công', user: { ...req.user, full_name, phone, email } });
});

export default r;
