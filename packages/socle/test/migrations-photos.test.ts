import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

const dossier = new URL('../migrations-photos/', import.meta.url);

describe('migrations de la base des photos', () => {
	it('créent la table photo : type contrôlé, octets, taille, date', () => {
		const sqlite = new DatabaseSync(':memory:');
		const fichiers = readdirSync(dossier).filter((f) => f.endsWith('.sql')).sort();
		expect(fichiers.length).toBeGreaterThan(0);
		for (const f of fichiers) for (const instruction of readFileSync(new URL(f, dossier), 'utf8').split('--> statement-breakpoint')) sqlite.exec(instruction);
		const colonnes = sqlite.prepare('PRAGMA table_info(photo)').all() as { name: string; type: string; notnull: number }[];
		expect(colonnes.map((c) => [c.name, c.type])).toEqual([
			['id', 'INTEGER'],
			['type', 'TEXT'],
			['donnees', 'BLOB'],
			['taille', 'INTEGER'],
			['cree_le', 'TEXT']
		]);
		sqlite.exec(`INSERT INTO photo (type, donnees, taille, cree_le) VALUES ('image/jpeg', x'ffd8ff', 3, '2026-10-29T10:00');`);
		expect(() => sqlite.exec(`INSERT INTO photo (type, donnees, taille, cree_le) VALUES ('image/png', x'89', 1, '2026-10-29T10:00');`)).toThrow();
		expect(sqlite.prepare('SELECT seq FROM sqlite_sequence WHERE name = ?').get('photo')).toEqual({ seq: 1 });
	});
});
