import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { drizzle, type SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy';
import * as schema from '../src/schema.ts';
import * as schemaPhotos from '../src/schema-photos.ts';
import { ecrit, type Base, type BasePhotos } from '../src/base.ts';
import { oublierDroits } from '../src/droits.ts';

type Compteurs = { requetes: number; parametresMax: number };

// La base principale et, dans `photos`, la base des photos, comme les deux bases D1 de l'appli.
// `requetes` compte les appels aux deux bases (un batch compte pour un) ; `parametresMax` retient le plus de paramètres liés par une requête (D1 : 100 au plus).
// Comme creerBaseD1, toute écriture dans la base principale fait oublier les droits lus.
export async function baseDeTest(): Promise<Base & Compteurs & { photos: BasePhotos }> {
	const base = ouvrir(new URL('../migrations/', import.meta.url), schema, (requetes) => {
		if (requetes.some(ecrit)) oublierDroits(base);
	}) as Base & Compteurs & { photos: BasePhotos };
	base.photos = ouvrir(new URL('../migrations-photos/', import.meta.url), schemaPhotos, () => {}, base) as unknown as BasePhotos;
	return base;
}

// Une base SQLite en mémoire, migrations appliquées, derrière le pilote « proxy » de drizzle. `compteurs` : à qui ajouter les appels.
function ouvrir<S extends Record<string, unknown>>(dossierMigrations: URL, schemaBase: S, avant: (requetes: string[]) => void, compteurs?: Compteurs) {
	const sqlite = new DatabaseSync(':memory:');
	sqlite.exec('PRAGMA foreign_keys = ON');
	for (const fichier of readdirSync(dossierMigrations).filter((f) => f.endsWith('.sql')).sort()) {
		const sql = readFileSync(new URL(fichier, dossierMigrations), 'utf8');
		for (const instruction of sql.split('--> statement-breakpoint')) sqlite.exec(instruction);
	}

	const executer = (requete: string, params: unknown[], methode: 'run' | 'all' | 'values' | 'get') => {
		cpt().parametresMax = Math.max(cpt().parametresMax, params.length);
		const instruction = sqlite.prepare(requete);
		instruction.setReturnArrays(true);
		const valeurs = params as never[];
		if (methode === 'run') {
			instruction.run(...valeurs);
			return { rows: [] };
		}
		if (methode === 'get') return { rows: instruction.get(...valeurs) as unknown as unknown[] };
		return { rows: instruction.all(...valeurs) as unknown as unknown[][] };
	};

	const base = drizzle(
		async (requete, params, methode) => {
			cpt().requetes++;
			avant([requete]);
			return executer(requete, params, methode);
		},
		// Tout ou rien, comme le batch de D1.
		async (requetes) => {
			cpt().requetes++;
			avant(requetes.map((r) => r.sql));
			sqlite.exec('BEGIN');
			try {
				const resultats = requetes.map((r) => imiterD1(sqlite, r.sql, executer(r.sql, r.params, r.method)));
				sqlite.exec('COMMIT');
				return resultats;
			} catch (erreur) {
				sqlite.exec('ROLLBACK');
				throw erreur;
			}
		},
		{ schema: schemaBase }
	) as SqliteRemoteDatabase<S> & Compteurs;
	const cpt = () => compteurs ?? base;
	base.requetes = 0;
	base.parametresMax = 0;
	return base;
}

// Dans un batch, D1 rend chaque ligne comme un objet indexé par nom de colonne : deux colonnes de même nom n'en font qu'une.
// Imité pour les listes de lignes seulement (aucun batch ne lit une ligne seule avec get).
function imiterD1(sqlite: DatabaseSync, requete: string, resultat: { rows: unknown[] }) {
	if (!Array.isArray(resultat.rows) || !resultat.rows.every(Array.isArray)) return resultat;
	const noms = sqlite.prepare(requete).columns().map((c) => c.name);
	const rows = (resultat.rows as unknown[][]).map((ligne) => Object.values(Object.fromEntries(noms.map((nom, i) => [nom, ligne[i]]))));
	return { rows };
}
