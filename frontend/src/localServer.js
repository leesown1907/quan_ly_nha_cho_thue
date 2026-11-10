import { PGlite } from '@electric-sql/pglite';

const DATE_OID = 1082;

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id             SERIAL PRIMARY KEY,
  username       VARCHAR(50)  NOT NULL UNIQUE,
  password_hash  TEXT         NOT NULL,
  full_name      VARCHAR(120) NOT NULL,
  phone          VARCHAR(20),
  email          VARCHAR(120),
  role           VARCHAR(10)  NOT NULL CHECK (role IN ('admin', 'tenant')),
  is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
  token_version  INTEGER      NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenants (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  full_name   VARCHAR(120) NOT NULL,
  phone       VARCHAR(20)  NOT NULL,
  email       VARCHAR(120),
  id_card     VARCHAR(20),
  birth_date  DATE,
  gender      VARCHAR(10),
  hometown    VARCHAR(200),
  occupation  VARCHAR(100),
  note        TEXT,
  status      VARCHAR(12)  NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'moved_out')),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rooms (
  id             SERIAL PRIMARY KEY,
  code           VARCHAR(20) NOT NULL UNIQUE,
  floor          INTEGER     NOT NULL DEFAULT 1,
  area           REAL        NOT NULL CHECK (area > 0),
  base_price     INTEGER     NOT NULL CHECK (base_price >= 0),
  max_occupants  INTEGER     NOT NULL DEFAULT 2 CHECK (max_occupants > 0),
  status         VARCHAR(12) NOT NULL DEFAULT 'available'
                 CHECK (status IN ('available', 'occupied', 'maintenance')),
  description    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contracts (
  id            SERIAL PRIMARY KEY,
  code          VARCHAR(30) UNIQUE,
  room_id       INTEGER NOT NULL REFERENCES rooms(id),
  tenant_id     INTEGER NOT NULL REFERENCES tenants(id),
  start_date    DATE    NOT NULL,
  end_date      DATE    NOT NULL,
  monthly_rent  INTEGER NOT NULL CHECK (monthly_rent >= 0),
  deposit       INTEGER NOT NULL DEFAULT 0 CHECK (deposit >= 0),
  payment_day   INTEGER NOT NULL DEFAULT 5 CHECK (payment_day BETWEEN 1 AND 28),
  occupants     INTEGER NOT NULL DEFAULT 1 CHECK (occupants > 0),
  terms         TEXT,
  status        VARCHAR(10) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  ended_at      DATE,
  end_reason    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_date > start_date)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_contracts_active_room ON contracts(room_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_contracts_tenant ON contracts(tenant_id);

CREATE TABLE IF NOT EXISTS settings (
  key    VARCHAR(50) PRIMARY KEY,
  value  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS services (
  id           SERIAL PRIMARY KEY,
  name         VARCHAR(100) NOT NULL,
  price        INTEGER      NOT NULL CHECK (price >= 0),
  unit         VARCHAR(10)  NOT NULL DEFAULT 'room' CHECK (unit IN ('room', 'person')),
  description  TEXT,
  is_active    BOOLEAN      NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS utility_readings (
  id           SERIAL PRIMARY KEY,
  room_id      INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  period       CHAR(7) NOT NULL,
  elec_old     INTEGER NOT NULL CHECK (elec_old >= 0),
  elec_new     INTEGER NOT NULL,
  water_old    INTEGER NOT NULL CHECK (water_old >= 0),
  water_new    INTEGER NOT NULL,
  elec_price   INTEGER NOT NULL,
  water_price  INTEGER NOT NULL,
  recorded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (room_id, period),
  CHECK (elec_new >= elec_old),
  CHECK (water_new >= water_old)
);

CREATE TABLE IF NOT EXISTS invoices (
  id           SERIAL PRIMARY KEY,
  code         VARCHAR(40) UNIQUE,
  contract_id  INTEGER NOT NULL REFERENCES contracts(id),
  room_id      INTEGER NOT NULL REFERENCES rooms(id),
  period       CHAR(7) NOT NULL,
  issue_date   DATE    NOT NULL DEFAULT CURRENT_DATE,
  due_date     DATE    NOT NULL,
  total        INTEGER NOT NULL DEFAULT 0,
  paid_amount  INTEGER NOT NULL DEFAULT 0,
  status       VARCHAR(10) NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'partial', 'paid')),
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (contract_id, period)
);
CREATE INDEX IF NOT EXISTS idx_invoices_period ON invoices(period);

CREATE TABLE IF NOT EXISTS invoice_items (
  id           SERIAL PRIMARY KEY,
  invoice_id   INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  item_type    VARCHAR(15) NOT NULL CHECK (item_type IN ('rent', 'electricity', 'water', 'service', 'other')),
  description  TEXT    NOT NULL,
  quantity     REAL    NOT NULL DEFAULT 1,
  unit_price   INTEGER NOT NULL DEFAULT 0,
  amount       INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS payments (
  id            SERIAL PRIMARY KEY,
  invoice_id    INTEGER NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
  amount        INTEGER NOT NULL CHECK (amount > 0),
  method        VARCHAR(20) NOT NULL DEFAULT 'cash' CHECK (method IN ('cash', 'transfer', 'other')),
  paid_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  note          TEXT,
  confirmed_by  INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS incidents (
  id           SERIAL PRIMARY KEY,
  room_id      INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  tenant_id    INTEGER REFERENCES tenants(id) ON DELETE SET NULL,
  reported_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  title        VARCHAR(200) NOT NULL,
  description  TEXT,
  category     VARCHAR(30)  NOT NULL DEFAULT 'other',
  priority     VARCHAR(10)  NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status       VARCHAR(12)  NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'in_progress', 'resolved', 'rejected')),
  admin_note   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS notifications (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       VARCHAR(200) NOT NULL,
  message     TEXT,
  type        VARCHAR(20) NOT NULL DEFAULT 'general',
  link        VARCHAR(200),
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);

INSERT INTO settings (key, value) VALUES
  ('electricity_price', '3500'),
  ('water_price', '25000'),
  ('house_name', 'Nhà 57 Giảng Võ'),
  ('house_address', '57 Giảng Võ, Đống Đa, Hà Nội')
ON CONFLICT (key) DO NOTHING;
`;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const isBlank = (v) => v === undefined || v === null || String(v).trim() === '';
function requireFields(body, labels) {
  const missing = Object.entries(labels)
    .filter(([key]) => isBlank(body?.[key]))
    .map(([, label]) => label);
  if (missing.length) throw new HttpError(400, `Vui lòng nhập: ${missing.join(', ')}`);
}
function num(value, label, { min = 0, max, int = true, optional = false } = {}) {
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
const str = (v) => (isBlank(v) ? null : String(v).trim());
const isPeriod = (p) => /^\d{4}-(0[1-9]|1[0-2])$/.test(p || '');
const isDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '') && !Number.isNaN(Date.parse(d));
function oneOf(value, allowed, label) {
  if (!allowed.includes(value)) throw new HttpError(400, `${label} không hợp lệ`);
  return value;
}
function where() {
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
function tenantIdOf(user) {
  if (!user.tenant_id) throw new HttpError(403, 'Tài khoản chưa được liên kết với hồ sơ người thuê');
  return user.tenant_id;
}
const pad2 = (n) => String(n).padStart(2, '0');
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};
const periodLabel = (p) => `${p.slice(5, 7)}/${p.slice(0, 4)}`;
function nextPeriod(p) {
  let [y, m] = p.split('-').map(Number);
  m += 1;
  if (m > 12) { m = 1; y += 1; }
  return `${y}-${pad2(m)}`;
}
function prevPeriod(p) {
  let [y, m] = p.split('-').map(Number);
  m -= 1;
  if (m < 1) { m = 12; y -= 1; }
  return `${y}-${pad2(m)}`;
}
const formatVnd = (n) => `${Number(n || 0).toLocaleString('vi-VN')} đ`;

async function hashPw(pw) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`nha57:${pw}`));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

let dbInstance = null;
let initPromise = null;

async function getDb() {
  if (dbInstance) return dbInstance;
  if (!initPromise) {
    initPromise = (async () => {
      const db = new PGlite('idb://nha57-giangvo-db', { parsers: { [DATE_OID]: (v) => v } });
      await db.waitReady;
      await db.exec(SCHEMA_SQL);
      const { rows } = await db.query('SELECT COUNT(*)::int AS n FROM users');
      if (rows[0].n === 0) await seedDatabase(db);
      dbInstance = db;
      return db;
    })();
  }
  return initPromise;
}

export async function resetBrowserDb() {
  const db = await getDb();
  await db.exec('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await db.exec(SCHEMA_SQL);
  await seedDatabase(db);
}

async function notifyUser(q, userId, { title, message = null, type = 'general', link = null }) {
  if (!userId) return;
  await q.query('INSERT INTO notifications (user_id, title, message, type, link) VALUES ($1, $2, $3, $4, $5)', [
    userId, title, message, type, link,
  ]);
}
async function notifyTenant(q, tenantId, data) {
  const { rows } = await q.query('SELECT user_id FROM tenants WHERE id = $1', [tenantId]);
  if (rows[0]?.user_id) await notifyUser(q, rows[0].user_id, data);
}
async function notifyAdmins(q, { title, message = null, type = 'general', link = null }) {
  await q.query(
    `INSERT INTO notifications (user_id, title, message, type, link)
     SELECT id, $1, $2, $3, $4 FROM users WHERE role = 'admin' AND is_active`,
    [title, message, type, link],
  );
}
async function notifyActiveTenants(q, { title, message = null, type = 'general', link = null }) {
  await q.query(
    `INSERT INTO notifications (user_id, title, message, type, link)
     SELECT DISTINCT t.user_id, $1, $2, $3, $4
     FROM tenants t JOIN contracts c ON c.tenant_id = t.id AND c.status = 'active'
     WHERE t.user_id IS NOT NULL`,
    [title, message, type, link],
  );
}

async function getSettings(q) {
  const { rows } = await q.query('SELECT key, value FROM settings');
  const s = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    ...s,
    electricity_price: Number(s.electricity_price || 0),
    water_price: Number(s.water_price || 0),
  };
}

async function generateInvoices(q, { period, dueDate = null, issueDate = null, contractIds = null, notify = true }) {
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
    const items = [{ type: 'rent', desc: `Tiền phòng tháng ${label}`, qty: 1, price: c.monthly_rent }];
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
      await notifyUser(q, c.user_id, {
        title: `Hóa đơn tháng ${label} - Phòng ${c.room_code}`,
        message: `Tổng tiền ${formatVnd(total)}. Hạn thanh toán: ${due}.`,
        type: 'invoice',
        link: '/invoices',
      });
    }
    created.push({ ...inv, room_code: c.room_code, tenant_name: c.tenant_name });
  }
  return { created, missingReadings, existing };
}

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function seedDatabase(db) {
  const rand = mulberry32(57);
  const between = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
  const fmt = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const addMonths = (base, months, day = null) => {
    const d = new Date(base.getFullYear(), base.getMonth() + months, day ?? base.getDate());
    return fmt(d);
  };

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
  const CONTRACTS = [
    [0, 0, 10, 12, 1], [1, 1, 8, 12, 2], [2, 2, 14, 15, 1], [4, 3, 6, 12, 2], [5, 4, 11, 12, 2],
    [7, 5, 5, 12, 3], [8, 6, 9, 12, 2], [9, 7, 4, 6, 1], [10, 8, 12, 24, 3], [12, 9, 7, 12, 3],
  ];

  const now = new Date();
  const curPeriod = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
  const p1 = prevPeriod(curPeriod);
  const p2 = prevPeriod(p1);
  const p3 = prevPeriod(p2);
  const adminHash = await hashPw('admin123');
  const tenantHash = await hashPw('123456');

  await db.transaction(async (tx) => {
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

    for (const [ri, ti, monthsAgo, duration, occupants] of CONTRACTS) {
      const start = addMonths(now, -monthsAgo, 1);
      const end = addMonths(new Date(start), duration, 1);
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

    for (const period of [p3, p2, p1]) {
      const { created } = await generateInvoices(tx, {
        period, issueDate: `${nextPeriod(period)}-01`, notify: period === p1,
      });
      for (let i = 0; i < created.length; i += 1) {
        const inv = created[i];
        let amount = inv.total;
        if (period === p1) {
          if (i % 3 === 1) amount = Math.round(inv.total / 2 / 1000) * 1000;
          else if (i % 3 === 2) continue;
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
}

// ======================= Định tuyến cục bộ =======================

function matchRoute(pattern, pathname) {
  const pa = pattern.split('/').filter(Boolean);
  const pb = pathname.split('/').filter(Boolean);
  if (pa.length !== pb.length) return null;
  const params = {};
  for (let i = 0; i < pa.length; i += 1) {
    if (pa[i].startsWith(':')) params[pa[i].slice(1)] = pb[i];
    else if (pa[i] !== pb[i]) return null;
  }
  return params;
}

const ROOM_SELECT = `
  SELECT r.*, c.id AS contract_id, c.code AS contract_code, c.end_date AS contract_end_date,
         c.occupants, t.id AS tenant_id, t.full_name AS tenant_name, t.phone AS tenant_phone
  FROM rooms r
  LEFT JOIN contracts c ON c.room_id = r.id AND c.status = 'active'
  LEFT JOIN tenants t ON t.id = c.tenant_id`;

const TENANT_SELECT = `
  SELECT t.*, u.username, u.is_active AS account_active,
         c.id AS contract_id, c.code AS contract_code, rm.id AS room_id, rm.code AS room_code
  FROM tenants t
  LEFT JOIN users u ON u.id = t.user_id
  LEFT JOIN contracts c ON c.tenant_id = t.id AND c.status = 'active'
  LEFT JOIN rooms rm ON rm.id = c.room_id`;

const CONTRACT_SELECT = `
  SELECT c.*, r.code AS room_code, r.area AS room_area, r.floor AS room_floor,
         t.full_name AS tenant_name, t.phone AS tenant_phone, t.id_card AS tenant_id_card,
         (c.end_date - CURRENT_DATE) AS days_left
  FROM contracts c
  JOIN rooms r ON r.id = c.room_id
  JOIN tenants t ON t.id = c.tenant_id`;

const READING_SELECT = `
  SELECT ur.*, r.code AS room_code,
         (ur.elec_new - ur.elec_old) AS elec_usage,
         (ur.water_new - ur.water_old) AS water_usage,
         (ur.elec_new - ur.elec_old) * ur.elec_price AS elec_amount,
         (ur.water_new - ur.water_old) * ur.water_price AS water_amount,
         EXISTS (SELECT 1 FROM invoices i WHERE i.room_id = ur.room_id AND i.period = ur.period) AS invoiced
  FROM utility_readings ur JOIN rooms r ON r.id = ur.room_id`;

const INVOICE_SELECT = `
  SELECT i.*, (i.total - i.paid_amount) AS remaining,
         (i.status <> 'paid' AND i.due_date < CURRENT_DATE) AS overdue,
         r.code AS room_code, c.code AS contract_code, c.tenant_id,
         t.full_name AS tenant_name, t.phone AS tenant_phone, t.user_id AS tenant_user_id
  FROM invoices i
  JOIN contracts c ON c.id = i.contract_id
  JOIN rooms r ON r.id = i.room_id
  JOIN tenants t ON t.id = c.tenant_id`;

const INCIDENT_SELECT = `
  SELECT i.*, r.code AS room_code, t.full_name AS tenant_name, t.phone AS tenant_phone
  FROM incidents i
  JOIN rooms r ON r.id = i.room_id
  LEFT JOIN tenants t ON t.id = i.tenant_id`;

const USER_SELECT = `
  SELECT u.id, u.username, u.full_name, u.phone, u.email, u.role, u.is_active, u.created_at,
         t.id AS tenant_id, t.full_name AS tenant_name
  FROM users u LEFT JOIN tenants t ON t.user_id = u.id`;

export async function handleLocalApi(path, { method = 'GET', body = {}, params: qParams = {}, token }) {
  const db = await getDb();
  const [pathname, searchStr] = path.split('?');
  const query = { ...Object.fromEntries(new URLSearchParams(searchStr || '')), ...qParams };

  if (method === 'POST' && pathname === '/auth/login') {
    const { username, password } = body || {};
    if (!username || !password) throw new HttpError(400, 'Vui lòng nhập tên đăng nhập và mật khẩu');
    const hash = await hashPw(String(password));
    const { rows } = await db.query(
      `SELECT u.*, t.id AS tenant_id FROM users u LEFT JOIN tenants t ON t.user_id = u.id
       WHERE LOWER(u.username) = LOWER($1)`,
      [String(username).trim()],
    );
    const u = rows[0];
    if (!u || u.password_hash !== hash) throw new HttpError(401, 'Tên đăng nhập hoặc mật khẩu không đúng');
    if (!u.is_active) throw new HttpError(403, 'Tài khoản đã bị khóa, vui lòng liên hệ chủ nhà');
    const tk = `local.${u.id}.${u.token_version}`;
    return {
      token: tk,
      user: { id: u.id, username: u.username, full_name: u.full_name, phone: u.phone, email: u.email, role: u.role, tenant_id: u.tenant_id },
    };
  }

  // Xác thực token cục bộ
  if (!token || !token.startsWith('local.')) throw new HttpError(401, 'Bạn chưa đăng nhập');
  const [, uidStr, tvStr] = token.split('.');
  const { rows: uRows } = await db.query(
    `SELECT u.id, u.username, u.full_name, u.phone, u.email, u.role, u.is_active, u.token_version, t.id AS tenant_id
     FROM users u LEFT JOIN tenants t ON t.user_id = u.id WHERE u.id = $1`,
    [Number(uidStr)],
  );
  const user = uRows[0];
  if (!user || !user.is_active || user.token_version !== Number(tvStr)) {
    throw new HttpError(401, 'Phiên đăng nhập không còn hiệu lực');
  }
  const requireAdmin = () => {
    if (user.role !== 'admin') throw new HttpError(403, 'Bạn không có quyền thực hiện chức năng này');
  };

  let m;

  // AUTH
  if (method === 'GET' && pathname === '/auth/me') return { user };
  if (method === 'POST' && pathname === '/auth/logout') {
    await db.query('UPDATE users SET token_version = token_version + 1 WHERE id = $1', [user.id]);
    return { message: 'Đã đăng xuất' };
  }
  if (method === 'POST' && pathname === '/auth/change-password') {
    const { current_password, new_password } = body;
    if (!current_password || !new_password) throw new HttpError(400, 'Vui lòng nhập đầy đủ mật khẩu');
    if (String(new_password).length < 6) throw new HttpError(400, 'Mật khẩu mới phải có ít nhất 6 ký tự');
    const cur = (await db.query('SELECT * FROM users WHERE id = $1', [user.id])).rows[0];
    if (cur.password_hash !== (await hashPw(String(current_password)))) {
      throw new HttpError(400, 'Mật khẩu hiện tại không đúng');
    }
    const newHash = await hashPw(String(new_password));
    const up = (await db.query(
      'UPDATE users SET password_hash = $1, token_version = token_version + 1 WHERE id = $2 RETURNING *',
      [newHash, user.id],
    )).rows[0];
    return { message: 'Đổi mật khẩu thành công', token: `local.${up.id}.${up.token_version}` };
  }
  if (method === 'PUT' && pathname === '/auth/profile') {
    const full_name = str(body.full_name);
    if (!full_name) throw new HttpError(400, 'Vui lòng nhập họ tên');
    const phone = str(body.phone);
    const email = str(body.email);
    await db.query('UPDATE users SET full_name = $1, phone = $2, email = $3 WHERE id = $4', [full_name, phone, email, user.id]);
    if (user.tenant_id) {
      await db.query('UPDATE tenants SET phone = COALESCE($1, phone), email = $2 WHERE id = $3', [phone, email, user.tenant_id]);
    }
    return { message: 'Cập nhật thông tin thành công', user: { ...user, full_name, phone, email } };
  }

  // ROOMS
  if (method === 'GET' && pathname === '/rooms') {
    const w = where();
    if (user.role === 'tenant') {
      w.add((p) => `r.id IN (SELECT room_id FROM contracts WHERE tenant_id = ${p} AND status = 'active')`, tenantIdOf(user));
    }
    if (query.search) w.add((p) => `(r.code ILIKE ${p} OR r.description ILIKE ${p} OR t.full_name ILIKE ${p})`, `%${query.search}%`);
    if (query.status) w.add((p) => `r.status = ${p}`, query.status);
    if (query.floor) w.add((p) => `r.floor = ${p}`, Number(query.floor));
    return (await db.query(`${ROOM_SELECT} ${w.sql()} ORDER BY r.floor, r.code`, w.params)).rows;
  }
  if (method === 'GET' && (m = matchRoute('/rooms/:id', pathname))) {
    const id = Number(m.id);
    const room = (await db.query(`${ROOM_SELECT} WHERE r.id = $1`, [id])).rows[0];
    if (!room) throw new HttpError(404, 'Không tìm thấy phòng');
    const history = await db.query(
      `SELECT c.id, c.code, c.start_date, c.end_date, c.ended_at, c.status, c.monthly_rent, t.full_name AS tenant_name
       FROM contracts c JOIN tenants t ON t.id = c.tenant_id WHERE c.room_id = $1 ORDER BY c.start_date DESC`,
      [id],
    );
    return { ...room, contracts: history.rows };
  }
  if (method === 'POST' && pathname === '/rooms') {
    requireAdmin();
    requireFields(body, { code: 'Mã phòng', area: 'Diện tích', base_price: 'Giá thuê' });
    const status = body.status === 'maintenance' ? 'maintenance' : 'available';
    const { rows } = await db.query(
      `INSERT INTO rooms (code, floor, area, base_price, max_occupants, description, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [String(body.code).trim().toUpperCase(), num(body.floor ?? 1, 'Tầng'), num(body.area, 'Diện tích', { min: 1, int: false }),
        num(body.base_price, 'Giá thuê'), num(body.max_occupants ?? 2, 'Số người tối đa', { min: 1 }), str(body.description), status],
    );
    return rows[0];
  }
  if (method === 'PUT' && (m = matchRoute('/rooms/:id', pathname))) {
    requireAdmin();
    const id = Number(m.id);
    const status = oneOf(body.status || 'available', ['available', 'occupied', 'maintenance'], 'Trạng thái');
    const active = await db.query("SELECT id FROM contracts WHERE room_id = $1 AND status = 'active'", [id]);
    if (active.rows.length && status !== 'occupied') {
      throw new HttpError(409, 'Phòng đang có hợp đồng hiệu lực, không thể đổi trạng thái.');
    }
    const { rows } = await db.query(
      `UPDATE rooms SET code = $1, floor = $2, area = $3, base_price = $4, max_occupants = $5, description = $6, status = $7 WHERE id = $8 RETURNING *`,
      [String(body.code).trim().toUpperCase(), num(body.floor ?? 1, 'Tầng'), num(body.area, 'Diện tích', { min: 1, int: false }),
        num(body.base_price, 'Giá thuê'), num(body.max_occupants ?? 2, 'Số người tối đa', { min: 1 }), str(body.description), status, id],
    );
    return rows[0];
  }
  if (method === 'DELETE' && (m = matchRoute('/rooms/:id', pathname))) {
    requireAdmin();
    const id = Number(m.id);
    const room = (await db.query('SELECT * FROM rooms WHERE id = $1', [id])).rows[0];
    if (!room) throw new HttpError(404, 'Không tìm thấy phòng');
    if (room.status === 'occupied') throw new HttpError(409, 'Phòng đang cho thuê, không thể xóa');
    const used = await db.query('SELECT COUNT(*)::int AS n FROM contracts WHERE room_id = $1', [id]);
    if (used.rows[0].n > 0) throw new HttpError(409, 'Phòng đã có lịch sử hợp đồng nên không thể xóa');
    await db.query('DELETE FROM rooms WHERE id = $1', [id]);
    return { message: 'Đã xóa phòng' };
  }

  // TENANTS
  if (method === 'GET' && pathname === '/tenants/me') {
    return (await db.query(`${TENANT_SELECT} WHERE t.id = $1`, [tenantIdOf(user)])).rows[0] || null;
  }
  if (method === 'GET' && pathname === '/tenants') {
    requireAdmin();
    const w = where();
    if (query.search) w.add((p) => `(t.full_name ILIKE ${p} OR t.phone ILIKE ${p} OR t.id_card ILIKE ${p} OR rm.code ILIKE ${p})`, `%${query.search}%`);
    if (query.status) w.add((p) => `t.status = ${p}`, query.status);
    return (await db.query(`${TENANT_SELECT} ${w.sql()} ORDER BY t.status, t.full_name`, w.params)).rows;
  }
  if (method === 'GET' && (m = matchRoute('/tenants/:id', pathname))) {
    requireAdmin();
    const id = Number(m.id);
    const t = (await db.query(`${TENANT_SELECT} WHERE t.id = $1`, [id])).rows[0];
    const contracts = await db.query(
      `SELECT c.id, c.code, c.start_date, c.end_date, c.ended_at, c.status, c.monthly_rent, r.code AS room_code
       FROM contracts c JOIN rooms r ON r.id = c.room_id WHERE c.tenant_id = $1 ORDER BY c.start_date DESC`,
      [id],
    );
    return { ...t, contracts: contracts.rows };
  }
  if (method === 'POST' && pathname === '/tenants') {
    requireAdmin();
    requireFields(body, { full_name: 'Họ tên', phone: 'Số điện thoại' });
    let userId = null;
    if (body.create_account) {
      requireFields(body, { username: 'Tên đăng nhập', password: 'Mật khẩu' });
      const hash = await hashPw(String(body.password));
      const u = await db.query(
        `INSERT INTO users (username, password_hash, full_name, phone, email, role) VALUES ($1, $2, $3, $4, $5, 'tenant') RETURNING id`,
        [str(body.username), hash, str(body.full_name), str(body.phone), str(body.email)],
      );
      userId = u.rows[0].id;
    }
    const t = await db.query(
      `INSERT INTO tenants (full_name, phone, email, id_card, birth_date, gender, hometown, occupation, note, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [str(body.full_name), str(body.phone), str(body.email), str(body.id_card), str(body.birth_date), str(body.gender), str(body.hometown), str(body.occupation), str(body.note), userId],
    );
    return (await db.query(`${TENANT_SELECT} WHERE t.id = $1`, [t.rows[0].id])).rows[0];
  }
  if (method === 'PUT' && (m = matchRoute('/tenants/:id', pathname))) {
    requireAdmin();
    const id = Number(m.id);
    requireFields(body, { full_name: 'Họ tên', phone: 'Số điện thoại' });
    await db.query(
      `UPDATE tenants SET full_name = $1, phone = $2, email = $3, id_card = $4, birth_date = $5, gender = $6, hometown = $7, occupation = $8, note = $9 WHERE id = $10`,
      [str(body.full_name), str(body.phone), str(body.email), str(body.id_card), str(body.birth_date), str(body.gender), str(body.hometown), str(body.occupation), str(body.note), id],
    );
    return (await db.query(`${TENANT_SELECT} WHERE t.id = $1`, [id])).rows[0];
  }
  if (method === 'DELETE' && (m = matchRoute('/tenants/:id', pathname))) {
    requireAdmin();
    const id = Number(m.id);
    const c = (await db.query(
      `SELECT COUNT(*) FILTER (WHERE status = 'active')::int AS active, COUNT(*)::int AS total FROM contracts WHERE tenant_id = $1`,
      [id],
    )).rows[0];
    if (c.active > 0) throw new HttpError(409, 'Người thuê đang có hợp đồng hiệu lực, cần kết thúc hợp đồng trước');
    if (c.total > 0) {
      await db.query("UPDATE tenants SET status = 'moved_out' WHERE id = $1", [id]);
      return { archived: true, message: 'Người thuê có lịch sử hợp đồng nên đã chuyển sang "Đã chuyển đi"' };
    }
    await db.query('DELETE FROM tenants WHERE id = $1', [id]);
    return { archived: false, message: 'Đã xóa người thuê' };
  }
  if (method === 'POST' && (m = matchRoute('/tenants/:id/restore', pathname))) {
    requireAdmin();
    await db.query("UPDATE tenants SET status = 'active' WHERE id = $1", [Number(m.id)]);
    return { message: 'Đã khôi phục người thuê' };
  }

  // CONTRACTS
  if (method === 'GET' && pathname === '/contracts') {
    const w = where();
    if (user.role === 'tenant') w.add((p) => `c.tenant_id = ${p}`, tenantIdOf(user));
    if (query.search) w.add((p) => `(c.code ILIKE ${p} OR r.code ILIKE ${p} OR t.full_name ILIKE ${p})`, `%${query.search}%`);
    if (query.status) w.add((p) => `c.status = ${p}`, query.status);
    return (await db.query(`${CONTRACT_SELECT} ${w.sql()} ORDER BY c.status, c.start_date DESC`, w.params)).rows;
  }
  if (method === 'POST' && pathname === '/contracts') {
    requireAdmin();
    requireFields(body, { room_id: 'Phòng', tenant_id: 'Người thuê', start_date: 'Ngày bắt đầu', end_date: 'Ngày kết thúc' });
    const room = (await db.query('SELECT * FROM rooms WHERE id = $1', [Number(body.room_id)])).rows[0];
    if (!room || room.status !== 'available') throw new HttpError(409, 'Phòng không ở trạng thái trống');
    const c = (await db.query(
      `INSERT INTO contracts (room_id, tenant_id, start_date, end_date, monthly_rent, deposit, payment_day, occupants, terms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [room.id, Number(body.tenant_id), body.start_date, body.end_date, num(body.monthly_rent ?? room.base_price, 'Giá thuê'),
        num(body.deposit ?? 0, 'Tiền cọc'), num(body.payment_day ?? 5, 'Ngày TT'), num(body.occupants ?? 1, 'Số người ở', { min: 1 }), str(body.terms)],
    )).rows[0];
    await db.query(`UPDATE contracts SET code = 'HD' || to_char(start_date, 'YYYY') || '-' || lpad(id::text, 4, '0') WHERE id = $1`, [c.id]);
    await db.query("UPDATE rooms SET status = 'occupied' WHERE id = $1", [room.id]);
    await db.query("UPDATE tenants SET status = 'active' WHERE id = $1", [Number(body.tenant_id)]);
    return (await db.query(`${CONTRACT_SELECT} WHERE c.id = $1`, [c.id])).rows[0];
  }
  if (method === 'PUT' && (m = matchRoute('/contracts/:id', pathname))) {
    requireAdmin();
    const id = Number(m.id);
    await db.query(
      `UPDATE contracts SET end_date = $1, monthly_rent = $2, deposit = $3, occupants = $4, terms = $5 WHERE id = $6`,
      [body.end_date, num(body.monthly_rent, 'Giá thuê'), num(body.deposit, 'Tiền cọc'), num(body.occupants, 'Số người'), str(body.terms), id],
    );
    return (await db.query(`${CONTRACT_SELECT} WHERE c.id = $1`, [id])).rows[0];
  }
  if (method === 'POST' && (m = matchRoute('/contracts/:id/extend', pathname))) {
    requireAdmin();
    const id = Number(m.id);
    await db.query('UPDATE contracts SET end_date = $1, monthly_rent = $2 WHERE id = $3', [body.end_date, num(body.monthly_rent, 'Giá thuê'), id]);
    return (await db.query(`${CONTRACT_SELECT} WHERE c.id = $1`, [id])).rows[0];
  }
  if (method === 'POST' && (m = matchRoute('/contracts/:id/terminate', pathname))) {
    requireAdmin();
    const id = Number(m.id);
    const c = (await db.query('SELECT * FROM contracts WHERE id = $1', [id])).rows[0];
    await db.query("UPDATE contracts SET status = 'ended', ended_at = $1, end_reason = $2 WHERE id = $3", [
      body.ended_at || todayStr(), str(body.end_reason), id,
    ]);
    await db.query("UPDATE rooms SET status = 'available' WHERE id = $1", [c.room_id]);
    return (await db.query(`${CONTRACT_SELECT} WHERE c.id = $1`, [id])).rows[0];
  }

  // FEES
  if (method === 'GET' && pathname === '/fees') {
    const s = await getSettings(db);
    const sv = await db.query(`SELECT * FROM services ${user.role === 'tenant' ? 'WHERE is_active' : ''} ORDER BY is_active DESC, id`);
    return { ...s, services: sv.rows };
  }
  if (method === 'PUT' && pathname === '/fees/prices') {
    requireAdmin();
    const elec = num(body.electricity_price, 'Đơn giá điện');
    const water = num(body.water_price, 'Đơn giá nước');
    await db.query(
      `INSERT INTO settings (key, value) VALUES ('electricity_price', $1), ('water_price', $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [String(elec), String(water)],
    );
    await notifyActiveTenants(db, {
      title: 'Cập nhật đơn giá điện nước',
      message: `Điện: ${elec.toLocaleString('vi-VN')} đ/kWh, nước: ${water.toLocaleString('vi-VN')} đ/m³.`,
      type: 'fee',
      link: '/readings',
    });
    return getSettings(db);
  }
  if (method === 'POST' && pathname === '/fees/services') {
    requireAdmin();
    requireFields(body, { name: 'Tên dịch vụ', price: 'Đơn giá' });
    const { rows } = await db.query(
      'INSERT INTO services (name, price, unit, description, is_active) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [str(body.name), num(body.price, 'Đơn giá'), body.unit || 'room', str(body.description), body.is_active !== false],
    );
    return rows[0];
  }
  if (method === 'PUT' && (m = matchRoute('/fees/services/:id', pathname))) {
    requireAdmin();
    const { rows } = await db.query(
      'UPDATE services SET name = $1, price = $2, unit = $3, description = $4, is_active = $5 WHERE id = $6 RETURNING *',
      [str(body.name), num(body.price, 'Đơn giá'), body.unit || 'room', str(body.description), body.is_active !== false, Number(m.id)],
    );
    return rows[0];
  }
  if (method === 'DELETE' && (m = matchRoute('/fees/services/:id', pathname))) {
    requireAdmin();
    await db.query('DELETE FROM services WHERE id = $1', [Number(m.id)]);
    return { message: 'Đã xóa dịch vụ' };
  }

  // READINGS
  if (method === 'GET' && pathname === '/readings') {
    const w = where();
    if (user.role === 'tenant') {
      w.add((p) => `EXISTS (SELECT 1 FROM contracts c WHERE c.tenant_id = ${p} AND c.room_id = ur.room_id)`, tenantIdOf(user));
    }
    if (query.period) w.add((p) => `ur.period = ${p}`, query.period);
    return (await db.query(`${READING_SELECT} ${w.sql()} ORDER BY ur.period DESC, r.code`, w.params)).rows;
  }
  if (method === 'GET' && pathname === '/readings/sheet') {
    requireAdmin();
    const { period } = query;
    if (!isPeriod(period)) throw new HttpError(400, 'Kỳ không hợp lệ');
    const { rows } = await db.query(
      `SELECT r.id AS room_id, r.code AS room_code, r.status, t.full_name AS tenant_name,
              cur.id AS reading_id, cur.elec_old, cur.elec_new, cur.water_old, cur.water_new,
              prev.elec_new AS prev_elec, prev.water_new AS prev_water,
              EXISTS (SELECT 1 FROM invoices i WHERE i.room_id = r.id AND i.period = $1) AS invoiced
       FROM rooms r
       LEFT JOIN contracts c ON c.room_id = r.id AND c.status = 'active'
       LEFT JOIN tenants t ON t.id = c.tenant_id
       LEFT JOIN utility_readings cur ON cur.room_id = r.id AND cur.period = $1
       LEFT JOIN LATERAL (
         SELECT * FROM utility_readings p WHERE p.room_id = r.id AND p.period < $1 ORDER BY p.period DESC LIMIT 1
       ) prev ON TRUE
       ORDER BY (r.status = 'occupied') DESC, r.code`,
      [period],
    );
    return { period, ...(await getSettings(db)), rooms: rows };
  }
  if (method === 'POST' && pathname === '/readings') {
    requireAdmin();
    const roomId = num(body.room_id, 'Phòng', { min: 1 });
    const elecOld = num(body.elec_old, 'Điện cũ');
    const elecNew = num(body.elec_new, 'Điện mới');
    const waterOld = num(body.water_old, 'Nước cũ');
    const waterNew = num(body.water_new, 'Nước mới');
    if (elecNew < elecOld || waterNew < waterOld) throw new HttpError(400, 'Chỉ số mới phải >= chỉ số cũ');
    const s = await getSettings(db);
    const { rows } = await db.query(
      `INSERT INTO utility_readings (room_id, period, elec_old, elec_new, water_old, water_new, elec_price, water_price)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (room_id, period) DO UPDATE SET
         elec_old = EXCLUDED.elec_old, elec_new = EXCLUDED.elec_new,
         water_old = EXCLUDED.water_old, water_new = EXCLUDED.water_new,
         elec_price = EXCLUDED.elec_price, water_price = EXCLUDED.water_price, recorded_at = NOW()
       RETURNING id`,
      [roomId, body.period, elecOld, elecNew, waterOld, waterNew, s.electricity_price, s.water_price],
    );
    return (await db.query(`${READING_SELECT} WHERE ur.id = $1`, [rows[0].id])).rows[0];
  }
  if (method === 'DELETE' && (m = matchRoute('/readings/:id', pathname))) {
    requireAdmin();
    await db.query('DELETE FROM utility_readings WHERE id = $1', [Number(m.id)]);
    return { message: 'Đã xóa chỉ số' };
  }

  // INVOICES
  if (method === 'GET' && pathname === '/invoices') {
    const w = where();
    if (user.role === 'tenant') w.add((p) => `c.tenant_id = ${p}`, tenantIdOf(user));
    if (query.period) w.add((p) => `i.period = ${p}`, query.period);
    if (query.status === 'debt') w.raw(`i.status <> 'paid'`);
    else if (query.status) w.add((p) => `i.status = ${p}`, query.status);
    if (query.search) w.add((p) => `(i.code ILIKE ${p} OR r.code ILIKE ${p} OR t.full_name ILIKE ${p})`, `%${query.search}%`);
    const { rows } = await db.query(`${INVOICE_SELECT} ${w.sql()} ORDER BY i.period DESC, r.code`, w.params);
    const summary = rows.reduce(
      (s, i) => ({ total: s.total + i.total, paid: s.paid + i.paid_amount, remaining: s.remaining + Number(i.remaining) }),
      { total: 0, paid: 0, remaining: 0 },
    );
    return { items: rows, summary };
  }
  if (method === 'POST' && pathname === '/invoices/generate') {
    requireAdmin();
    const res = await generateInvoices(db, { period: body.period, dueDate: body.due_date || null });
    const parts = [`Đã tạo ${res.created.length} hóa đơn kỳ ${periodLabel(body.period)}`];
    if (res.existing) parts.push(`${res.existing} phòng đã có hóa đơn`);
    if (res.missingReadings.length) parts.push(`chưa ghi chỉ số: ${res.missingReadings.join(', ')}`);
    return { ...res, message: parts.join('; ') };
  }
  if (method === 'GET' && (m = matchRoute('/invoices/:id', pathname))) {
    const id = Number(m.id);
    const inv = (await db.query(`${INVOICE_SELECT} WHERE i.id = $1`, [id])).rows[0];
    const items = await db.query('SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY id', [id]);
    const payments = await db.query(
      `SELECT p.*, u.full_name AS confirmed_by_name FROM payments p LEFT JOIN users u ON u.id = p.confirmed_by WHERE p.invoice_id = $1 ORDER BY p.paid_at`,
      [id],
    );
    return { ...inv, items: items.rows, payments: payments.rows };
  }
  if (method === 'POST' && (m = matchRoute('/invoices/:id/payments', pathname))) {
    requireAdmin();
    const id = Number(m.id);
    const amount = num(body.amount, 'Số tiền', { min: 1 });
    const inv = (await db.query(
      `SELECT i.*, t.user_id FROM invoices i JOIN contracts c ON c.id = i.contract_id JOIN tenants t ON t.id = c.tenant_id WHERE i.id = $1`,
      [id],
    )).rows[0];
    await db.query(
      `INSERT INTO payments (invoice_id, amount, method, note, confirmed_by) VALUES ($1, $2, $3, $4, $5)`,
      [id, amount, body.method || 'transfer', str(body.note), user.id],
    );
    const paid = inv.paid_amount + amount;
    const status = paid >= inv.total ? 'paid' : 'partial';
    await db.query('UPDATE invoices SET paid_amount = $1, status = $2 WHERE id = $3', [paid, status, id]);
    await notifyUser(db, inv.user_id, {
      title: `Xác nhận thanh toán hóa đơn ${inv.code}`,
      message: `Chủ nhà đã xác nhận nhận ${formatVnd(amount)}.`,
      type: 'payment',
      link: '/invoices',
    });
    return handleLocalApi(`/invoices/${id}`, { method: 'GET', token });
  }
  if (method === 'DELETE' && (m = matchRoute('/invoices/:id', pathname))) {
    requireAdmin();
    await db.query('DELETE FROM invoices WHERE id = $1', [Number(m.id)]);
    return { message: 'Đã xóa hóa đơn' };
  }

  // PAYMENTS
  if (method === 'GET' && pathname === '/payments') {
    const w = where();
    if (user.role === 'tenant') w.add((p) => `c.tenant_id = ${p}`, tenantIdOf(user));
    if (query.method) w.add((p) => `p.method = ${p}`, query.method);
    if (query.from) w.add((p) => `p.paid_at >= ${p}::date`, query.from);
    if (query.to) w.add((p) => `p.paid_at < (${p}::date + 1)`, query.to);
    if (query.search) w.add((p) => `(i.code ILIKE ${p} OR r.code ILIKE ${p} OR t.full_name ILIKE ${p})`, `%${query.search}%`);
    const { rows } = await db.query(
      `SELECT p.*, i.code AS invoice_code, i.period, r.code AS room_code, t.full_name AS tenant_name, u.full_name AS confirmed_by_name
       FROM payments p JOIN invoices i ON i.id = p.invoice_id JOIN contracts c ON c.id = i.contract_id
       JOIN rooms r ON r.id = i.room_id JOIN tenants t ON t.id = c.tenant_id LEFT JOIN users u ON u.id = p.confirmed_by
       ${w.sql()} ORDER BY p.paid_at DESC`,
      w.params,
    );
    return { items: rows, total: rows.reduce((s, p) => s + p.amount, 0) };
  }

  // INCIDENTS
  if (method === 'GET' && pathname === '/incidents') {
    const w = where();
    if (user.role === 'tenant') w.add((p) => `i.tenant_id = ${p}`, tenantIdOf(user));
    if (query.status) w.add((p) => `i.status = ${p}`, query.status);
    if (query.priority) w.add((p) => `i.priority = ${p}`, query.priority);
    if (query.search) w.add((p) => `(i.title ILIKE ${p} OR r.code ILIKE ${p} OR t.full_name ILIKE ${p})`, `%${query.search}%`);
    return (await db.query(
      `${INCIDENT_SELECT} ${w.sql()}
       ORDER BY CASE i.status WHEN 'pending' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END, i.created_at DESC`,
      w.params,
    )).rows;
  }
  if (method === 'POST' && pathname === '/incidents') {
    const tenantId = tenantIdOf(user);
    const c = (await db.query(
      `SELECT c.room_id, r.code FROM contracts c JOIN rooms r ON r.id = c.room_id WHERE c.tenant_id = $1 AND c.status = 'active'`,
      [tenantId],
    )).rows[0];
    if (!c) throw new HttpError(409, 'Bạn không có hợp đồng đang hiệu lực');
    const ins = await db.query(
      `INSERT INTO incidents (room_id, tenant_id, reported_by, title, description, category, priority)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [c.room_id, tenantId, user.id, str(body.title), str(body.description), body.category || 'other', body.priority || 'medium'],
    );
    await notifyAdmins(db, { title: `Sự cố mới tại phòng ${c.room_code}`, message: `${user.full_name}: ${body.title}`, type: 'incident', link: '/incidents' });
    return (await db.query(`${INCIDENT_SELECT} WHERE i.id = $1`, [ins.rows[0].id])).rows[0];
  }
  if (method === 'PUT' && (m = matchRoute('/incidents/:id', pathname))) {
    requireAdmin();
    const id = Number(m.id);
    const inc = (await db.query(
      `UPDATE incidents SET status = $1, admin_note = $2, updated_at = NOW(),
              resolved_at = CASE WHEN $1 = 'resolved' THEN NOW() ELSE NULL END
       WHERE id = $3 RETURNING *`,
      [body.status, str(body.admin_note), id],
    )).rows[0];
    await notifyUser(db, inc.reported_by, { title: `Cập nhật sự cố "${inc.title}"`, message: inc.admin_note || null, type: 'incident', link: '/incidents' });
    return (await db.query(`${INCIDENT_SELECT} WHERE i.id = $1`, [id])).rows[0];
  }
  if (method === 'DELETE' && (m = matchRoute('/incidents/:id', pathname))) {
    await db.query('DELETE FROM incidents WHERE id = $1', [Number(m.id)]);
    return { message: 'Đã xóa báo cáo sự cố' };
  }

  // USERS
  if (method === 'GET' && pathname === '/users') {
    requireAdmin();
    const w = where();
    if (query.search) w.add((p) => `(u.username ILIKE ${p} OR u.full_name ILIKE ${p})`, `%${query.search}%`);
    if (query.role) w.add((p) => `u.role = ${p}`, query.role);
    return (await db.query(`${USER_SELECT} ${w.sql()} ORDER BY u.role, u.username`, w.params)).rows;
  }
  if (method === 'POST' && pathname === '/users') {
    requireAdmin();
    requireFields(body, { username: 'Tên đăng nhập', password: 'Mật khẩu', full_name: 'Họ tên', role: 'Vai trò' });
    const hash = await hashPw(String(body.password));
    const u = (await db.query(
      `INSERT INTO users (username, password_hash, full_name, phone, email, role) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [str(body.username), hash, str(body.full_name), str(body.phone), str(body.email), body.role],
    )).rows[0];
    if (body.role === 'tenant' && body.tenant_id) {
      await db.query('UPDATE tenants SET user_id = $1 WHERE id = $2', [u.id, Number(body.tenant_id)]);
    }
    return (await db.query(`${USER_SELECT} WHERE u.id = $1`, [u.id])).rows[0];
  }
  if (method === 'PUT' && (m = matchRoute('/users/:id', pathname))) {
    requireAdmin();
    const id = Number(m.id);
    if (body.password) {
      await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [await hashPw(String(body.password)), id]);
    }
    await db.query(
      'UPDATE users SET full_name = $1, phone = $2, email = $3, role = $4, is_active = $5 WHERE id = $6',
      [str(body.full_name), str(body.phone), str(body.email), body.role, body.is_active !== false, id],
    );
    await db.query('UPDATE tenants SET user_id = NULL WHERE user_id = $1', [id]);
    if (body.role === 'tenant' && body.tenant_id) {
      await db.query('UPDATE tenants SET user_id = $1 WHERE id = $2', [id, Number(body.tenant_id)]);
    }
    return (await db.query(`${USER_SELECT} WHERE u.id = $1`, [id])).rows[0];
  }
  if (method === 'DELETE' && (m = matchRoute('/users/:id', pathname))) {
    requireAdmin();
    await db.query('DELETE FROM users WHERE id = $1', [Number(m.id)]);
    return { message: 'Đã xóa tài khoản' };
  }

  // NOTIFICATIONS
  if (method === 'GET' && pathname === '/notifications') {
    const limit = Math.min(Number(query.limit) || 50, 200);
    const unread = query.unread === '1';
    const items = await db.query(
      `SELECT * FROM notifications WHERE user_id = $1 ${unread ? 'AND NOT is_read' : ''} ORDER BY created_at DESC LIMIT ${limit}`,
      [user.id],
    );
    const cnt = await db.query('SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = $1 AND NOT is_read', [user.id]);
    return { items: items.rows, unread: cnt.rows[0].n };
  }
  if (method === 'PUT' && pathname === '/notifications/read-all') {
    await db.query('UPDATE notifications SET is_read = TRUE WHERE user_id = $1', [user.id]);
    return { message: 'OK' };
  }
  if (method === 'PUT' && (m = matchRoute('/notifications/:id/read', pathname))) {
    await db.query('UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2', [Number(m.id), user.id]);
    return { message: 'OK' };
  }
  if (method === 'DELETE' && (m = matchRoute('/notifications/:id', pathname))) {
    await db.query('DELETE FROM notifications WHERE id = $1 AND user_id = $2', [Number(m.id), user.id]);
    return { message: 'OK' };
  }

  // STATS
  if (method === 'GET' && pathname === '/stats/dashboard') {
    requireAdmin();
    const d = new Date();
    const defFrom = `${d.getFullYear()}-${pad2(d.getMonth() - 4 > 0 ? d.getMonth() - 4 : 1)}-01`;
    const from = query.from || defFrom;
    const to = query.to || todayStr();
    const [rooms, tenants, money, debt, monthly, expiring, incidents, debtors, incidentStats] = await Promise.all([
      db.query(`SELECT COUNT(*)::int AS total,
                       COUNT(*) FILTER (WHERE status = 'available')::int AS available,
                       COUNT(*) FILTER (WHERE status = 'occupied')::int AS occupied,
                       COUNT(*) FILTER (WHERE status = 'maintenance')::int AS maintenance FROM rooms`),
      db.query(`SELECT COUNT(*) FILTER (WHERE status = 'active')::int AS active, COUNT(*)::int AS total FROM tenants`),
      db.query(
        `SELECT
           COALESCE((SELECT SUM(amount) FROM payments WHERE paid_at >= $1::date AND paid_at < ($2::date + 1)), 0)::float8 AS revenue,
           COALESCE((SELECT SUM(total) FROM invoices WHERE period >= to_char($1::date, 'YYYY-MM') AND period <= to_char($2::date, 'YYYY-MM')), 0)::float8 AS invoiced`,
        [from, to],
      ),
      db.query(`SELECT COALESCE(SUM(total - paid_amount), 0)::float8 AS amount, COUNT(*)::int AS count,
                       COUNT(*) FILTER (WHERE due_date < CURRENT_DATE)::int AS overdue_count
                FROM invoices WHERE status <> 'paid'`),
      db.query(
        `SELECT to_char(m, 'YYYY-MM') AS month,
                COALESCE((SELECT SUM(total) FROM invoices WHERE period = to_char(m, 'YYYY-MM')), 0)::float8 AS invoiced,
                COALESCE((SELECT SUM(amount) FROM payments WHERE to_char(paid_at, 'YYYY-MM') = to_char(m, 'YYYY-MM')), 0)::float8 AS collected
         FROM generate_series(date_trunc('month', $1::date), date_trunc('month', $2::date), interval '1 month') AS m ORDER BY m`,
        [from, to],
      ),
      db.query(`SELECT c.id, c.code, c.end_date, (c.end_date - CURRENT_DATE) AS days_left, r.code AS room_code, t.full_name AS tenant_name
                FROM contracts c JOIN rooms r ON r.id = c.room_id JOIN tenants t ON t.id = c.tenant_id
                WHERE c.status = 'active' AND c.end_date <= CURRENT_DATE + 30 ORDER BY c.end_date LIMIT 10`),
      db.query(`SELECT i.id, i.title, i.priority, i.status, i.created_at, r.code AS room_code
                FROM incidents i JOIN rooms r ON r.id = i.room_id
                WHERE i.status IN ('pending', 'in_progress') ORDER BY i.created_at DESC LIMIT 6`),
      db.query(`SELECT r.code AS room_code, t.full_name AS tenant_name, SUM(i.total - i.paid_amount)::float8 AS debt, COUNT(*)::int AS invoices
                FROM invoices i JOIN contracts c ON c.id = i.contract_id JOIN rooms r ON r.id = i.room_id JOIN tenants t ON t.id = c.tenant_id
                WHERE i.status <> 'paid' GROUP BY r.code, t.full_name ORDER BY debt DESC LIMIT 6`),
      db.query(`SELECT COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
                       COUNT(*) FILTER (WHERE status = 'in_progress')::int AS in_progress,
                       COUNT(*) FILTER (WHERE status = 'resolved')::int AS resolved FROM incidents`),
    ]);
    return {
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
    };
  }
  if (method === 'GET' && pathname === '/stats/tenant') {
    const tenantId = tenantIdOf(user);
    const [contract, debt, latestInvoice, latestReading, incidents] = await Promise.all([
      db.query(
        `SELECT c.*, r.code AS room_code, r.area, r.floor, r.max_occupants, (c.end_date - CURRENT_DATE) AS days_left
         FROM contracts c JOIN rooms r ON r.id = c.room_id WHERE c.tenant_id = $1 AND c.status = 'active' LIMIT 1`,
        [tenantId],
      ),
      db.query(
        `SELECT COALESCE(SUM(i.total - i.paid_amount), 0)::float8 AS amount, COUNT(*)::int AS count, MIN(i.due_date) AS nearest_due
         FROM invoices i JOIN contracts c ON c.id = i.contract_id WHERE c.tenant_id = $1 AND i.status <> 'paid'`,
        [tenantId],
      ),
      db.query(
        `SELECT i.*, (i.total - i.paid_amount) AS remaining FROM invoices i JOIN contracts c ON c.id = i.contract_id
         WHERE c.tenant_id = $1 ORDER BY i.period DESC LIMIT 1`,
        [tenantId],
      ),
      db.query(
        `SELECT ur.*, (ur.elec_new - ur.elec_old) AS elec_usage, (ur.water_new - ur.water_old) AS water_usage
         FROM utility_readings ur JOIN contracts c ON c.room_id = ur.room_id AND c.status = 'active'
         WHERE c.tenant_id = $1 ORDER BY ur.period DESC LIMIT 6`,
        [tenantId],
      ),
      db.query(
        `SELECT COUNT(*) FILTER (WHERE status IN ('pending', 'in_progress'))::int AS open, COUNT(*)::int AS total
         FROM incidents WHERE tenant_id = $1`,
        [tenantId],
      ),
    ]);
    return {
      contract: contract.rows[0] || null,
      debt: debt.rows[0],
      latest_invoice: latestInvoice.rows[0] || null,
      readings: latestReading.rows.reverse(),
      incidents: incidents.rows[0],
    };
  }

  throw new HttpError(404, `Không tìm thấy API: ${method} ${pathname}`);
}
