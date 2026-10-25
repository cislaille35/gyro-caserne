import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema.ts';

export type Base = BaseSQLiteDatabase<'async', unknown, typeof schema>;

export function creerBaseD1(d1: D1Database): Base {
	return drizzle(d1, { schema });
}
