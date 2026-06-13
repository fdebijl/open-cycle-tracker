import { z } from 'zod';
import { cipherField, uuidString } from '../../lib/validation.js';

/** Tier (plaintext vs encrypted) follows the parent category; service enforces. */
export const createCategoryLevelSchema = z
  .object({
    categoryId: uuidString,
    encName: cipherField.optional(),
    encIcon: cipherField.optional(),
    name: z.string().max(200).optional(),
    icon: z.string().max(200).optional(),
  })
  .strict();

export const updateCategoryLevelSchema = z
  .object({
    encName: cipherField.nullable().optional(),
    encIcon: cipherField.nullable().optional(),
    name: z.string().max(200).nullable().optional(),
    icon: z.string().max(200).nullable().optional(),
  })
  .strict();

export type CreateCategoryLevelInput = z.infer<typeof createCategoryLevelSchema>;
export type UpdateCategoryLevelInput = z.infer<typeof updateCategoryLevelSchema>;
