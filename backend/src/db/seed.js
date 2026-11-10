import bcrypt from 'bcryptjs';
import { query, transaction } from './index.js';
import { generateInvoices } from '../services/invoiceService.js';
import { pad2, prevPeriod, nextPeriod } from '../utils/http.js';

// Bộ sinh số ngẫu nhiên có seed để dữ liệu mẫu ổn định
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(57);
const between = (min, max) => Math.floor(rand() * (max - min + 1)) + min;

const fmt = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
function addMonths(base, months, day = null) {
  const d = new Date(base.getFullYear(), base.getMonth() + months, day ?? base.getDate());
  return fmt(d);
}

const ROOMS = [
  ['P101', 1, 20, 3200000, 2, 'Phòng tầng 1, cửa sổ hướng sân'],
  ['P102', 1, 22, 3400000, 2, 'Có gác xép, vệ sinh khép kín'],
  ['P103', 1, 18, 3000000, 2, 'Phòng nhỏ, phù hợp 1 người'],
  ['P104', 1, 25, 3800000, 3, 'Phòng rộng, gần cầu thang'],
  ['P201', 2, 25, 4000000, 3, 'Ban công, điều hòa, nóng lạnh'],
  ['P202', 2, 22, 3600000, 2, 'Điều hòa, nóng lạnh, tủ quần áo'],
  ['P203', 2, 20, 3400000, 2, 'Cửa sổ thoáng'],
  ['P204', 2, 28, 4300000, 3, 'Phòng góc, 2 cửa sổ'],
  ['P301', 3, 25, 4000000, 3, 'Ban công, đầy đủ nội thất'],
  ['P302', 3, 22, 3600000, 2, 'Điều hòa, nóng lạnh'],
  ['P303', 3, 30, 4800000, 4, 'Studio, bếp riêng'],
  ['P304', 3, 20, 3400000, 2, 'Cửa sổ hướng đường Giảng Võ'],
  ['P401', 4, 35, 5500000, 4, 'Căn hộ mini 1 phòng ngủ'],
  ['P402', 4, 32, 5200000, 4, 'Căn hộ mini, đang sơn sửa lại'],
];

const TENANTS = [
  ['Nguyễn Văn An', '0912345671', 'an.nguyen@gmail.com', '001201001234', '2002-03-15', 'Nam', 'Nam Định', 'Sinh viên'],
  ['Trần Thị Bình', '0912345672', 'binh.tran@gmail.com', '001301002345', '2001-07-22', 'Nữ', 'Thái Bình', 'Nhân viên văn phòng'],
  ['Lê Hoàng Cường', '0912345673', 'cuong.le@gmail.com', '001201003456', '1998-11-02', 'Nam', 'Hải Phòng', 'Kỹ sư phần mềm'],
  ['Phạm Thu Dung', '0912345674', 'dung.pham@gmail.com', '001301004567', '2003-01-09', 'Nữ', 'Nghệ An', 'Sinh viên'],
  ['Hoàng Minh Đức', '0912345675', 'duc.hoang@gmail.com', '001201005678', '1995-05-30', 'Nam', 'Hà Nam', 'Giáo viên'],
  ['Vũ Ngọc Hà', '0912345676', 'ha.vu@gmail.com', '001301006789', '1999-09-18', 'Nữ', 'Bắc Ninh', 'Kế toán'],
  ['Đỗ Quang Huy', '0912345677', 'huy.do@gmail.com', '001201007890', '2000-12-25', 'Nam', 'Thanh Hóa', 'Nhân viên kinh doanh'],
  ['Bùi Thị Lan', '0912345678', 'lan.bui@gmail.com', '001301008901', '1997-04-04', 'Nữ', 'Hưng Yên', 'Điều dưỡng'],
  ['Ngô Đức Mạnh', '0912345679', 'manh.ngo@gmail.com', '001201009012', '1993-08-12', 'Nam', 'Phú Thọ', 'Kiến trúc sư'],
  ['Đặng Thị Ngọc', '0912345680', 'ngoc.dang@gmail.com', '001301000123', '2002-06-06', 'Nữ', 'Vĩnh Phúc', 'Sinh viên'],
  ['Phan Văn Quân', '0912345681', 'quan.phan@gmail.com', '001201001122', '1996-02-14', 'Nam', 'Ninh Bình', 'Lập trình viên'],
];

// [chỉ số phòng, chỉ số người thuê, số tháng trước khi bắt đầu, thời hạn (tháng), số người ở]
const CONTRACTS = [
  [0, 0, 10, 12, 1], [1, 1, 8, 12, 2], [2, 2, 14, 15, 1], [4, 3, 6, 12, 2], [5, 4, 11, 12, 2],
  [7, 5, 5, 12, 3], [8, 6, 9, 12, 2], [9, 7, 4, 6, 1], [10, 8, 12, 24, 3], [12, 9, 7, 12, 3],
];

