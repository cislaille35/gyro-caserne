import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import * as schema from '../src/schema.ts';
import type { Base } from '../src/base.ts';

const dossierMigrations = new URL('../migrations/', import.meta.url);

export async function baseDeTest(): Promise<Base> {
	const sqlite = new DatabaseSync(':memory:');
	sqlite.exec('PRAGMA foreign_keys = ON');
	for (const fichier of readdirSync(dossierMigrations).filter((f) => f.endsWith('.sql')).sort()) {
		const sql = readFileSync(new URL(fichier, dossierMigrations), 'utf8');
		for (const instruction of sql.split('--> statement-breakpoint')) sqlite.exec(instruction);
	}

	const executer = (requete: string, params: unknown[], methode: 'run' | 'all' | 'values' | 'get') => {
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

	return drizzle(
		async (requete, params, methode) => executer(requete, params, methode),
		// Tout ou rien, comme le batch de D1.
		async (requetes) => {
			sqlite.exec('BEGIN');
			try {
				const resultats = requetes.map((r) => executer(r.sql, r.params, r.method));
				sqlite.exec('COMMIT');
				return resultats;
			} catch (erreur) {
				sqlite.exec('ROLLBACK');
				throw erreur;
			}
		},
		{ schema }
	);
}
