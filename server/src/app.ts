import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { config } from './config';
import { queryOne } from './db';
import { uploadDir } from './lib/storage';
import { errorHandler, notFoundHandler } from './middleware/error';
import { apiRouter } from './routes';

/**
 * Assemble the Express app. Kept separate from the listen() call so tests
 * and tooling can import the app without opening a port.
 */
export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(
    helmet({
      // Allow the SPA origin to load uploaded diagram files from /uploads.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(
    cors({
      origin: config.corsOrigin.split(',').map((origin) => origin.trim()),
    }),
  );
  app.use(express.json({ limit: '2mb' }));
  app.use('/uploads', express.static(uploadDir()));

  app.get('/api/health', async (_req, res) => {
    await queryOne('SELECT 1 AS ok');
    res.json({ status: 'ok', database: 'up', timestamp: new Date().toISOString() });
  });

  app.use('/api', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
