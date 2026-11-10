import { db as defaultDb } from '../db/index.js';

/** Gửi thông báo cho 1 tài khoản */
export async function notifyUser(userId, { title, message = null, type = 'general', link = null }, q = defaultDb) {
  if (!userId) return;
  await q.query(
    'INSERT INTO notifications (user_id, title, message, type, link) VALUES ($1, $2, $3, $4, $5)',
    [userId, title, message, type, link],
  );
}

/** Gửi thông báo cho người thuê (qua hồ sơ tenant -> tài khoản) */
export async function notifyTenant(tenantId, data, q = defaultDb) {
  const { rows } = await q.query('SELECT user_id FROM tenants WHERE id = $1', [tenantId]);
  if (rows[0]?.user_id) await notifyUser(rows[0].user_id, data, q);
}

/** Gửi thông báo cho tất cả chủ nhà / quản lý */
export async function notifyAdmins({ title, message = null, type = 'general', link = null }, q = defaultDb) {
  await q.query(
    `INSERT INTO notifications (user_id, title, message, type, link)
     SELECT id, $1, $2, $3, $4 FROM users WHERE role = 'admin' AND is_active`,
    [title, message, type, link],
  );
}

/** Gửi thông báo cho mọi người thuê đang có hợp đồng hiệu lực */
export async function notifyActiveTenants({ title, message = null, type = 'general', link = null }, q = defaultDb) {
  await q.query(
    `INSERT INTO notifications (user_id, title, message, type, link)
     SELECT DISTINCT t.user_id, $1, $2, $3, $4
     FROM tenants t JOIN contracts c ON c.tenant_id = t.id AND c.status = 'active'
     WHERE t.user_id IS NOT NULL`,
    [title, message, type, link],
  );
}
