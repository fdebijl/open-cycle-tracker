import { Router } from 'express';
import { asyncHandler } from '../../lib/http.js';
import { idFilter } from '../../lib/filter.js';
import { parse } from '../../lib/parse.js';
import { uuidString } from '../../lib/validation.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { authContext } from '../../policies/index.js';
import { createCategorySchema, updateCategorySchema } from './schema.js';
import {
  createCategory,
  deleteCategory,
  getCategory,
  listCategories,
  updateCategory,
} from './service.js';

export const categoriesRouter = Router();
categoriesRouter.use(requireAuth);

categoriesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await listCategories(authContext(req), idFilter(req)));
  }),
);

categoriesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parse(uuidString, req.params.id);
    res.json(await getCategory(id, authContext(req)));
  }),
);

categoriesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = parse(createCategorySchema, req.body);
    res.status(201).json(await createCategory(authContext(req), input));
  }),
);

categoriesRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parse(uuidString, req.params.id);
    const input = parse(updateCategorySchema, req.body);
    res.json(await updateCategory(id, authContext(req), input));
  }),
);

categoriesRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parse(uuidString, req.params.id);
    await deleteCategory(id, authContext(req));
    res.status(204).end();
  }),
);
