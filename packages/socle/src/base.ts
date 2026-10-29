import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { type DrizzleD1Database, drizzle } from 'drizzle-orm/d1';
import { oublierDroits } from './droits.ts';
import * as schema from './schema.ts';
import * as schemaPhotos from './schema-photos.ts';

// batch est propre à D1 et au proxy de test : il exécute plusieurs requêtes d'un bloc.
export type Base = BaseSQLiteDatabase<'async', unknown, typeof schema> & Pick<DrizzleD1Database<typeof schema>, 'batch'>;

// Une requête qui n'est pas une lecture peut changer des droits : ceux déjà lus sont oubliés.
export const ecrit = (sql: string) => !/^\s*select\b/i.test(sql);

export function creerBaseD1(d1: D1Database): Base {
	const surveillee = new Proxy(d1, {
		get(cible, cle) {
			if (cle === 'prepare')
				return (sql: string) => {
					if (ecrit(sql)) oublierDroits(base);
					return cible.prepare(sql);
				};
			const valeur = Reflect.get(cible, cle);
			return typeof valeur === 'function' ? valeur.bind(cible) : valeur;
		}
	});
	const base: Base = drizzle(surveillee, { schema });
	return base;
}

// La base des photos (liaison PHOTOS) : les octets seulement, aucun droit n'y est lu.
export type BasePhotos = BaseSQLiteDatabase<'async', unknown, typeof schemaPhotos> & Pick<DrizzleD1Database<typeof schemaPhotos>, 'batch'>;

export function creerBasePhotos(d1: D1Database): BasePhotos {
	return drizzle(d1, { schema: schemaPhotos });
}
