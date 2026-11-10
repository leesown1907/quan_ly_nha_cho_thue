import { Router } from 'express';
import { query } from '../db/index.js';
import { authenticate } from '../middleware/auth.js';
import { where, tenantIdOf } from '../utils/http.js';

const r = Router();
r.use(authenticate);

// FR23, FR24 - Lịch sử giao dịch thanh toán
r.get('/', async (req, res) => {
  const w = where();
  const { from, to, search, method } = req.query;
  if (req.user.role === 'tenant') w.add((p) => `c.tenant_id = ${p}`, tenantIdOf(req));
  if (from) w.add((p) => `p.paid_at >= ${p}::date`, from);
  if (to) w.add((p) => `p.paid_at < (${p}::date + 1)`, to);
  if (method) w.add((p) => `p.method = ${p}`, method);
  if (search) w.add((p) => `(i.code ILIKE ${p} OR r.code ILIKE ${p} OR t.full_name ILIKE ${p})`, `%${search}%`);
  const { rows } = await query(
    `SELECT p.*, i.code AS invoice_code, i.period, r.code AS room_code, t.full_name AS tenant_name,
            u.full_name AS confirmed_by_name
     FROM payments p
     JOIN invoices i ON i.id = p.invoice_id
     JOIN contracts c ON c.id = i.contract_id
     JOIN rooms r ON r.id = i.room_id
     JOIN tenants t ON t.id = c.tenant_id
     LEFT JOIN users u ON u.id = p.confirmed_by
     ${w.sql()} ORDER BY p.paid_at DESC`,
    w.params,
  );
  const total = rows.reduce((s, p) => s + p.amount, 0);
  res.json({ items: rows, total });
});

export default r;
