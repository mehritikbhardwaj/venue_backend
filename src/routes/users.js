'use strict';

const express = require('express');
const { pool } = require('../db/pool');
const { listUserBookings } = require('../services/bookingService');
const { updateUser, UserError } = require('../services/userService');

const router = express.Router();

// GET /users  — list users (id, name, mobile).
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT id, name, mobile FROM users ORDER BY id');
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// PATCH /users/:id  { name }  — set/update a user's display name.
// Used after a new user verifies OTP, to attach a name to their id.
router.patch('/:id', async (req, res, next) => {
  try {
    const userId = Number(req.params.id);
    const { name } = req.body || {};
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ error: 'Invalid user id' });
    }
    if (typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'name is required' });
    }
    const user = await updateUser(userId, { name: name.trim() });
    res.json(user);
  } catch (err) {
    if (err instanceof UserError) {
      return res.status(err.code === 'NOT_FOUND' ? 404 : 400).json({ error: err.message, code: err.code });
    }
    next(err);
  }
});

// GET /users/:id/bookings
router.get('/:id/bookings', async (req, res, next) => {
  try {
    const userId = Number(req.params.id);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ error: 'Invalid user id' });
    }
    const bookings = await listUserBookings(userId);
    res.json(bookings);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
