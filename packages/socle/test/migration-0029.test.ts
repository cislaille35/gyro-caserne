import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

const dossier = new URL('../migrations/', import.meta.url);
const migrations = readdirSync(dossier).filter((f) => f.endsWith('.sql')).sort();
const instructions = (nom: string) => readFileSync(new URL(nom, dossier), 'utf8').split('--> statement-breakpoint');

describe('migration 0029 : la dernière visite du suivi du centre', () => {
	it('ajoute une colonne vide à chaque personne, sans rien toucher d’autre', () => {
		const sqlite = new DatabaseSync(':memory:');
		sqlite.exec('PRAGMA foreign_keys = ON');
		for (const f of migrations.filter((f) => f < '0029_')) for (const i of instructions(f)) sqlite.exec(i);
		sqlite.exec(`INSERT INTO personne (email, prenom, nom) VALUES ('a@exemple.fr', 'Alice', 'Martin')`);
		for (const i of instructions(migrations.find((f) => f.startsWith('0029_'))!)) sqlite.exec(i);
		expect(sqlite.prepare('SELECT email, prenom, nom, suivi_vu FROM personne').all()).toEqual([{ email: 'a@exemple.fr', prenom: 'Alice', nom: 'Martin', suivi_vu: null }]);
	});
});
