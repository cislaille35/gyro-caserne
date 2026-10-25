import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { type DrizzleD1Database, drizzle } from 'drizzle-orm/d1';
import * as schema from './schema.ts';

// batch est propre à D1 et au proxy de test : il exécute plusieurs requêtes d'un bloc.
export type Base = BaseSQLiteDatabase<'async', unknown, typeof schema> & Pick<DrizzleD1Database<typeof schema>, 'batch'>;

export function creerBaseD1(d1: D1Database): Base {
	return drizzle(d1, { schema });
}
