import { z } from 'zod';
import { cipherField, uuidString } from '../../lib/validation.js';

export const createFactorSchema = z
  .object({
    dayId: uuidString,
    categoryLevelId: uuidString,
    encNotes: cipherField.optional(),
  })
  .strict();

// Mirrors Rails FactorPolicy: only `notes` is user-editable.
export const updateFactorSchema = z
  .object({
    encNotes: cipherField.nullable().optional(),
  })
  .strict();

export type CreateFactorInput = z.infer<typeof createFactorSchema>;
export type UpdateFactorInput = z.infer<typeof updateFactorSchema>;
