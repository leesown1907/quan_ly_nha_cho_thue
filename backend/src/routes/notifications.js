import { Router } from 'express';
import { query } from '../db/index.js';
import { authenticate } from '../middleware/auth.js';

const r = Router();
r.use(authenticate);

// FR31, FR32 - Thông báo của người dùng
r.get('/', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const unreadOnly = req.query.unread === '1';
  const { rows } = await query(
    `SELECT * FROM notifications WHERE user_id = $1 ${unreadOnly ? 'AND NOT is_read' : ''}
     ORDER BY created_at DESC, id DESC LIMIT ${limit}`,
    [req.user.id],
  );
  const count = await query('SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = $1 AND NOT is_read', [req.user.id]);
  res.json({ items: rows, unread: count.rows[0].n });
});

r.put('/read-all', async (req, res) => {
  await query('UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND NOT is_read', [req.user.id]);
  res.json({ message: 'Đã đánh dấu tất cả là đã đọc' });
});

r.put('/:id/read', async (req, res) => {
  await query('UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2', [Number(req.params.id), req.user.id]);
  res.json({ message: 'OK' });
});

r.delete('/:id', async (req, res) => {
  await query('DELETE FROM notifications WHERE id = $1 AND user_id = $2', [Number(req.params.id), req.user.id]);
  res.json({ message: 'Đã xóa thông báo' });
});

export default r;
