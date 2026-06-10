'use strict';

const express = require('express');
const { requestOtp, verifyOtp, AuthError } = require('../services/authService');

const router = express.Router();

const STATUS_BY_CODE = {
  NOT_FOUND: 404,
  INVALID_OTP: 401,
  OTP_EXPIRED: 401,
};

const isMobile = (m) => typeof m === 'string' && /^\d{10}$/.test(m);
const isOtp = (o) => typeof o === 'string' && /^\d{6}$/.test(o);

// POST /auth/request-otp  { mobile }
// Returns the OTP in the response (demo — no SMS). The app displays it.
router.post('/request-otp', async (req, res, next) => {
  try {
    const { mobile } = req.body || {};
    if (!isMobile(mobile)) {
      return res.status(400).json({ error: 'mobile must be a 10-digit number' });
    }
    const result = await requestOtp(mobile);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /auth/verify-otp  { mobile, otp }  -> user (+ is_new_user)
router.post('/verify-otp', async (req, res, next) => {
  try {
    const { mobile, otp } = req.body || {};
    if (!isMobile(mobile)) return res.status(400).json({ error: 'mobile must be a 10-digit number' });
    if (!isOtp(otp)) return res.status(400).json({ error: 'otp must be a 6-digit number' });

    const user = await verifyOtp(mobile, otp);
    res.json(user);
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(STATUS_BY_CODE[err.code] || 400).json({ error: err.message, code: err.code });
    }
    next(err);
  }
});

module.exports = router;
