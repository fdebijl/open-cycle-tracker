import { z } from 'zod';
import { cipherField } from '../../lib/validation.js';

/**
 * Two-tier create:
 *  - user category (default): provide encrypted encName/encIcon/encColor.
 *  - global category (admins only, `global: true`): provide plaintext
 *    name/icon/color (system-defined, not secret).
 * The service enforces which tier the caller may use.
 */
export const createCategorySchema = z
  .object({
    global: z.boolean().optional().default(false),
    encName: cipherField.optional(),
    encIcon: cipherField.optional(),
    encColor: cipherField.optional(),
    name: z.string().max(200).optional(),
    icon: z.string().max(200).optional(),
    color: z.string().max(64).optional(),
  })
  .strict();

export const updateCategorySchema = z
  .object({
    encName: cipherField.nullable().optional(),
    encIcon: cipherField.nullable().optional(),
    encColor: cipherField.nullable().optional(),
    name: z.string().max(200).nullable().optional(),
    icon: z.string().max(200).nullable().optional(),
    color: z.string().max(64).nullable().optional(),
  })
  .strict();

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
