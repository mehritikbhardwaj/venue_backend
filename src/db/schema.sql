-- QuickSlot schema.
-- Slots themselves are NOT stored as rows; they are generated on the fly
-- (hourly 06:00–22:00) for any requested date. Only actual bookings persist.
-- This keeps the data model tiny and makes "available vs booked" a simple
-- left-anti-join against the bookings table.

CREATE TABLE IF NOT EXISTS users (
  id              SERIAL PRIMARY KEY,
  name            TEXT NOT NULL DEFAULT '',   -- empty until a new user sets it
  mobile          TEXT,                        -- 10-digit phone, login identity
  otp_code        TEXT,                        -- last issued OTP (demo: returned in API)
  otp_expires_at  TIMESTAMPTZ                  -- OTP validity window
);

-- Bring existing databases up to date (no-ops if already applied).
ALTER TABLE users ADD COLUMN IF NOT EXISTS mobile         TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_code       TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMPTZ;
ALTER TABLE users ALTER COLUMN name SET DEFAULT '';

-- One account per mobile number (NULLs allowed for legacy/seeded rows).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_user_mobile
  ON users (mobile) WHERE mobile IS NOT NULL;

CREATE TABLE IF NOT EXISTS venues (
  id        SERIAL PRIMARY KEY,
  name      TEXT NOT NULL,
  sport     TEXT NOT NULL,          -- 'Badminton' | 'Turf' | ...
  location  TEXT NOT NULL,
  open_hour  INT NOT NULL DEFAULT 6,   -- first bookable hour (inclusive)
  close_hour INT NOT NULL DEFAULT 22   -- end of last slot (exclusive start = 21:00)
);

CREATE TABLE IF NOT EXISTS bookings (
  id          SERIAL PRIMARY KEY,
  venue_id    INT  NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  user_id     INT  NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  slot_date   DATE NOT NULL,
  start_hour  INT  NOT NULL,                       -- 6..21
  status      TEXT NOT NULL DEFAULT 'booked',      -- 'booked' | 'cancelled'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- THE concurrency guarantee.
-- At most one ACTIVE ('booked') booking can exist for a given
-- (venue, date, hour). Two simultaneous INSERTs race at the DB:
-- exactly one commits, the other raises unique_violation (SQLSTATE 23505),
-- which the API translates into HTTP 409. Cancelled rows are excluded by the
-- partial predicate, so a freed slot can be re-booked.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_booking
  ON bookings (venue_id, slot_date, start_hour)
  WHERE status = 'booked';
