# QuickSlot (backend)

REST API for the QuickSlot booking app. Node + Express on top of Postgres (hosted
on Neon). The one thing it has to get right is that a slot can't be booked twice,
even if two people tap "book" at the same instant. That's handled in the database
rather than in app code, which I'll explain below.

It's deployed at https://venuebackend.vercel.app and runs the same locally.

## Running it locally

```bash
npm install
cp .env.example .env        # put your DATABASE_URL in here
npm run setup               # creates the schema and seeds 3 users + 4 venues
npm start                   # http://localhost:3000
```

`npm run dev` runs it with auto-reload. `npm run test:concurrency` fires 8
bookings at the same slot at once and checks that exactly one succeeds.

## How it's structured

Three layers, dependencies pointing one way: `routes → services → db`. Routes only
deal with HTTP (validate the input, call a service, turn the result or error into a
status code). Services hold the actual logic and the SQL. `db/pool` owns the single
shared connection pool.

Slots themselves aren't stored as rows. Only bookings live in the database, and the
available/booked grid for a date is worked out by taking the hourly range (6 AM to
10 PM) and subtracting the slots that are already booked. Keeps the schema small.

## Preventing double-booking

This is enforced by the database with a partial unique index:

```sql
CREATE UNIQUE INDEX uniq_active_booking
  ON bookings (venue_id, slot_date, start_hour)
  WHERE status = 'booked';
```

A booking is a single `INSERT`. If two requests try to book the same slot at the
same time, both reach Postgres, one commits and the other hits a unique violation
(error `23505`), which the API returns as a 409. There's no "read, check if free,
then write" gap where a race could slip through. Cancelling just sets the status to
`cancelled`, and since the index only covers `booked` rows, the slot opens back up.

## Endpoints

| Method | Path | Notes |
|---|---|---|
| POST | `/auth/request-otp` | `{mobile}`; creates the user if new, returns a 6-digit OTP (no SMS, returned in the response) and `is_new_user` |
| POST | `/auth/verify-otp` | `{mobile, otp}`; returns the user, 401 if the OTP is wrong or expired |
| PATCH | `/users/:id` | `{name}`; sets the display name for a new user |
| GET | `/venues` | list of venues |
| GET | `/venues/:id/slots?date=YYYY-MM-DD` | the hourly slots for that date with their status |
| POST | `/bookings` | `{venue_id, date, start_hour}` + `X-User-Id` header; 201 / 409 / 400 / 401 / 404 |
| GET | `/users/:id/bookings` | that user's bookings, active ones first |
| DELETE | `/bookings/:id` | `X-User-Id` header; cancels your own booking; 204 / 403 / 404 |

Auth is deliberately light, which the brief allows. Originally it was just the
`X-User-Id` header against seeded users; I later added mobile + OTP login on top.

## What I cut, and why

- Slots aren't stored, only generated. It keeps the schema to a few tables and
  makes availability a simple diff. A real system with per-slot pricing or holds
  would store them.
- No heavy auth. The brief says to keep it light, and the header plus OTP is enough
  to attribute bookings and stop you cancelling someone else's.

## With one more day

- A short-lived "hold" on a slot between confirm and payment, with an expiry.
- Rate limiting, proper request logging, and an integration test suite (supertest).
- A real migrations tool instead of applying one `schema.sql`.

## Where I used AI, and what it got wrong

I used AI to scaffold the layout, the routes, and the concurrency design, then
reviewed it. The bug it introduced that I had to fix: `DATE` columns were coming
back as full timestamps like `2031-05-04T18:30:00.000Z`, because node-postgres
parses them into local-time JS `Date`s that shift back a day when serialized to UTC
under IST. The dates then didn't match what the app was sending. I fixed it with a
pg type parser for the `DATE` type (OID 1082) that returns the raw `YYYY-MM-DD`
string, so the dates line up with the client exactly.

## Deploying (Vercel)

The Express app is exported as a serverless function from `api/index.js`, and
`vercel.json` rewrites every route to it. `DATABASE_URL` is set as a Vercel
environment variable (using Neon's pooled `-pooler` host, which suits serverless).
The schema and seed are run once from local against the same database.
