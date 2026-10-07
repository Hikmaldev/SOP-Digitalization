import { createApp } from './app';
import { config } from './config';
import { pool } from './db';

const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`SOPly API listening on http://localhost:${config.port} (${config.nodeEnv})`);
});

function shutdown(signal: string): void {
  console.log(`\n${signal} received — shutting down`);
  server.close(() => {
    void pool.end().then(() => process.exit(0));
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