export async function seedIfEmpty() {
  const { rows } = await query('SELECT COUNT(*)::int AS n FROM users');
  if (rows[0].n > 0) return false;
  await seed();
  return true;
}

export async function seed() {
  const now = new Date();
  const curPeriod = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
  const p1 = prevPeriod(curPeriod);
  const p2 = prevPeriod(p1);
  const p3 = prevPeriod(p2);
  const adminHash = await bcrypt.hash('admin123', 10);
  const tenantHash = await bcrypt.hash('123456', 10);

  await transaction(async (tx) => {
    const admin = (await tx.query(
      `INSERT INTO users (username, password_hash, full_name, phone, email, role)
       VALUES ('admin', $1, 'Chủ nhà 57 Giảng Võ', '0988000057', 'chunha57@gmail.com', 'admin') RETURNING id`,
      [adminHash],
    )).rows[0];

    await tx.query(
      `INSERT INTO services (name, price, unit, description) VALUES
       ('Internet', 100000, 'room', 'Wifi cáp quang 100Mbps'),
       ('Vệ sinh', 30000, 'person', 'Thu gom rác, vệ sinh hành lang'),
       ('Gửi xe máy', 120000, 'person', 'Gửi xe tại tầng 1, có camera')`,
    );

    const roomIds = [];
    for (const [code, floor, area, price, maxOcc, desc] of ROOMS) {
      const status = code === 'P402' ? 'maintenance' : 'available';
      const r = await tx.query(
        `INSERT INTO rooms (code, floor, area, base_price, max_occupants, description, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [code, floor, area, price, maxOcc, desc, status],
      );
      roomIds.push(r.rows[0].id);
    }

    const tenantIds = [];
    for (let i = 0; i < TENANTS.length; i += 1) {
      const [name, phone, email, idCard, birth, gender, hometown, job] = TENANTS[i];
      const u = await tx.query(
        `INSERT INTO users (username, password_hash, full_name, phone, email, role)
         VALUES ($1, $2, $3, $4, $5, 'tenant') RETURNING id`,
        [`tenant${pad2(i + 1)}`, tenantHash, name, phone, email],
      );
      const t = await tx.query(
        `INSERT INTO tenants (user_id, full_name, phone, email, id_card, birth_date, gender, hometown, occupation)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
        [u.rows[0].id, name, phone, email, idCard, birth, gender, hometown, job],
      );
      tenantIds.push(t.rows[0].id);
    }

    // Hợp đồng đang hiệu lực
    for (const [ri, ti, monthsAgo, duration, occupants] of CONTRACTS) {
      const start = addMonths(now, -monthsAgo, 1);
      const startDate = new Date(start);
      const end = addMonths(startDate, duration, 1);
      const c = await tx.query(
        `INSERT INTO contracts (room_id, tenant_id, start_date, end_date, monthly_rent, deposit, payment_day, occupants, terms)
         SELECT $1, $2, $3, $4, base_price, base_price, 5, $5,
                'Thanh toán trước ngày 5 hằng tháng. Không nuôi thú cưng. Giữ vệ sinh chung. Báo trước 30 ngày khi trả phòng.'
         FROM rooms WHERE id = $1 RETURNING id`,
        [roomIds[ri], tenantIds[ti], start, end, occupants],
      );
      await tx.query(
        `UPDATE contracts SET code = 'HD' || to_char(start_date, 'YYYY') || '-' || lpad(id::text, 4, '0') WHERE id = $1`,
        [c.rows[0].id],
      );
      await tx.query("UPDATE rooms SET status = 'occupied' WHERE id = $1", [roomIds[ri]]);
    }

    // Hợp đồng đã kết thúc (lịch sử) - người thuê đã chuyển đi
    const oldStart = addMonths(now, -18, 1);
    const oldEnd = addMonths(now, -6, 1);
    const old = await tx.query(
      `INSERT INTO contracts (room_id, tenant_id, start_date, end_date, monthly_rent, deposit, payment_day, occupants, status, ended_at, end_reason)
       VALUES ($1, $2, $3, $4, 3700000, 3700000, 5, 2, 'ended', $4, 'Hết hạn hợp đồng, khách chuyển công tác') RETURNING id`,
      [roomIds[3], tenantIds[10], oldStart, oldEnd],
    );
    await tx.query(
      `UPDATE contracts SET code = 'HD' || to_char(start_date, 'YYYY') || '-' || lpad(id::text, 4, '0') WHERE id = $1`,
      [old.rows[0].id],
    );
    await tx.query("UPDATE tenants SET status = 'moved_out' WHERE id = $1", [tenantIds[10]]);

    // Chỉ số điện nước 3 kỳ gần nhất
    for (const [ri] of CONTRACTS) {
      let elec = between(1200, 4800);
      let water = between(80, 400);
      for (const period of [p3, p2, p1]) {
        const e2 = elec + between(70, 210);
        const w2 = water + between(3, 9);
        await tx.query(
          `INSERT INTO utility_readings (room_id, period, elec_old, elec_new, water_old, water_new, elec_price, water_price, recorded_at)
           VALUES ($1, $2, $3, $4, $5, $6, 3500, 25000, $7)`,
          [roomIds[ri], period, elec, e2, water, w2, `${nextPeriod(period)}-01 09:00:00+07`],
        );
        elec = e2;
        water = w2;
      }
    }

    // Hóa đơn và thanh toán
    for (const period of [p3, p2, p1]) {
      const { created } = await generateInvoices(tx, {
        period, issueDate: `${nextPeriod(period)}-01`, notify: period === p1,
      });
      for (let i = 0; i < created.length; i += 1) {
        const inv = created[i];
        let amount = inv.total;
        if (period === p1) {
          if (i % 3 === 1) amount = Math.round(inv.total / 2 / 1000) * 1000; // trả một phần
          else if (i % 3 === 2) continue; // chưa thanh toán
        }
        const paidDay = Math.min(between(1, 5), now.getDate());
        const paidAt = `${nextPeriod(period)}-${pad2(paidDay)} ${pad2(between(8, 20))}:${pad2(between(0, 59))}:00+07`;
        await tx.query(
          `INSERT INTO payments (invoice_id, amount, method, paid_at, note, confirmed_by)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [inv.id, amount, i % 2 ? 'transfer' : 'cash', paidAt, amount < inv.total ? 'Trả trước một phần' : null, admin.id],
        );
        await tx.query('UPDATE invoices SET paid_amount = $1, status = $2 WHERE id = $3', [
          amount, amount >= inv.total ? 'paid' : 'partial', inv.id,
        ]);
      }
    }

    // Báo cáo sự cố
    const incidents = [
      [0, 0, 'Điều hòa không mát', 'Điều hòa chạy nhưng không ra hơi lạnh, có tiếng kêu lạ.', 'electric', 'high', 'pending', null],
      [3, 3, 'Vòi nước bồn rửa bị rò rỉ', 'Vòi nước trong nhà tắm nhỏ giọt liên tục cả đêm.', 'water', 'medium', 'in_progress', 'Đã liên hệ thợ, dự kiến sửa trong tuần.'],
      [6, 6, 'Bóng đèn hành lang phòng bị cháy', 'Đèn trước cửa phòng không sáng.', 'electric', 'low', 'resolved', 'Đã thay bóng đèn LED mới.'],
      [9, 9, 'Wifi chập chờn buổi tối', 'Từ 20h-23h mạng rất chậm, hay mất kết nối.', 'internet', 'medium', 'pending', null],
      [1, 1, 'Khóa cửa bị kẹt', 'Ổ khóa cửa chính khó mở, phải xoay nhiều lần.', 'furniture', 'medium', 'resolved', 'Đã thay ổ khóa mới.'],
    ];
    for (const [ci, , title, desc, cat, pri, status, note] of incidents) {
      const [ri, ti] = CONTRACTS[ci];
      const t = await tx.query('SELECT user_id FROM tenants WHERE id = $1', [tenantIds[ti]]);
      const daysAgo = between(1, 20);
      await tx.query(
        `INSERT INTO incidents (room_id, tenant_id, reported_by, title, description, category, priority, status, admin_note,
                                created_at, updated_at, resolved_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW() - make_interval(days => $10::int),
                 NOW() - make_interval(days => $10::int), $11::timestamptz)`,
        [roomIds[ri], tenantIds[ti], t.rows[0].user_id, title, desc, cat, pri, status, note, daysAgo,
          status === 'resolved' ? new Date(Date.now() - (daysAgo - 1) * 86400000).toISOString() : null],
      );
    }

    await tx.query(
      `INSERT INTO notifications (user_id, title, message, type, link) VALUES
       ($1, 'Chào mừng đến với hệ thống quản lý Nhà 57 Giảng Võ', 'Dữ liệu mẫu đã được khởi tạo. Bạn có thể bắt đầu quản lý phòng, người thuê và hóa đơn.', 'general', '/'),
       ($1, 'Sự cố mới tại phòng P101', 'Nguyễn Văn An: Điều hòa không mát', 'incident', '/incidents'),
       ($1, 'Sự cố mới tại phòng P303', 'Đặng Thị Ngọc: Wifi chập chờn buổi tối', 'incident', '/incidents')`,
      [admin.id],
    );
  });
  console.log('✔ Đã khởi tạo dữ liệu mẫu (admin/admin123, tenant01..tenant11/123456)');
}
