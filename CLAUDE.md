# QuickSlot Backend — AI / Engineering Rules

These rules are binding for any change in this repo. Follow them; don't drift.

## API Architecture

- **Layered, one direction of dependency:** `routes → services → db`. Routes never
  touch SQL; services never touch `req`/`res`. The `db/pool` is the only place
  that opens connections.
  - `routes/` — HTTP only: parse/validate input, call a service, map result/errors
    to status codes. No SQL, no business rules.
  - `services/` — business logic + SQL. Pure-ish: take plain args, return plain
    data or throw a typed `BookingError`. Never import `express`.
  - `db/` — pool, schema, migrate, seed. Single shared `Pool`.
  - `middleware/` — cross-cutting (auth via `X-User-Id`).
  - `utils/` — pure helpers (time/slot building, date validation). No I/O.
- **Errors:** services throw `BookingError(code, message)`; routes own the
  `code → HTTP status` map. Unexpected throws bubble to the central error handler
  in `app.js` → 500. Never send SQL errors to the client.
- **Status codes are a contract:** 200 read ok · 201 created · 204 deleted ·
  400 invalid input · 401 missing/unknown user · 403 not owner · 404 not found ·
  409 slot taken · 500 unexpected. Don't repurpose them.
- **Validation at the edge:** every route validates ids (positive int), dates
  (`isValidDate`, strict `YYYY-MM-DD`), and required body fields before calling a
  service. Reject early with 400.

## Concurrency (the hard rule — never weaken this)

- Double-booking is prevented by a **partial UNIQUE index**
  `(venue_id, slot_date, start_hour) WHERE status='booked'`, not by app-level
  checks. The `INSERT` is the gate.
- Booking creation must stay a single `INSERT` that relies on the DB to reject
  duplicates (`23505` → `SLOT_TAKEN` → 409). **Do not** add a "SELECT to check if
  free, then INSERT" pattern — that reintroduces the race.
- Cancel is a soft delete (`status='cancelled'`), which frees the slot because
  the index only covers `'booked'` rows. Keep it idempotent.

## Data model

- Slots are **generated**, not stored. Only `bookings` persist. Availability =
  generated hourly grid minus active bookings. Keep it that way unless there's a
  real reason to materialize slots.
- `DATE` columns are returned as raw `YYYY-MM-DD` strings (pg type parser for OID
  1082). Never reintroduce JS `Date` parsing for slot dates — it shifts days
  across timezones.

## Conventions

- CommonJS, `'use strict'`, async/await, parameterized queries **always** (`$1`,
  `$2` — never string-concatenate SQL).
- Seed and migrate are idempotent and re-runnable.
- Env via `.env` (gitignored); `.env.example` documents the shape. Secrets never
  committed.

## Endpoints (frozen contract the Flutter app depends on)

```
POST   /auth/request-otp   { mobile }          -> { user_id, mobile, otp, is_new_user, name }
POST   /auth/verify-otp    { mobile, otp }      -> { id, name, mobile, is_new_user } | 401
PATCH  /users/:id          { name }             -> { id, name, mobile } | 404
GET    /venues
GET    /venues/:id/slots?date=YYYY-MM-DD   -> { venue_id, date, slots:[...] }
POST   /bookings        body {venue_id,date,start_hour}  header X-User-Id  -> 201|400|401|404|409
GET    /users
GET    /users/:id/bookings
DELETE /bookings/:id    header X-User-Id  -> 204|401|403|404
```

Slot object: `{ venue_id, date, start_hour, start_time, end_time, status, booking_id }`.
