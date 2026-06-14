import { z } from 'zod';
import { cipherField, uuidString } from '../../lib/validation.js';

export const createFactorSchema = z
  .object({
    dayId: uuidString,
    categoryLevelId: uuidString,
    encNotes: cipherField.optional(),
    // Optional encrypted numeric reading (e.g. BBT temperature).
    encValue: cipherField.optional(),
  })
  .strict();

// `notes` and `value` are user-editable; `categoryLevelId` is not (changing it
// would mean a different category - delete and recreate instead).
export const updateFactorSchema = z
  .object({
    encNotes: cipherField.nullable().optional(),
    encValue: cipherField.nullable().optional(),
  })
  .strict();

export type CreateFactorInput = z.infer<typeof createFactorSchema>;
export type UpdateFactorInput = z.infer<typeof updateFactorSchema>;
