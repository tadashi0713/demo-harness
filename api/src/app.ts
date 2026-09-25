import cors from 'cors';
import express from 'express';
import { z } from 'zod';
import { config } from './config';
import { pool } from './db/pool';
import { asyncHandler } from './lib/async-handler';
import { currentUser, requireAuth } from './middleware/auth';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { accountsRouter } from './routes/accounts';
import { authRouter } from './routes/auth';
import { transfersRouter } from './routes/transfers';
import { listTransactions } from './services/accounts';

const limitSchema = z.coerce.number().int().min(1).max(100).optional();

export function createApp() {
  const app = express();

  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json());

  app.get(
    '/health',
    asyncHandler(async (_req, res) => {
      await pool.query('SELECT 1');
      res.json({ status: 'ok', env: config.env });
    }),
  );

  app.use('/api/auth', authRouter);
  app.use('/api/accounts', accountsRouter);
  app.use('/api/transfers', transfersRouter);

  // 全口座を横断した最近の取引（ダッシュボード用）
  app.get(
    '/api/transactions',
    requireAuth,
    asyncHandler(async (req, res) => {
      const limit = limitSchema.parse(req.query.limit);
      const transactions = await listTransactions(currentUser(req).id, { limit: limit ?? 10 });
      res.json({ transactions });
    }),
  );

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
