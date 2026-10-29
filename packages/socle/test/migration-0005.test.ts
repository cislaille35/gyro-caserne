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

describe('migration 0005', () => {
	it('ne contient que l’ajout de la colonne icone, nullable', () => {
		const liste = instructions(migration('0005_'));
		expect(liste).toEqual(['ALTER TABLE `comite` ADD `icone` text;']);
	});

	it('sur une base en 0004 : le comité reste, icône nulle', () => {
		const sqlite = new DatabaseSync(':memory:');
		sqlite.exec('PRAGMA foreign_keys = ON');
		for (const prefixe of ['0000_', '0001_', '0002_', '0003_', '0004_']) appliquer(sqlite, migration(prefixe));
		sqlite.exec(`INSERT INTO comite (nom, theme) VALUES ('Amicale', 'amicale');`);
		appliquer(sqlite, migration('0005_'));
		expect(sqlite.prepare('SELECT nom, theme, icone FROM comite').all()).toEqual([{ nom: 'Amicale', theme: 'amicale', icone: null }]);
	});
});
