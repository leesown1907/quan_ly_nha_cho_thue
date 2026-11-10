import jwt from 'jsonwebtoken';
import { query } from '../db/index.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'nha57-giangvo-secret-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role, tv: user.token_version }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

/** Xác thực JWT và nạp thông tin người dùng vào req.user */
export async function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Bạn chưa đăng nhập' });

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ message: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại' });
  }

  const { rows } = await query(
    `SELECT u.id, u.username, u.full_name, u.phone, u.email, u.role, u.is_active, u.token_version,
            t.id AS tenant_id
     FROM users u LEFT JOIN tenants t ON t.user_id = u.id
     WHERE u.id = $1`,
    [payload.sub],
  );
  const user = rows[0];
  if (!user || !user.is_active || user.token_version !== payload.tv) {
    return res.status(401).json({ message: 'Phiên đăng nhập không còn hiệu lực, vui lòng đăng nhập lại' });
  }
  delete user.token_version;
  req.user = user;
  next();
}

/** Phân quyền theo vai trò - vi phạm trả về HTTP 403 */
export const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    return res.status(403).json({ message: 'Bạn không có quyền thực hiện chức năng này' });
  }
  next();
};

export const adminOnly = requireRole('admin');
export const tenantOnly = requireRole('tenant');
