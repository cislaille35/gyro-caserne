import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

const dossier = new URL('../migrations/', import.meta.url);
const migrations = readdirSync(dossier).filter((f) => f.endsWith('.sql')).sort();
const instructions = (nom: string) => readFileSync(new URL(nom, dossier), 'utf8').split('--> statement-breakpoint');
const la0026 = migrations.find((f) => f.startsWith('0026_'))!;

describe('migration 0026 : heure de fin des manœuvres', () => {
	it('ajoute seulement deux colonnes vides : les manœuvres et publications déjà là restent telles quelles', () => {
		const sqlite = new DatabaseSync(':memory:');
		sqlite.exec('PRAGMA foreign_keys = ON');
		for (const f of migrations.filter((f) => f < '0026_')) for (const i of instructions(f)) sqlite.exec(i);
		sqlite.exec(`
			INSERT INTO publication (mur, auteur, type, texte, cree_le, debut, lieu, convoques) VALUES ('centre', 'planning', 'evenement', 'Manœuvre : Feux', '2026-11-01T08:00', '2026-11-15T08:30', 'Caserne', '"tous"');
			INSERT INTO manoeuvre (debut, theme, lieu, convoques, petit_dejeuner, publication_id) VALUES ('2026-11-15T08:30', 'Feux', 'Caserne', '"tous"', 1, 1);
		`);
		for (const i of instructions(la0026)) sqlite.exec(i);
		expect(sqlite.prepare('SELECT debut, fin, theme, petit_dejeuner, publication_id FROM manoeuvre').all()).toEqual([{ debut: '2026-11-15T08:30', fin: null, theme: 'Feux', petit_dejeuner: 1, publication_id: 1 }]);
		expect(sqlite.prepare('SELECT debut, fin, texte FROM publication').all()).toEqual([{ debut: '2026-11-15T08:30', fin: null, texte: 'Manœuvre : Feux' }]);
		// Additive seulement : rien d'autre que deux ALTER TABLE … ADD.
		expect(instructions(la0026).map((i) => i.trim())).toEqual(['ALTER TABLE `manoeuvre` ADD `fin` text;', 'ALTER TABLE `publication` ADD `fin` text;']);
	});
});
