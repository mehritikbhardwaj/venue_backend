'use strict';

// Vercel serverless entry point. Vercel invokes the exported Express app as a
// function; the connection pool is created once per warm instance and reused
// across invocations. We use Neon's pooled endpoint (-pooler host) which is
// designed for serverless connection churn.
const { createApp } = require('../src/app');

module.exports = createApp();
