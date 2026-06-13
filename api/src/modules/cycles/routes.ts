import { Router } from 'express';
import { asyncHandler } from '../../lib/http.js';
import { idFilter } from '../../lib/filter.js';
import { parse } from '../../lib/parse.js';
import { uuidString } from '../../lib/validation.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { authContext } from '../../policies/index.js';
import { createCycle, deleteCycle, getCycle, listCycles } from './service.js';

// A cycle is a pure grouping with no editable content, so there is no PATCH.
export const cyclesRouter = Router();
cyclesRouter.use(requireAuth);

cyclesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await listCycles(authContext(req), idFilter(req)));
  }),
);

cyclesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parse(uuidString, req.params.id);
    res.json(await getCycle(id, authContext(req)));
  }),
);

cyclesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    res.status(201).json(await createCycle(authContext(req)));
  }),
);

cyclesRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parse(uuidString, req.params.id);
    await deleteCycle(id, authContext(req));
    res.status(204).end();
  }),
);
