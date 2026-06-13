import { Router } from 'express';
import { asyncHandler } from '../../lib/http.js';
import { idFilter } from '../../lib/filter.js';
import { parse } from '../../lib/parse.js';
import { uuidString } from '../../lib/validation.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { authContext } from '../../policies/index.js';
import { createFactorSchema, updateFactorSchema } from './schema.js';
import { createFactor, deleteFactor, getFactor, listFactors, updateFactor } from './service.js';

export const factorsRouter = Router();
factorsRouter.use(requireAuth);

factorsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await listFactors(authContext(req), idFilter(req)));
  }),
);

factorsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parse(uuidString, req.params.id);
    res.json(await getFactor(id, authContext(req)));
  }),
);

factorsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = parse(createFactorSchema, req.body);
    res.status(201).json(await createFactor(authContext(req), input));
  }),
);

factorsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parse(uuidString, req.params.id);
    const input = parse(updateFactorSchema, req.body);
    res.json(await updateFactor(id, authContext(req), input));
  }),
);

factorsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parse(uuidString, req.params.id);
    await deleteFactor(id, authContext(req));
    res.status(204).end();
  }),
);
