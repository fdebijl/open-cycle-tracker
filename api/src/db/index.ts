import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { env } from '../config/env.js';
import * as schema from './schema.js';

// `pg` is CommonJS and only exposes a default export under Node's ESM loader,
// so `Pool` must be destructured off it rather than named-imported (which
// esbuild tolerates but tsx/node do not).
const { Pool } = pg;

export const pool = new Pool({ connectionString: env.DATABASE_URL });

export const db = drizzle(pool, { schema, casing: 'snake_case' });

export type Database = typeof db;
export { schema };
