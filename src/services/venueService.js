'use strict';

const { pool } = require('../db/pool');
const { buildSlots } = require('../utils/time');

async function listVenues() {
  const { rows } = await pool.query(
    'SELECT id, name, sport, location, open_hour, close_hour FROM venues ORDER BY id'
  );
  return rows;
}

async function getVenue(venueId) {
  const { rows } = await pool.query(
    'SELECT id, name, sport, location, open_hour, close_hour FROM venues WHERE id = $1',
    [venueId]
  );
  return rows[0] || null;
}

// Returns the full hourly grid for a venue on a date, each slot tagged
// available/booked. Booked hours come from active bookings only.
async function getSlots(venueId, date) {
  const venue = await getVenue(venueId);
  if (!venue) return null;

  const { rows } = await pool.query(
    `SELECT id, start_hour FROM bookings
       WHERE venue_id = $1 AND slot_date = $2 AND status = 'booked'`,
    [venueId, date]
  );

  const bookedByHour = new Map(rows.map((r) => [r.start_hour, r]));

  return buildSlots({
    venueId,
    date,
    openHour: venue.open_hour,
    closeHour: venue.close_hour,
    bookedByHour,
  });
}

module.exports = { listVenues, getVenue, getSlots };
