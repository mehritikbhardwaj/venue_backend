'use strict';

const express = require('express');
const { pool } = require('../db/pool');
const { listUserBookings } = require('../services/bookingService');

const router = express.Router();

// GET /users  — list selectable (hardcoded/seeded) users for the login screen.
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT id, name FROM users ORDER BY id');
    res.json(rows);
  } catch (err) {
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
