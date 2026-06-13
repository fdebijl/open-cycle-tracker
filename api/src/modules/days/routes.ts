import { Router } from 'express';
import { asyncHandler } from '../../lib/http.js';
import { idFilter } from '../../lib/filter.js';
import { parse } from '../../lib/parse.js';
import { uuidString } from '../../lib/validation.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { authContext } from '../../policies/index.js';
import { createDaySchema, updateDaySchema } from './schema.js';
import { createDay, deleteDay, getDay, listDays, updateDay } from './service.js';

export const daysRouter = Router();
daysRouter.use(requireAuth);

daysRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await listDays(authContext(req), idFilter(req)));
  }),
);

daysRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parse(uuidString, req.params.id);
    res.json(await getDay(id, authContext(req)));
  }),
);

daysRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = parse(createDaySchema, req.body);
    res.status(201).json(await createDay(authContext(req), input));
  }),
);

daysRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parse(uuidString, req.params.id);
    const input = parse(updateDaySchema, req.body);
    res.json(await updateDay(id, authContext(req), input));
  }),
);

daysRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parse(uuidString, req.params.id);
    await deleteDay(id, authContext(req));
    res.status(204).end();
  }),
);
