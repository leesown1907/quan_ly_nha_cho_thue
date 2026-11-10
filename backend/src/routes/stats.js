import { Router } from 'express';
import { query } from '../db/index.js';
import { authenticate, adminOnly, tenantOnly } from '../middleware/auth.js';
import { HttpError, isDate, tenantIdOf, todayStr, pad2 } from '../utils/http.js';

const r = Router();
r.use(authenticate);

function defaultRange() {
  const d = new Date();
  const from = new Date(d.getFullYear(), d.getMonth() - 5, 1);
  return { from: `${from.getFullYear()}-${pad2(from.getMonth() + 1)}-01`, to: todayStr() };
}

// FR27 - Thống kê cho chủ nhà
r.get('/dashboard', adminOnly, async (req, res) => {
  const range = defaultRange();
  const from = req.query.from || range.from;
  const to = req.query.to || range.to;
  if (!isDate(from) || !isDate(to) || from > to) throw new HttpError(400, 'Khoảng thời gian không hợp lệ');

  const [rooms, tenants, money, debt, monthly, expiring, incidents, debtors, incidentStats] = await Promise.all([
    query(`SELECT COUNT(*)::int AS total,
                  COUNT(*) FILTER (WHERE status = 'available')::int AS available,
                  COUNT(*) FILTER (WHERE status = 'occupied')::int AS occupied,
                  COUNT(*) FILTER (WHERE status = 'maintenance')::int AS maintenance
           FROM rooms`),
    query(`SELECT COUNT(*) FILTER (WHERE status = 'active')::int AS active, COUNT(*)::int AS total FROM tenants`),
    query(
      `SELECT
         COALESCE((SELECT SUM(amount) FROM payments WHERE paid_at >= $1::date AND paid_at < ($2::date + 1)), 0)::float8 AS revenue,
         COALESCE((SELECT SUM(total) FROM invoices WHERE period >= to_char($1::date, 'YYYY-MM') AND period <= to_char($2::date, 'YYYY-MM')), 0)::float8 AS invoiced,
         COALESCE((SELECT SUM(total - paid_amount) FROM invoices WHERE status <> 'paid' AND period >= to_char($1::date, 'YYYY-MM') AND period <= to_char($2::date, 'YYYY-MM')), 0)::float8 AS range_debt`,
      [from, to],
    ),
    query(`SELECT COALESCE(SUM(total - paid_amount), 0)::float8 AS amount, COUNT(*)::int AS count,
                  COALESCE(SUM(total - paid_amount) FILTER (WHERE due_date < CURRENT_DATE), 0)::float8 AS overdue_amount,
                  COUNT(*) FILTER (WHERE due_date < CURRENT_DATE)::int AS overdue_count
           FROM invoices WHERE status <> 'paid'`),
    query(
      `SELECT to_char(m, 'YYYY-MM') AS month,
              COALESCE((SELECT SUM(total) FROM invoices WHERE period = to_char(m, 'YYYY-MM')), 0)::float8 AS invoiced,
              COALESCE((SELECT SUM(amount) FROM payments WHERE to_char(paid_at, 'YYYY-MM') = to_char(m, 'YYYY-MM')), 0)::float8 AS collected
       FROM generate_series(date_trunc('month', $1::date), date_trunc('month', $2::date), interval '1 month') AS m
       ORDER BY m`,
      [from, to],
    ),
    query(`SELECT c.id, c.code, c.end_date, (c.end_date - CURRENT_DATE) AS days_left, r.code AS room_code, t.full_name AS tenant_name
           FROM contracts c JOIN rooms r ON r.id = c.room_id JOIN tenants t ON t.id = c.tenant_id
           WHERE c.status = 'active' AND c.end_date <= CURRENT_DATE + 30 ORDER BY c.end_date LIMIT 10`),
    query(`SELECT i.id, i.title, i.priority, i.status, i.created_at, r.code AS room_code
           FROM incidents i JOIN rooms r ON r.id = i.room_id
           WHERE i.status IN ('pending', 'in_progress') ORDER BY i.created_at DESC LIMIT 6`),
    query(`SELECT r.code AS room_code, t.full_name AS tenant_name, SUM(i.total - i.paid_amount)::float8 AS debt,
                  COUNT(*)::int AS invoices
           FROM invoices i JOIN contracts c ON c.id = i.contract_id JOIN rooms r ON r.id = i.room_id JOIN tenants t ON t.id = c.tenant_id
           WHERE i.status <> 'paid' GROUP BY r.code, t.full_name ORDER BY debt DESC LIMIT 6`),
    query(`SELECT COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
                  COUNT(*) FILTER (WHERE status = 'in_progress')::int AS in_progress,
                  COUNT(*) FILTER (WHERE status = 'resolved')::int AS resolved
           FROM incidents`),
  ]);

  res.json({
    range: { from, to },
    rooms: rooms.rows[0],
    tenants: tenants.rows[0],
    money: money.rows[0],
    debt: debt.rows[0],
    monthly: monthly.rows,
    expiring: expiring.rows,
    incidents: incidents.rows,
    incident_stats: incidentStats.rows[0],
    debtors: debtors.rows,
  });
});

// Tổng quan cho người thuê
r.get('/tenant', tenantOnly, async (req, res) => {
  const tenantId = tenantIdOf(req);
  const [contract, debt, latestInvoice, latestReading, incidents] = await Promise.all([
    query(
      `SELECT c.*, r.code AS room_code, r.area, r.floor, r.max_occupants, (c.end_date - CURRENT_DATE) AS days_left
       FROM contracts c JOIN rooms r ON r.id = c.room_id
       WHERE c.tenant_id = $1 AND c.status = 'active' ORDER BY c.start_date DESC LIMIT 1`,
      [tenantId],
    ),
    query(
      `SELECT COALESCE(SUM(i.total - i.paid_amount), 0)::float8 AS amount, COUNT(*)::int AS count,
              MIN(i.due_date) AS nearest_due
       FROM invoices i JOIN contracts c ON c.id = i.contract_id
       WHERE c.tenant_id = $1 AND i.status <> 'paid'`,
      [tenantId],
    ),
    query(
      `SELECT i.*, (i.total - i.paid_amount) AS remaining FROM invoices i JOIN contracts c ON c.id = i.contract_id
       WHERE c.tenant_id = $1 ORDER BY i.period DESC LIMIT 1`,
      [tenantId],
    ),
    query(
      `SELECT ur.*, (ur.elec_new - ur.elec_old) AS elec_usage, (ur.water_new - ur.water_old) AS water_usage
       FROM utility_readings ur JOIN contracts c ON c.room_id = ur.room_id AND c.status = 'active'
       WHERE c.tenant_id = $1 ORDER BY ur.period DESC LIMIT 6`,
      [tenantId],
    ),
    query(
      `SELECT COUNT(*) FILTER (WHERE status IN ('pending', 'in_progress'))::int AS open, COUNT(*)::int AS total
       FROM incidents WHERE tenant_id = $1`,
      [tenantId],
    ),
  ]);
  res.json({
    contract: contract.rows[0] || null,
    debt: debt.rows[0],
    latest_invoice: latestInvoice.rows[0] || null,
    readings: latestReading.rows.reverse(),
    incidents: incidents.rows[0],
  });
});

export default r;
