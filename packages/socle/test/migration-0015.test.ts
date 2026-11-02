import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

const dossier = new URL('../migrations/', import.meta.url);
const migrations = readdirSync(dossier).filter((f) => f.endsWith('.sql')).sort();
const appliquer = (sqlite: DatabaseSync, fichier: string) => {
	for (const instruction of readFileSync(new URL(fichier, dossier), 'utf8').split('--> statement-breakpoint')) sqlite.exec(instruction);
};

const avant = () => {
	const sqlite = new DatabaseSync(':memory:');
	for (const f of migrations.filter((f) => f < '0015_')) appliquer(sqlite, f);
	return sqlite;
};
const roles = (sqlite: DatabaseSync, lignes: [string, string | null][]) => {
	for (const [nom, systeme] of lignes) sqlite.prepare(`INSERT INTO responsabilite (nom, nature, type_perimetre, systeme) VALUES (?, 'fonction', 'equipe', ?)`).run(nom, systeme);
	appliquer(sqlite, migrations.find((f) => f.startsWith('0015_'))!);
	return sqlite.prepare('SELECT nom, systeme FROM responsabilite ORDER BY id').all().map((r) => ({ ...r }));
};

describe('migration 0015', () => {
	it.each(["Chef d'équipe", "chef d'équipe", 'CHEF D’ÉQUIPE', " Chef d'Équipe "])('« %s » (rôle système) devient « Chef de garde »', (nom) => {
		expect(roles(avant(), [[nom, 'chef_equipe'], ["Chef d'équipe", null]])).toEqual([
			{ nom: 'Chef de garde', systeme: 'chef_equipe' },
			{ nom: "Chef d'équipe", systeme: null }
		]);
	});
	it('un nom choisi par le centre est gardé', () => {
		expect(roles(avant(), [["Chef d'agrès de garde", 'chef_equipe']])).toEqual([{ nom: "Chef d'agrès de garde", systeme: 'chef_equipe' }]);
	});
});
