'use strict';

const express = require('express');
const { listVenues, getSlots } = require('../services/venueService');
const { isValidDate } = require('../utils/time');

const router = express.Router();

// GET /venues
router.get('/', async (req, res, next) => {
  try {
    const venues = await listVenues();
    res.json(venues);
  } catch (err) {
    next(err);
  }
});

// GET /venues/:id/slots?date=YYYY-MM-DD
router.get('/:id/slots', async (req, res, next) => {
  try {
    const venueId = Number(req.params.id);
    const { date } = req.query;

    if (!Number.isInteger(venueId) || venueId <= 0) {
      return res.status(400).json({ error: 'Invalid venue id' });
    }
    if (!isValidDate(date)) {
      return res.status(400).json({ error: 'Query param "date" must be YYYY-MM-DD' });
    }

    const slots = await getSlots(venueId, date);
    if (slots === null) {
      return res.status(404).json({ error: `Venue ${venueId} not found` });
    }
    res.json({ venue_id: venueId, date, slots });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
