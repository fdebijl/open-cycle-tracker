import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { env, isDemo } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { httpLogger } from './middleware/httpLogger.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { authRouter } from './modules/auth/routes.js';
import { categoriesRouter } from './modules/categories/routes.js';
import { categoryLevelsRouter } from './modules/categoryLevels/routes.js';
import { cyclesRouter } from './modules/cycles/routes.js';
import { daysRouter } from './modules/days/routes.js';
import { factorsRouter } from './modules/factors/routes.js';
import { usersRouter } from './modules/users/routes.js';

export function createApp(): Express {
  const app = express();

  app.set('query parser', 'extended');
  app.use(helmet());

  app.use(
    cors({
      origin(origin, callback) {
        // Allow non-browser clients (no Origin header) and allowlisted origins.
        if (!origin || env.CORS_ORIGINS.includes(origin)) return callback(null, true);
        return callback(new Error('Origin not allowed by CORS'));
      },
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      exposedHeaders: ['Authorization'],
    }),
  );

  app.use(express.json({ limit: '256kb' }));
  app.use(httpLogger);
  app.use(apiLimiter);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', demoMode: isDemo });
  });

  app.use('/auth', authRouter);
  app.use('/users', usersRouter);
  app.use('/cycles', cyclesRouter);
  app.use('/days', daysRouter);
  app.use('/categories', categoriesRouter);
  app.use('/category_levels', categoryLevelsRouter);
  app.use('/factors', factorsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
