export const money = (n) => `${Math.round(Number(n || 0)).toLocaleString('vi-VN')} đ`;
export const number = (n) => Number(n || 0).toLocaleString('vi-VN');
export const shortMoney = (n) => {
  const v = Number(n || 0);
  if (Math.abs(v) >= 1e9) return `${(v / 1e9).toFixed(1).replace('.0', '')} tỷ`;
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(1).replace('.0', '')} tr`;
  if (Math.abs(v) >= 1e3) return `${Math.round(v / 1e3)}k`;
  return String(v);
};

export function date(d) {
  if (!d) return '—';
  const s = String(d);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, day] = s.split('-');
    return `${day}/${m}/${y}`;
  }
  return new Date(s).toLocaleDateString('vi-VN');
}
export const datetime = (d) => (d ? new Date(d).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : '—');
export const period = (p) => (p ? `${p.slice(5, 7)}/${p.slice(0, 4)}` : '—');

const pad = (n) => String(n).padStart(2, '0');
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
export const currentPeriod = () => today().slice(0, 7);
export function shiftPeriod(p, delta) {
  let [y, m] = p.split('-').map(Number);
  m += delta;
  while (m > 12) { m -= 12; y += 1; }
  while (m < 1) { m += 12; y -= 1; }
  return `${y}-${pad(m)}`;
}
export function addMonths(dateStr, months) {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export const timeAgo = (d) => {
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (diff < 60) return 'vừa xong';
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)} ngày trước`;
  return date(d);
};

// Nhãn + màu trạng thái
export const ROOM_STATUS = {
  available: { label: 'Phòng trống', color: 'green' },
  occupied: { label: 'Đang cho thuê', color: 'blue' },
  maintenance: { label: 'Đang sửa chữa', color: 'amber' },
};
export const CONTRACT_STATUS = {
  active: { label: 'Đang hiệu lực', color: 'green' },
  ended: { label: 'Đã kết thúc', color: 'slate' },
};
export const TENANT_STATUS = {
  active: { label: 'Đang thuê', color: 'green' },
  moved_out: { label: 'Đã chuyển đi', color: 'slate' },
};
export const INVOICE_STATUS = {
  unpaid: { label: 'Chưa thanh toán', color: 'red' },
  partial: { label: 'Thanh toán một phần', color: 'amber' },
  paid: { label: 'Đã thanh toán', color: 'green' },
};
export const INCIDENT_STATUS = {
  pending: { label: 'Chờ tiếp nhận', color: 'amber' },
  in_progress: { label: 'Đang xử lý', color: 'blue' },
  resolved: { label: 'Đã xử lý', color: 'green' },
  rejected: { label: 'Từ chối', color: 'slate' },
};
export const PRIORITY = {
  high: { label: 'Khẩn cấp', color: 'red' },
  medium: { label: 'Trung bình', color: 'amber' },
  low: { label: 'Thấp', color: 'slate' },
};
export const CATEGORY = {
  electric: 'Điện / thiết bị điện',
  water: 'Nước / vệ sinh',
  furniture: 'Nội thất / cửa / khóa',
  internet: 'Internet',
  security: 'An ninh',
  other: 'Khác',
};
export const METHOD = { cash: 'Tiền mặt', transfer: 'Chuyển khoản', other: 'Khác' };
export const UNIT = { room: 'phòng', person: 'người' };
