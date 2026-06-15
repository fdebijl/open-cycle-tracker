import { Router } from 'express';
import { asyncHandler } from '../../lib/http.js';
import { parse } from '../../lib/parse.js';
import { requireAuth, requireAuthCtx } from '../../middleware/requireAuth.js';
import { authLimiter } from '../../middleware/rateLimit.js';
import {
  duressConfigSchema,
  loginSchema,
  passwordChangeSchema,
  preloginSchema,
  recoverInitSchema,
  recoverSchema,
  signupSchema,
} from './schema.js';
import {
  changePassword,
  configureDuress,
  login,
  logout,
  prelogin,
  recover,
  recoverInit,
  signup,
} from './service.js';

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

// Change password (authenticated): the client re-wrapped its DEK under a new
// password and sends fresh auth/KEK material.
authRouter.post(
  '/password',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { userId } = requireAuthCtx(req);
    const input = parse(passwordChangeSchema, req.body);
    await changePassword(userId, input);
    res.status(204).end();
  }),
);

// Configure duress/decoy + destruction passwords (authenticated; roadmap #14).
authRouter.post(
  '/duress',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { userId } = requireAuthCtx(req);
    const input = parse(duressConfigSchema, req.body);
    await configureDuress(userId, input);
    res.status(204).end();
  }),
);

// Step 1 of recovery: fetch the recovery wrapping material (anti-enumeration).
authRouter.post(
  '/recover/init',
  authLimiter,
  asyncHandler(async (req, res) => {
    const input = parse(recoverInitSchema, req.body);
    res.json(await recoverInit(input));
  }),
);

// Step 2 of recovery: prove the recovery code and set a new password.
authRouter.post(
  '/recover',
  authLimiter,
  asyncHandler(async (req, res) => {
    const input = parse(recoverSchema, req.body);
    res.json(await recover(input));
  }),
);
