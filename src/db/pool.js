'use strict';

require('dotenv').config();
const { Pool, types } = require('pg');

// DATE (OID 1082): return the raw 'YYYY-MM-DD' string instead of letting pg
// build a local-time JS Date — that gets JSON-serialized to UTC and shifts the
// day across timezones (e.g. IST pushes 2031-05-05 back to 2031-05-04T18:30Z).
// Slots are date-only; we never want a time component.
types.setTypeParser(1082, (val) => val);

// A single shared connection pool for the whole process.
// Every query and transaction borrows a client from here.
// Neon (and most hosted Postgres) require TLS; enable it whenever the URL
// asks for sslmode=require. rejectUnauthorized:false avoids local CA hassles.
const needsSsl = /sslmode=require/.test(process.env.DATABASE_URL || '');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: needsSsl ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  // A client sitting idle in the pool errored (e.g. DB restarted). Log, don't crash.
  console.error('Unexpected idle client error', err);
});

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
};
