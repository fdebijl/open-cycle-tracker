import { Router } from 'express';
import { asyncHandler } from '../../lib/http.js';
import { parse } from '../../lib/parse.js';
import { uuidString } from '../../lib/validation.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { authContext } from '../../policies/index.js';
import { updateUserSchema } from './schema.js';
import { deleteUser, getUser, updateUser } from './service.js';

export const usersRouter = Router();
usersRouter.use(requireAuth);

usersRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parse(uuidString, req.params.id);
    res.json(await getUser(id, authContext(req)));
  }),
);

usersRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parse(uuidString, req.params.id);
    const input = parse(updateUserSchema, req.body);
    res.json(await updateUser(id, authContext(req), input));
  }),
);

usersRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parse(uuidString, req.params.id);
    await deleteUser(id, authContext(req));
    res.status(204).end();
  }),
);
