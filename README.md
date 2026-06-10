# QuickSlot — Backend

Concurrency-safe REST API for booking sports slots (badminton courts / turf grounds).
Node.js + Express + Postgres (Neon).

## Setup

```bash
npm install
cp .env.example .env        # set DATABASE_URL (Neon or local Postgres)
npm run setup               # migrate + seed (3 users, 4 venues)
npm start                   # http://localhost:3000
```

`npm run dev` for auto-reload. `npm run test:concurrency` fires 8 simultaneous
bookings at one slot and asserts exactly one wins.

## Architecture (one paragraph)

Layered `routes → services → db`. Routes do HTTP only (validate input, map
results/errors to status codes); services hold business logic + parameterized
SQL; `db/pool` owns the single shared connection pool. **Slots are generated, not
stored** — only bookings persist, and the available/booked grid is computed by
diffing the hourly 6AM–10PM range against active bookings for a date.

### Concurrency approach (the hard rule)

A slot can never be double-booked. Enforced at the **database**, not the app:

```sql
CREATE UNIQUE INDEX uniq_active_booking
  ON bookings (venue_id, slot_date, start_hour)
  WHERE status = 'booked';
```

Booking is a single atomic `INSERT`. Two simultaneous inserts for the same slot
race inside Postgres — exactly one commits, the other raises a unique violation
(`23505`), which the API maps to **HTTP 409**. There is no "check then insert"
window. Cancelling sets `status='cancelled'`, which the partial index ignores, so
the slot frees up for re-booking.

## API

| Method | Path | Notes |
|---|---|---|
| POST | `/auth/request-otp` | `{mobile}` → find-or-create user, returns 6-digit OTP (demo) + `is_new_user` |
| POST | `/auth/verify-otp` | `{mobile,otp}` → authenticated user; 401 on wrong/expired |
| PATCH | `/users/:id` | `{name}` → set display name for a new user |
| GET | `/venues` | list venues |
| GET | `/venues/:id/slots?date=YYYY-MM-DD` | hourly slots with status |
| POST | `/bookings` | body `{venue_id,date,start_hour}`, header `X-User-Id`; 201 / 409 / 400 / 401 / 404 |
| GET | `/users` | selectable users (login screen) |
| GET | `/users/:id/bookings` | a user's bookings (active first) |
| DELETE | `/bookings/:id` | header `X-User-Id`; cancel own booking; 204 / 403 / 404 |

Auth is intentionally light: hardcoded/seeded users + `X-User-Id` header.

## What I cut and why

- **No pre-materialized slot rows** — generating them keeps the schema to 3 tables
  and makes availability a trivial diff. A real system with per-slot pricing/holds
  would materialize them.
- **No real auth** — explicitly allowed by the brief; `X-User-Id` is enough to
  attribute and authorize cancels.

## What I'd do with one more day

- Optimistic-lock or short-lived "hold" before confirm, with expiry.
- Rate limiting + request logging; integration test suite (supertest).
- Migrations tool (node-pg-migrate) instead of a single `schema.sql`.

## AI usage note

AI scaffolded the layered structure, routes, and the concurrency design. **One
thing it got wrong that I caught:** `DATE` columns were being returned as full
timestamps (`2031-05-04T18:30:00.000Z`) — node-postgres parsed them into local-time
JS `Date`s that shifted a day backward when JSON-serialized to UTC under IST. I
fixed it with a pg type parser for OID 1082 that returns the raw `YYYY-MM-DD`
string, so slot dates match the Flutter client's date param exactly.

## Deploy (Vercel)

Express is exported as a serverless function from `api/index.js`; `vercel.json`
rewrites all routes to it. Set `DATABASE_URL` as a Vercel env var (use Neon's
pooled `-pooler` host for serverless). The DB is migrated/seeded once from local.
