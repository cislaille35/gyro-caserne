import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

const dossier = new URL('../migrations/', import.meta.url);
const migration = (prefixe: string) => {
	const fichier = readdirSync(dossier).find((f) => f.startsWith(prefixe) && f.endsWith('.sql'));
	if (!fichier) throw new Error(`migration ${prefixe} introuvable`);
	return readFileSync(new URL(fichier, dossier), 'utf8');
};
const instructions = (contenu: string) =>
	contenu
		.split('--> statement-breakpoint')
		.map((i) => i.replace(/^\s*--.*$/gm, '').trim())
		.filter(Boolean);
const appliquer = (sqlite: DatabaseSync, contenu: string) => {
	for (const instruction of instructions(contenu)) sqlite.exec(instruction);
};

describe('migration 0004', () => {
	it('ne contient que des ajouts de colonnes nullables', () => {
		const liste = instructions(migration('0004_'));
		expect(liste).toHaveLength(2);
		expect(liste.every((i) => /^ALTER TABLE `publication` ADD `sondage_(ouverture|cloture)` text;$/.test(i))).toBe(true);
	});

	it('sur une base en 0003 avec un sondage : la ligne reste, dates nulles', () => {
		const sqlite = new DatabaseSync(':memory:');
		sqlite.exec('PRAGMA foreign_keys = ON');
		for (const prefixe of ['0000_', '0001_', '0002_', '0003_']) appliquer(sqlite, migration(prefixe));
		sqlite.exec(`INSERT INTO publication (mur, auteur, type, texte, cree_le, sondage_question, sondage_reponses) VALUES ('vie', 'personne:1', 'message', 'Pizza ?', '2026-10-01T10:00', 'Pizza ?', '["Oui","Non"]');`);
		appliquer(sqlite, migration('0004_'));
		expect(sqlite.prepare('SELECT texte, sondage_question, sondage_ouverture, sondage_cloture FROM publication').all()).toEqual([
			{ texte: 'Pizza ?', sondage_question: 'Pizza ?', sondage_ouverture: null, sondage_cloture: null }
		]);
	});
});
