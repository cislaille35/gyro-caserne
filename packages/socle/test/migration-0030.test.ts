import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

const dossier = new URL('../migrations/', import.meta.url);
const migrations = readdirSync(dossier).filter((f) => f.endsWith('.sql')).sort();
const instructions = (nom: string) => readFileSync(new URL(nom, dossier), 'utf8').split('--> statement-breakpoint');

describe('migration 0030 : le remplacement court', () => {
	it('ajoute une colonne vide à chaque demande, sans rien toucher d’autre', () => {
		const sqlite = new DatabaseSync(':memory:');
		sqlite.exec('PRAGMA foreign_keys = ON');
		for (const f of migrations.filter((f) => f < '0030_')) for (const i of instructions(f)) sqlite.exec(i);
		sqlite.exec(`INSERT INTO personne (email, prenom, nom) VALUES ('a@exemple.fr', 'Alice', 'Martin')`);
		sqlite.exec(`INSERT INTO demande_remplacement (genre, demandeur_id, periodes, debut, etat, cree_le) VALUES ('remplacement', 1, '[]', '2026-11-09T18:00', 'attente', '2026-11-01T10:00')`);
		sqlite.exec(`INSERT INTO destinataire_remplacement (demande_id, personne_id) VALUES (1, 1)`);
		for (const i of instructions(migrations.find((f) => f.startsWith('0030_'))!)) sqlite.exec(i);
		expect(sqlite.prepare('SELECT id, genre, etat, court FROM demande_remplacement').all()).toEqual([{ id: 1, genre: 'remplacement', etat: 'attente', court: null }]);
		expect(sqlite.prepare('SELECT count(*) AS n FROM destinataire_remplacement').get()).toEqual({ n: 1 });
	});
});
