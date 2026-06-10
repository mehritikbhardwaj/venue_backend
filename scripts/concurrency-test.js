'use strict';

// Fires N simultaneous POST /bookings for the SAME slot and asserts that
// exactly one returns 201 and the rest return 409. This is the automated
// version of the live two-phone double-booking test.
const BASE = process.env.BASE_URL || 'http://localhost:3000';
const N = Number(process.env.N || 8);

async function main() {
  // Pick a far-future date so repeated runs don't collide with demo data...
  const date = '2030-01-01';
  const venueId = 1;
  const startHour = 9;

  // Clean any prior winner from a previous run by cancelling it.
  // (Best-effort: list user 1's bookings and cancel matching ones.)
  const existing = await fetch(`${BASE}/users/1/bookings`).then((r) => r.json());
  for (const b of existing) {
    if (b.venue_id === venueId && b.slot_date.startsWith(date) && b.start_hour === startHour && b.status === 'booked') {
      await fetch(`${BASE}/bookings/${b.id}`, { method: 'DELETE', headers: { 'X-User-Id': '1' } });
    }
  }

  const attempts = Array.from({ length: N }, (_, i) =>
    fetch(`${BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Id': String((i % 3) + 1) },
      body: JSON.stringify({ venue_id: venueId, date, start_hour: startHour }),
    }).then((r) => r.status)
  );

  const statuses = await Promise.all(attempts);
  const ok = statuses.filter((s) => s === 201).length;
  const conflict = statuses.filter((s) => s === 409).length;

  console.log('Statuses:', statuses.sort());
  console.log(`201 (success): ${ok}   409 (slot taken): ${conflict}`);

  if (ok === 1 && conflict === N - 1) {
    console.log('✓ PASS — exactly one winner, no double-booking');
    process.exit(0);
  } else {
    console.error('✗ FAIL — expected exactly one 201');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
