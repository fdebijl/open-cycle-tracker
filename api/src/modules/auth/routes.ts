import { Router } from 'express';
import { asyncHandler } from '../../lib/http.js';
import { parse } from '../../lib/parse.js';
import { requireAuth, requireAuthCtx } from '../../middleware/requireAuth.js';
import { authLimiter } from '../../middleware/rateLimit.js';
import { loginSchema, preloginSchema, signupSchema } from './schema.js';
import { login, logout, prelogin, signup } from './service.js';

export const authRouter = Router();

// Step 1 of login: fetch KDF salt/params (or an anti-enumeration pseudo-salt).
authRouter.post(
  '/prelogin',
  authLimiter,
  asyncHandler(async (req, res) => {
    const input = parse(preloginSchema, req.body);
    res.json(await prelogin(input));
  }),
);

authRouter.post(
  '/signup',
  authLimiter,
  asyncHandler(async (req, res) => {
    const input = parse(signupSchema, req.body);
    res.status(201).json(await signup(input));
  }),
);

// Step 2 of login: submit the derived authHash.
authRouter.post(
  '/login',
  authLimiter,
  asyncHandler(async (req, res) => {
    const input = parse(loginSchema, req.body);
    res.json(await login(input));
  }),
);

authRouter.delete(
  '/logout',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { jti, tokenExpiresAt } = requireAuthCtx(req);
    await logout(jti, tokenExpiresAt);
    res.status(204).end();
  }),
);
