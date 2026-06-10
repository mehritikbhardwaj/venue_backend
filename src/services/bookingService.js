'use strict';

const { pool } = require('../db/pool');

// Sentinel error so the route layer can map causes to HTTP status codes
// without leaking SQL details.
class BookingError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code; // 'SLOT_TAKEN' | 'VENUE_NOT_FOUND' | 'NOT_FOUND' | 'FORBIDDEN'
  }
}

const PG_UNIQUE_VIOLATION = '23505';

// Concurrency-safe create. The UNIQUE partial index on
// (venue_id, slot_date, start_hour) WHERE status='booked' is what enforces
// single-winner semantics — no SELECT-then-INSERT race, the INSERT itself
// is the gate. A duplicate raises 23505, which we surface as SLOT_TAKEN.
async function createBooking({ userId, venueId, date, startHour }) {
  const venue = await pool.query('SELECT open_hour, close_hour FROM venues WHERE id = $1', [venueId]);
  if (venue.rows.length === 0) {
    throw new BookingError('VENUE_NOT_FOUND', `Venue ${venueId} not found`);
  }
  const { open_hour, close_hour } = venue.rows[0];
  if (startHour < open_hour || startHour >= close_hour) {
    throw new BookingError(
      'INVALID_SLOT',
      `start_hour must be between ${open_hour} and ${close_hour - 1}`
    );
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO bookings (venue_id, user_id, slot_date, start_hour)
         VALUES ($1, $2, $3, $4)
       RETURNING id, venue_id, user_id, slot_date, start_hour, status, created_at`,
      [venueId, userId, date, startHour]
    );
    return rows[0];
  } catch (err) {
    if (err.code === PG_UNIQUE_VIOLATION) {
      throw new BookingError('SLOT_TAKEN', 'That slot was just booked by someone else');
    }
    throw err;
  }
}

// Joins venue name in for a richer "My Bookings" list. Returns active first,
// most recent first.
async function listUserBookings(userId) {
  const { rows } = await pool.query(
    `SELECT b.id, b.venue_id, v.name AS venue_name, v.sport, v.location,
            b.slot_date, b.start_hour, b.status, b.created_at
       FROM bookings b
       JOIN venues v ON v.id = b.venue_id
      WHERE b.user_id = $1
      ORDER BY (b.status = 'booked') DESC, b.created_at DESC`,
    [userId]
  );
  return rows;
}

// Cancel = soft delete (status -> cancelled), which frees the slot because the
// unique index only covers 'booked' rows. Only the owner may cancel.
async function cancelBooking({ bookingId, userId }) {
  const { rows } = await pool.query('SELECT user_id, status FROM bookings WHERE id = $1', [bookingId]);
  if (rows.length === 0) {
    throw new BookingError('NOT_FOUND', `Booking ${bookingId} not found`);
  }
  if (rows[0].user_id !== userId) {
    throw new BookingError('FORBIDDEN', 'You can only cancel your own bookings');
  }
  if (rows[0].status === 'cancelled') {
    return; // already cancelled — idempotent
  }
  await pool.query(`UPDATE bookings SET status = 'cancelled' WHERE id = $1`, [bookingId]);
}

module.exports = { createBooking, listUserBookings, cancelBooking, BookingError };
