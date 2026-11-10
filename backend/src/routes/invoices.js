import { Router } from 'express';
import { query, transaction } from '../db/index.js';
import { authenticate, adminOnly } from '../middleware/auth.js';
import { HttpError, num, str, where, isPeriod, isDate, tenantIdOf, formatVnd, periodLabel } from '../utils/http.js';
import { notifyUser } from '../utils/notify.js';
import { generateInvoices } from '../services/invoiceService.js';

const r = Router();
r.use(authenticate);

const INVOICE_SELECT = `
  SELECT i.*, (i.total - i.paid_amount) AS remaining,
         (i.status <> 'paid' AND i.due_date < CURRENT_DATE) AS overdue,
         r.code AS room_code, c.code AS contract_code, c.tenant_id,
         t.full_name AS tenant_name, t.phone AS tenant_phone, t.user_id AS tenant_user_id
  FROM invoices i
  JOIN contracts c ON c.id = i.contract_id
  JOIN rooms r ON r.id = i.room_id
  JOIN tenants t ON t.id = c.tenant_id`;

// FR22, FR24, FR25, FR26 - Danh sách / tìm kiếm hóa đơn
r.get('/', async (req, res) => {
  const w = where();
  const { period, status, search, overdue, from, to } = req.query;
  if (req.user.role === 'tenant') w.add((p) => `c.tenant_id = ${p}`, tenantIdOf(req));
  if (period) w.add((p) => `i.period = ${p}`, period);
  if (from) w.add((p) => `i.period >= ${p}`, from);
  if (to) w.add((p) => `i.period <= ${p}`, to);
  if (status === 'debt') w.raw(`i.status <> 'paid'`);
  else if (status) w.add((p) => `i.status = ${p}`, status);
  if (overdue) w.raw(`i.status <> 'paid' AND i.due_date < CURRENT_DATE`);
  if (search) w.add((p) => `(i.code ILIKE ${p} OR r.code ILIKE ${p} OR t.full_name ILIKE ${p})`, `%${search}%`);
  const { rows } = await query(`${INVOICE_SELECT} ${w.sql()} ORDER BY i.period DESC, r.code`, w.params);
  const summary = rows.reduce(
    (s, i) => ({ total: s.total + i.total, paid: s.paid + i.paid_amount, remaining: s.remaining + Number(i.remaining) }),
    { total: 0, paid: 0, remaining: 0 },
  );
  res.json({ items: rows, summary });
});

async function loadInvoice(id, req) {
  const { rows } = await query(`${INVOICE_SELECT} WHERE i.id = $1`, [id]);
  const inv = rows[0];
  if (!inv) throw new HttpError(404, 'Không tìm thấy hóa đơn');
  if (req.user.role === 'tenant' && inv.tenant_id !== tenantIdOf(req)) {
    throw new HttpError(403, 'Bạn không có quyền xem hóa đơn này');
  }
  const items = await query('SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY id', [id]);
  const payments = await query(
    `SELECT p.*, u.full_name AS confirmed_by_name FROM payments p LEFT JOIN users u ON u.id = p.confirmed_by
     WHERE p.invoice_id = $1 ORDER BY p.paid_at`,
    [id],
  );
  return { ...inv, items: items.rows, payments: payments.rows };
}

r.get('/:id', async (req, res) => {
  res.json(await loadInvoice(Number(req.params.id), req));
});

// FR21 - Tạo hóa đơn hàng kỳ
r.post('/generate', adminOnly, async (req, res) => {
  const { period, due_date, contract_ids } = req.body || {};
  if (!isPeriod(period)) throw new HttpError(400, 'Kỳ hóa đơn không hợp lệ (YYYY-MM)');
  if (due_date && !isDate(due_date)) throw new HttpError(400, 'Hạn thanh toán không hợp lệ');
  const result = await transaction((tx) => generateInvoices(tx, {
    period, dueDate: due_date || null, contractIds: Array.isArray(contract_ids) ? contract_ids : null,
  }));
  const parts = [`Đã tạo ${result.created.length} hóa đơn kỳ ${periodLabel(period)}`];
  if (result.existing) parts.push(`${result.existing} phòng đã có hóa đơn`);
  if (result.missingReadings.length) parts.push(`chưa có chỉ số điện nước: ${result.missingReadings.join(', ')}`);
  res.status(201).json({ ...result, message: parts.join('; ') });
});

