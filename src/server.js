'use strict';

const { createApp } = require('./app');
const { pool } = require('./db/pool');

const PORT = process.env.PORT || 3000;
const app = createApp();

const server = app.listen(PORT, () => {
  console.log(`QuickSlot API listening on http://localhost:${PORT}`);
});

// Graceful shutdown so the pool closes cleanly on Ctrl-C / kill.
function shutdown() {
  console.log('\nShutting down...');
  server.close(() => pool.end().then(() => process.exit(0)));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
