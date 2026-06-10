'use strict';

const express = require('express');
const { requireUser } = require('../middleware/auth');
const { createBooking, cancelBooking, BookingError } = require('../services/bookingService');
const { isValidDate } = require('../utils/time');

const router = express.Router();

// Maps service-level error codes to HTTP statuses.
const STATUS_BY_CODE = {
  SLOT_TAKEN: 409,
  VENUE_NOT_FOUND: 404,
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  INVALID_SLOT: 400,
};

// POST /bookings  { venue_id, date, start_hour }   header: X-User-Id
router.post('/', requireUser, async (req, res, next) => {
  try {
    const { venue_id, date, start_hour } = req.body || {};
    const venueId = Number(venue_id);
    const startHour = Number(start_hour);

    if (!Number.isInteger(venueId) || venueId <= 0) {
      return res.status(400).json({ error: 'venue_id is required and must be a positive integer' });
    }
    if (!isValidDate(date)) {
      return res.status(400).json({ error: 'date is required and must be YYYY-MM-DD' });
    }
    if (!Number.isInteger(startHour)) {
      return res.status(400).json({ error: 'start_hour is required and must be an integer' });
    }

    const booking = await createBooking({
      userId: req.user.id,
      venueId,
      date,
      startHour,
    });
    res.status(201).json(booking);
  } catch (err) {
    if (err instanceof BookingError) {
      return res.status(STATUS_BY_CODE[err.code] || 400).json({ error: err.message, code: err.code });
    }
    next(err);
  }
});

// DELETE /bookings/:id   header: X-User-Id
router.delete('/:id', requireUser, async (req, res, next) => {
  try {
    const bookingId = Number(req.params.id);
    if (!Number.isInteger(bookingId) || bookingId <= 0) {
      return res.status(400).json({ error: 'Invalid booking id' });
    }
    await cancelBooking({ bookingId, userId: req.user.id });
    res.status(204).end();
  } catch (err) {
    if (err instanceof BookingError) {
      return res.status(STATUS_BY_CODE[err.code] || 400).json({ error: err.message, code: err.code });
    }
    next(err);
  }
});

module.exports = router;
