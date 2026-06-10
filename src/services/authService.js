'use strict';

const { pool } = require('../db/pool');

class AuthError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code; // 'NOT_FOUND' | 'INVALID_OTP' | 'OTP_EXPIRED'
  }
}

const OTP_TTL_MINUTES = 5;

// 6-digit numeric OTP.
function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// A user is "new" until they've set a non-empty name.
function isNew(user) {
  return !user.name || user.name.trim() === '';
}

// Find-or-create the user for this mobile, issue a fresh OTP, and return it.
// For the demo the OTP is returned in the response (no SMS provider); the app
// shows it on the OTP screen.
async function requestOtp(mobile) {
  let { rows } = await pool.query('SELECT id, name FROM users WHERE mobile = $1', [mobile]);

  let user;
  if (rows.length === 0) {
    const inserted = await pool.query(
      "INSERT INTO users (name, mobile) VALUES ('', $1) RETURNING id, name",
      [mobile]
    );
    user = inserted.rows[0];
  } else {
    user = rows[0];
  }

  const otp = generateOtp();
  await pool.query(
    `UPDATE users
        SET otp_code = $1,
            otp_expires_at = now() + ($2 || ' minutes')::interval
      WHERE id = $3`,
    [otp, OTP_TTL_MINUTES, user.id]
  );

  return { user_id: user.id, mobile, otp, is_new_user: isNew(user), name: user.name };
}

// Validate the OTP, clear it on success, and return the user.
async function verifyOtp(mobile, otp) {
  const { rows } = await pool.query(
    'SELECT id, name, otp_code, otp_expires_at FROM users WHERE mobile = $1',
    [mobile]
  );
  if (rows.length === 0) throw new AuthError('NOT_FOUND', 'No OTP requested for this mobile');

  const user = rows[0];
  if (!user.otp_code || user.otp_code !== otp) {
    throw new AuthError('INVALID_OTP', 'Incorrect OTP');
  }
  if (new Date(user.otp_expires_at).getTime() < Date.now()) {
    throw new AuthError('OTP_EXPIRED', 'OTP has expired. Request a new one');
  }

  // Single-use: clear the OTP once consumed.
  await pool.query('UPDATE users SET otp_code = NULL, otp_expires_at = NULL WHERE id = $1', [user.id]);

  return { id: user.id, name: user.name, mobile, is_new_user: isNew(user) };
}

module.exports = { requestOtp, verifyOtp, AuthError };
