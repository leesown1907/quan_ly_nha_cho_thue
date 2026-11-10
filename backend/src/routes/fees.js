import { Router } from 'express';
import { query } from '../db/index.js';
import { authenticate, adminOnly } from '../middleware/auth.js';
import { HttpError, requireFields, num, str, oneOf } from '../utils/http.js';
import { notifyActiveTenants } from '../utils/notify.js';
import { getSettings } from '../services/invoiceService.js';

const r = Router();
r.use(authenticate);

// FR17, FR20 - Xem đơn giá điện nước và danh mục phí dịch vụ
r.get('/', async (req, res) => {
  const settings = await getSettings({ query });
  const services = await query(
    `SELECT * FROM services ${req.user.role === 'tenant' ? 'WHERE is_active' : ''} ORDER BY is_active DESC, id`,
  );
  res.json({ ...settings, services: services.rows });
});

// FR17 - Cập nhật đơn giá điện, nước
r.put('/prices', adminOnly, async (req, res) => {
  const elec = num(req.body.electricity_price, 'Đơn giá điện', { min: 0 });
  const water = num(req.body.water_price, 'Đơn giá nước', { min: 0 });
  await query(
    `INSERT INTO settings (key, value) VALUES ('electricity_price', $1), ('water_price', $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [String(elec), String(water)],
  );
  if (req.body.house_name) {
    await query(
      `INSERT INTO settings (key, value) VALUES ('house_name', $1), ('house_address', $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [str(req.body.house_name), str(req.body.house_address) || ''],
    );
  }
  await notifyActiveTenants({
    title: 'Cập nhật đơn giá điện nước',
    message: `Điện: ${elec.toLocaleString('vi-VN')} đ/kWh, nước: ${water.toLocaleString('vi-VN')} đ/m³ (áp dụng từ kỳ ghi chỉ số tiếp theo).`,
    type: 'fee',
    link: '/readings',
  });
  res.json(await getSettings({ query }));
});

function parseService(b) {
  requireFields(b, { name: 'Tên dịch vụ', price: 'Đơn giá' });
  return [
    str(b.name),
    num(b.price, 'Đơn giá', { min: 0 }),
    oneOf(b.unit || 'room', ['room', 'person'], 'Đơn vị tính'),
    str(b.description),
    b.is_active !== false,
  ];
}

// FR17 - Danh mục phí dịch vụ
r.post('/services', adminOnly, async (req, res) => {
  const v = parseService(req.body || {});
  const { rows } = await query(
    'INSERT INTO services (name, price, unit, description, is_active) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    v,
  );
  await notifyActiveTenants({
    title: 'Bổ sung khoản phí dịch vụ',
    message: `${v[0]}: ${v[1].toLocaleString('vi-VN')} đ/${v[2] === 'person' ? 'người' : 'phòng'}/tháng.`,
    type: 'fee',
    link: '/fees',
  });
  res.status(201).json(rows[0]);
});

r.put('/services/:id', adminOnly, async (req, res) => {
  const v = parseService(req.body || {});
  const { rows } = await query(
    'UPDATE services SET name = $1, price = $2, unit = $3, description = $4, is_active = $5 WHERE id = $6 RETURNING *',
    [...v, Number(req.params.id)],
  );
  if (!rows[0]) throw new HttpError(404, 'Không tìm thấy dịch vụ');
  res.json(rows[0]);
});

r.delete('/services/:id', adminOnly, async (req, res) => {
  const { rowCount } = await query('DELETE FROM services WHERE id = $1', [Number(req.params.id)]);
  if (!rowCount) throw new HttpError(404, 'Không tìm thấy dịch vụ');
  res.json({ message: 'Đã xóa dịch vụ' });
});

export default r;
