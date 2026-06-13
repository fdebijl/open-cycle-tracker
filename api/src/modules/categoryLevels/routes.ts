import { Router } from 'express';
import { asyncHandler } from '../../lib/http.js';
import { idFilter } from '../../lib/filter.js';
import { parse } from '../../lib/parse.js';
import { uuidString } from '../../lib/validation.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { authContext } from '../../policies/index.js';
import { createCategoryLevelSchema, updateCategoryLevelSchema } from './schema.js';
import {
  createCategoryLevel,
  deleteCategoryLevel,
  getCategoryLevel,
  listCategoryLevels,
  updateCategoryLevel,
} from './service.js';

export const categoryLevelsRouter = Router();
categoryLevelsRouter.use(requireAuth);

categoryLevelsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await listCategoryLevels(authContext(req), idFilter(req)));
  }),
);

categoryLevelsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parse(uuidString, req.params.id);
    res.json(await getCategoryLevel(id, authContext(req)));
  }),
);

categoryLevelsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = parse(createCategoryLevelSchema, req.body);
    res.status(201).json(await createCategoryLevel(authContext(req), input));
  }),
);

categoryLevelsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parse(uuidString, req.params.id);
    const input = parse(updateCategoryLevelSchema, req.body);
    res.json(await updateCategoryLevel(id, authContext(req), input));
  }),
);

categoryLevelsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parse(uuidString, req.params.id);
    await deleteCategoryLevel(id, authContext(req));
    res.status(204).end();
  }),
);
