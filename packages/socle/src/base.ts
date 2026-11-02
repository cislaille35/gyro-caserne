import type { SQL } from 'drizzle-orm';
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

// Une instruction SQL brute à placer dans un batch. Sur D1, drizzle attend dans un batch une requête préparée (`stmt`),
// que `run` ne prépare pas : sans elle, tout batch qui en contient une échoue. La base de test n'en a pas besoin.
export function instruction(base: Base, requete: SQL) {
	const brute = base.run(requete);
	const client = (base as unknown as { $client?: Partial<D1Database> }).$client;
	if (client && typeof client === 'object' && typeof client.batch === 'function') Object.assign(brute, { stmt: client.prepare!(brute.getQuery().sql) });
	return brute;
}
