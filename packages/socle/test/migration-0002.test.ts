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

describe('migration 0002', () => {
	it('ne contient que des ajouts de colonnes nullables', () => {
		const liste = instructions(migration('0002_'));
		expect(liste).toHaveLength(2);
		expect(liste.every((i) => /^ALTER TABLE `responsabilite` ADD `(modele|icone)` text;$/.test(i))).toBe(true);
	});

	it('sur une base déjà remplie : rien de perdu, modèle et icône nuls', () => {
		const sqlite = new DatabaseSync(':memory:');
		sqlite.exec('PRAGMA foreign_keys = ON');
		appliquer(sqlite, migration('0000_'));
		appliquer(sqlite, migration('0001_'));
		sqlite.exec(`
			INSERT INTO responsabilite (nom, nature, type_perimetre, systeme) VALUES ('Chef de centre', 'fonction', 'centre', 'chef_centre'), ('Référent engins', 'mission', 'centre', NULL);
			INSERT INTO responsabilite_droit (responsabilite_id, droit, verrouille) VALUES (1, 'GERER_ACCES', 1), (2, 'GERER_FICHES', 0);
		`);
		appliquer(sqlite, migration('0002_'));
		expect(sqlite.prepare('SELECT nom, systeme, modele, icone FROM responsabilite ORDER BY id').all()).toEqual([
			{ nom: 'Chef de centre', systeme: 'chef_centre', modele: null, icone: null },
			{ nom: 'Référent engins', systeme: null, modele: null, icone: null }
		]);
		expect(sqlite.prepare('SELECT count(*) AS n FROM responsabilite_droit').get()).toEqual({ n: 2 });
	});
});
