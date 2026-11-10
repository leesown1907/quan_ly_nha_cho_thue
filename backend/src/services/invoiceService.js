import { HttpError, pad2, periodLabel, nextPeriod, formatVnd } from '../utils/http.js';
import { notifyUser } from '../utils/notify.js';

export async function getSettings(q) {
  const { rows } = await q.query('SELECT key, value FROM settings');
  const s = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    ...s,
    electricity_price: Number(s.electricity_price || 0),
    water_price: Number(s.water_price || 0),
  };
}

/**
 * FR19, FR21 - Tổng hợp tiền phòng + điện + nước + dịch vụ và tạo hóa đơn theo kỳ.
 * @returns {{ created: object[], missingReadings: string[], existing: number }}
 */
export async function generateInvoices(q, { period, dueDate = null, issueDate = null, contractIds = null, notify = true }) {
  const services = (await q.query('SELECT * FROM services WHERE is_active ORDER BY id')).rows;

  const params = [period];
  let filter = '';
  if (contractIds?.length) {
    const ph = contractIds.map((cid) => {
      params.push(Number(cid));
      return `$${params.length}`;
    });
    filter = `AND c.id IN (${ph.join(', ')})`;
  }

  const { rows: contracts } = await q.query(
    `SELECT c.*, r.code AS room_code, t.user_id, t.full_name AS tenant_name,
            ur.id AS reading_id, ur.elec_old, ur.elec_new, ur.water_old, ur.water_new, ur.elec_price, ur.water_price,
            EXISTS (SELECT 1 FROM invoices i WHERE i.contract_id = c.id AND i.period = $1) AS has_invoice
     FROM contracts c
     JOIN rooms r ON r.id = c.room_id
     JOIN tenants t ON t.id = c.tenant_id
     LEFT JOIN utility_readings ur ON ur.room_id = c.room_id AND ur.period = $1
     WHERE c.status = 'active' AND to_char(c.start_date, 'YYYY-MM') <= $1 ${filter}
     ORDER BY r.code`,
    params,
  );

  const created = [];
  const missingReadings = [];
  let existing = 0;

  for (const c of contracts) {
    if (c.has_invoice) { existing += 1; continue; }
    if (!c.reading_id) { missingReadings.push(c.room_code); continue; }

    const label = periodLabel(period);
    const items = [
      { type: 'rent', desc: `Tiền phòng tháng ${label}`, qty: 1, price: c.monthly_rent },
    ];
    const elecUsage = c.elec_new - c.elec_old;
    const waterUsage = c.water_new - c.water_old;
    items.push({ type: 'electricity', desc: `Tiền điện (${c.elec_old} → ${c.elec_new}) kWh`, qty: elecUsage, price: c.elec_price });
    items.push({ type: 'water', desc: `Tiền nước (${c.water_old} → ${c.water_new}) m³`, qty: waterUsage, price: c.water_price });
    for (const s of services) {
      const qty = s.unit === 'person' ? c.occupants : 1;
      items.push({ type: 'service', desc: s.unit === 'person' ? `${s.name} (${qty} người)` : s.name, qty, price: s.price });
    }
    items.forEach((it) => { it.amount = Math.round(it.qty * it.price); });
    const total = items.reduce((sum, it) => sum + it.amount, 0);

    const due = dueDate || `${nextPeriod(period)}-${pad2(Math.min(c.payment_day, 28))}`;
    const code = `INV-${period.replace('-', '')}-${c.room_code}`;
    const inv = (await q.query(
      `INSERT INTO invoices (code, contract_id, room_id, period, issue_date, due_date, total)
       VALUES ($1, $2, $3, $4, COALESCE($5::date, CURRENT_DATE), $6, $7) RETURNING *`,
      [code, c.id, c.room_id, period, issueDate, due, total],
    )).rows[0];

    for (const it of items) {
      await q.query(
        `INSERT INTO invoice_items (invoice_id, item_type, description, quantity, unit_price, amount)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [inv.id, it.type, it.desc, it.qty, it.price, it.amount],
      );
    }
    if (notify) {
      await notifyUser(c.user_id, {
        title: `Hóa đơn tháng ${label} - Phòng ${c.room_code}`,
        message: `Tổng tiền ${formatVnd(total)}. Hạn thanh toán: ${due}.`,
        type: 'invoice',
        link: '/invoices',
      }, q);
    }
    created.push({ ...inv, room_code: c.room_code, tenant_name: c.tenant_name });
  }

  if (!contracts.length && contractIds?.length) throw new HttpError(404, 'Không tìm thấy hợp đồng hợp lệ');
  return { created, missingReadings, existing };
}
