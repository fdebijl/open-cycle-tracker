import { z } from 'zod';
import { cipherField, uuidString } from '../../lib/validation.js';

/** Date and note are E2EE blobs; `order` is plaintext for stable sorting. */
export const createDaySchema = z
  .object({
    cycleId: uuidString,
    encDate: cipherField,
    encNotes: cipherField.optional(),
    order: z.number().int().optional(),
  })
  .strict();

export const updateDaySchema = z
  .object({
    encDate: cipherField.optional(),
    encNotes: cipherField.nullable().optional(),
    order: z.number().int().nullable().optional(),
  })
  .strict();

export type CreateDayInput = z.infer<typeof createDaySchema>;
export type UpdateDayInput = z.infer<typeof updateDaySchema>;
