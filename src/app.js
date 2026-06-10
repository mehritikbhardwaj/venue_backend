'use strict';

const express = require('express');
const cors = require('cors');

const venuesRouter = require('./routes/venues');
const bookingsRouter = require('./routes/bookings');
const usersRouter = require('./routes/users');

function createApp() {
  const app = express();

  app.use(cors());            // app and API run on different origins/devices in the demo
  app.use(express.json());

  app.get('/health', (req, res) => res.json({ ok: true }));

  app.use('/venues', venuesRouter);
  app.use('/bookings', bookingsRouter);
  app.use('/users', usersRouter);

  // 404 for anything unmatched.
  app.use((req, res) => res.status(404).json({ error: 'Not found' }));

  // Central error handler — last line of defense for unexpected throws.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

module.exports = { createApp };
