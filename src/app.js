'use strict';

const express = require('express');
const cors = require('cors');

const venuesRouter = require('./routes/venues');
const bookingsRouter = require('./routes/bookings');
const usersRouter = require('./routes/users');
const authRouter = require('./routes/auth');

function createApp() {
  const app = express();

  app.use(cors());            // app and API run on different origins/devices in the demo
  app.use(express.json());

  app.get('/health', (req, res) => res.json({ ok: true }));

  // Friendly index so hitting the root in a browser shows the API surface.
  app.get('/', (req, res) =>
    res.json({
      service: 'QuickSlot API',
      status: 'ok',
      endpoints: [
        'POST /auth/request-otp  { mobile }',
        'POST /auth/verify-otp  { mobile, otp }',
        'PATCH /users/:id  { name }',
        'GET /venues',
        'GET /venues/:id/slots?date=YYYY-MM-DD',
        'POST /bookings  (header X-User-Id)',
        'GET /users',
        'GET /users/:id/bookings',
        'DELETE /bookings/:id  (header X-User-Id)',
      ],
    })
  );

  app.use('/auth', authRouter);
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