// Sửa hạn thanh toán / ghi chú
r.put('/:id', adminOnly, async (req, res) => {
  const id = Number(req.params.id);
  const { due_date, note } = req.body || {};
  if (!isDate(due_date)) throw new HttpError(400, 'Hạn thanh toán không hợp lệ');
  const { rowCount } = await query('UPDATE invoices SET due_date = $1, note = $2 WHERE id = $3', [due_date, str(note), id]);
  if (!rowCount) throw new HttpError(404, 'Không tìm thấy hóa đơn');
  res.json(await loadInvoice(id, req));
});

r.delete('/:id', adminOnly, async (req, res) => {
  const id = Number(req.params.id);
  const { rows } = await query('SELECT paid_amount FROM invoices WHERE id = $1', [id]);
  if (!rows[0]) throw new HttpError(404, 'Không tìm thấy hóa đơn');
  if (rows[0].paid_amount > 0) throw new HttpError(409, 'Hóa đơn đã có thanh toán, không thể xóa');
  await query('DELETE FROM invoices WHERE id = $1', [id]);
  res.json({ message: 'Đã xóa hóa đơn' });
});

// FR23 - Xác nhận thanh toán
r.post('/:id/payments', adminOnly, async (req, res) => {
  const id = Number(req.params.id);
  const b = req.body || {};
  const amount = num(b.amount, 'Số tiền', { min: 1 });
  const method = ['cash', 'transfer', 'other'].includes(b.method) ? b.method : 'cash';
  if (b.paid_at && Number.isNaN(Date.parse(b.paid_at))) throw new HttpError(400, 'Thời gian thanh toán không hợp lệ');

  await transaction(async (tx) => {
    const inv = (await tx.query(
      `SELECT i.*, r.code AS room_code, t.user_id FROM invoices i
       JOIN contracts c ON c.id = i.contract_id JOIN tenants t ON t.id = c.tenant_id JOIN rooms r ON r.id = i.room_id
       WHERE i.id = $1 FOR UPDATE OF i`,
      [id],
    )).rows[0];
    if (!inv) throw new HttpError(404, 'Không tìm thấy hóa đơn');
    const remaining = inv.total - inv.paid_amount;
    if (remaining <= 0) throw new HttpError(409, 'Hóa đơn đã được thanh toán đủ');
    if (amount > remaining) throw new HttpError(400, `Số tiền vượt quá số còn nợ (${formatVnd(remaining)})`);

    await tx.query(
      `INSERT INTO payments (invoice_id, amount, method, paid_at, note, confirmed_by)
       VALUES ($1, $2, $3, COALESCE($4::timestamptz, NOW()), $5, $6)`,
      [id, amount, method, b.paid_at || null, str(b.note), req.user.id],
    );
    const paid = inv.paid_amount + amount;
    const status = paid >= inv.total ? 'paid' : 'partial';
    await tx.query('UPDATE invoices SET paid_amount = $1, status = $2 WHERE id = $3', [paid, status, id]);
    await notifyUser(inv.user_id, {
      title: `Xác nhận thanh toán hóa đơn ${inv.code}`,
      message: `Chủ nhà đã xác nhận nhận ${formatVnd(amount)}. ${status === 'paid' ? 'Hóa đơn đã thanh toán đủ.' : `Còn nợ ${formatVnd(inv.total - paid)}.`}`,
      type: 'payment',
      link: '/invoices',
    }, tx);
  });
  res.status(201).json(await loadInvoice(id, req));
});

export default r;
