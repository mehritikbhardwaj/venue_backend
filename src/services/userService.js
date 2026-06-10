'use strict';

const { pool } = require('../db/pool');

class UserError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code; // 'NOT_FOUND'
  }
}

// Update a user's profile (name). Used right after a NEW user verifies their
// OTP, to set their display name against their already-created id.
async function updateUser(id, { name }) {
  const { rows } = await pool.query(
    'UPDATE users SET name = $1 WHERE id = $2 RETURNING id, name, mobile',
    [name, id]
  );
  if (rows.length === 0) throw new UserError('NOT_FOUND', `User ${id} not found`);
  return rows[0];
}

module.exports = { updateUser, UserError };
