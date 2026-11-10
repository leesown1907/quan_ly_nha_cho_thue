export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const isBlank = (v) => v === undefined || v === null || String(v).trim() === '';

/** Kiểm tra các trường bắt buộc. labels: { field: 'Nhãn tiếng Việt' } */
export function requireFields(body, labels) {
  const missing = Object.entries(labels)
    .filter(([key]) => isBlank(body?.[key]))
    .map(([, label]) => label);
  if (missing.length) throw new HttpError(400, `Vui lòng nhập: ${missing.join(', ')}`);
}

/** Chuyển sang số và kiểm tra hợp lệ */
export function num(value, label, { min = 0, max, int = true, optional = false } = {}) {
  if (isBlank(value)) {
    if (optional) return null;
    throw new HttpError(400, `Vui lòng nhập ${label}`);
  }
  const n = Number(value);
  if (!Number.isFinite(n)) throw new HttpError(400, `${label} phải là số`);
  if (int && !Number.isInteger(n)) throw new HttpError(400, `${label} phải là số nguyên`);
  if (min !== undefined && n < min) throw new HttpError(400, `${label} không được nhỏ hơn ${min}`);
  if (max !== undefined && n > max) throw new HttpError(400, `${label} không được lớn hơn ${max}`);
  return n;
}

export const str = (v) => (isBlank(v) ? null : String(v).trim());

export const isPeriod = (p) => /^\d{4}-(0[1-9]|1[0-2])$/.test(p || '');
export const isDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '') && !Number.isNaN(Date.parse(d));

export function oneOf(value, allowed, label) {
  if (!allowed.includes(value)) throw new HttpError(400, `${label} không hợp lệ`);
  return value;
}

/** Bộ dựng điều kiện WHERE có tham số */
export function where() {
  const conds = [];
  const params = [];
  return {
    params,
    add(build, value) {
      params.push(value);
      conds.push(build(`$${params.length}`));
      return this;
    },
    raw(cond) {
      conds.push(cond);
      return this;
    },
    sql() {
      return conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    },
  };
}

export function tenantIdOf(req) {
  if (!req.user.tenant_id) throw new HttpError(403, 'Tài khoản chưa được liên kết với hồ sơ người thuê');
  return req.user.tenant_id;
}

export const pad2 = (n) => String(n).padStart(2, '0');
export const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};
export const periodLabel = (p) => `${p.slice(5, 7)}/${p.slice(0, 4)}`;
export function nextPeriod(p) {
  let [y, m] = p.split('-').map(Number);
  m += 1;
  if (m > 12) { m = 1; y += 1; }
  return `${y}-${pad2(m)}`;
}
export function prevPeriod(p) {
  let [y, m] = p.split('-').map(Number);
  m -= 1;
  if (m < 1) { m = 12; y -= 1; }
  return `${y}-${pad2(m)}`;
}
export const formatVnd = (n) => `${Number(n || 0).toLocaleString('vi-VN')} đ`;
