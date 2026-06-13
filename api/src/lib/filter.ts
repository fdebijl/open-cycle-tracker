import type { Request } from 'express';
import { z } from 'zod';
import { parse } from './parse.js';

const idFilterSchema = z.array(z.string().uuid()).min(1).max(500);

/**
 * Parse a `?filter[id]=uuid1,uuid2` query into a validated array of UUIDs, or
 * null when no id filter is present. This is the only server-side filter we
 * keep — content filters (today/current/date-range) moved client-side because
 * the underlying fields are ciphertext. Mirrors the Rails CSV→array transform.
 */
export function idFilter(req: Request): string[] | null {
  const filter = req.query.filter;
  if (!filter || typeof filter !== 'object' || Array.isArray(filter)) return null;
  const raw = (filter as Record<string, unknown>).id;
  if (raw == null) return null;
  const ids = String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return parse(idFilterSchema, ids);
}
