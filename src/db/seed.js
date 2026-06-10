'use strict';

// Seeds hardcoded users and 4 venues. Re-runnable: clears bookings/venues/users
// and resets ids so the demo always starts from a known state.
const { pool } = require('./pool');

const USERS = [
  { name: 'Aarav', mobile: '9000000001' },
  { name: 'Diya', mobile: '9000000002' },
  { name: 'Kabir', mobile: '9000000003' },
];

const VENUES = [
  { name: 'Smash Arena', sport: 'Badminton', location: 'Koramangala, Bengaluru' },
  { name: 'GreenTurf Grounds', sport: 'Turf', location: 'HSR Layout, Bengaluru' },
  { name: 'Shuttle Hub', sport: 'Badminton', location: 'Indiranagar, Bengaluru' },
  { name: 'Kickoff Fields', sport: 'Turf', location: 'Whitefield, Bengaluru' },
];

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // TRUNCATE ... RESTART IDENTITY CASCADE wipes data and resets serial counters.
    await client.query('TRUNCATE bookings, venues, users RESTART IDENTITY CASCADE');

    for (const u of USERS) {
      await client.query('INSERT INTO users (name, mobile) VALUES ($1, $2)', [u.name, u.mobile]);
    }

    for (const v of VENUES) {
      await client.query(
        'INSERT INTO venues (name, sport, location) VALUES ($1, $2, $3)',
        [v.name, v.sport, v.location]
      );
    }

    await client.query('COMMIT');
    console.log(`✓ Seeded ${USERS.length} users and ${VENUES.length} venues`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

seed()
  .then(() => pool.end())
  .catch((err) => {
    console.error('Seed failed:', err);
    pool.end();
    process.exit(1);
  });
