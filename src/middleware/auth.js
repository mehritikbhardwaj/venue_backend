'use strict';

const { pool } = require('../db/pool');

// Lightweight auth: trust the X-User-Id header (assignment explicitly allows
// hardcoded users + header). We still verify the user exists so bookings can't
// be attributed to a non-existent id.
async function requireUser(req, res, next) {
  const raw = req.header('X-User-Id');
  const userId = Number(raw);
  if (!raw || !Number.isInteger(userId) || userId <= 0) {
    return res.status(401).json({ error: 'Missing or invalid X-User-Id header' });
  }
  try {
    const { rows } = await pool.query('SELECT id, name FROM users WHERE id = $1', [userId]);
    if (rows.length === 0) {
      return res.status(401).json({ error: `Unknown user id ${userId}` });
    }
    req.user = rows[0];
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { requireUser };
