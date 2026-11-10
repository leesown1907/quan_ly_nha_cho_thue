-- =========================================================
--  CSDL Phần mềm quản lý nhà cho thuê - Nhà 57 Giảng Võ
-- =========================================================

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
-- Mỗi phòng chỉ có tối đa 1 hợp đồng đang hiệu lực
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
  period       CHAR(7) NOT NULL,             -- YYYY-MM
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
