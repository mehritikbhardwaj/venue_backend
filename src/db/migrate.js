'use strict';

// Applies schema.sql. Idempotent — safe to run repeatedly.
const fs = require('fs');
const path = require('path');
const { pool } = require('./pool');

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(sql);
  console.log('✓ Migration applied (schema.sql)');
}

migrate()
  .then(() => pool.end())
  .catch((err) => {
    console.error('Migration failed:', err);
    pool.end();
    process.exit(1);
  });
