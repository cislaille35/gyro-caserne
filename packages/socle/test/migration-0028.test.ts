import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

const dossier = new URL('../migrations/', import.meta.url);
const migrations = readdirSync(dossier).filter((f) => f.endsWith('.sql')).sort();
const instructions = (nom: string) => readFileSync(new URL(nom, dossier), 'utf8').split('--> statement-breakpoint');
const la0028 = migrations.find((f) => f.startsWith('0028_'))!;

describe('migration 0028 : le référent habillement natif perd sa marque de modèle', () => {
	it('efface le modèle du référent habillement natif, même renommé ; un rôle créé à partir d’un modèle garde le sien', () => {
		const sqlite = new DatabaseSync(':memory:');
		sqlite.exec('PRAGMA foreign_keys = ON');
		for (const f of migrations.filter((f) => f < '0028_')) for (const i of instructions(f)) sqlite.exec(i);
		sqlite.exec(`
			INSERT INTO responsabilite (nom, nature, type_perimetre, modele) VALUES
				('Référent habillement', 'mission', 'centre', 'referent_habillement'),
				('Tenues de sport', 'mission', 'centre', 'referent_habillement'),
				('Trésorier', 'mission', 'comite', 'membre_comite'),
				('Tenues', 'mission', 'centre', 'referent_habillement');
			INSERT INTO journal (quand, acteur, action, cible_type, cible_id) VALUES ('2026-11-17T10:00', 'Chef', 'creer_responsabilite', 'responsabilite', 2), ('2026-11-17T10:01', 'Chef', 'creer_responsabilite', 'responsabilite', 3);
		`);
		for (const i of instructions(la0028)) sqlite.exec(i);
		expect(sqlite.prepare('SELECT nom, modele FROM responsabilite ORDER BY id').all()).toEqual([
			{ nom: 'Référent habillement', modele: null },
			{ nom: 'Tenues de sport', modele: 'referent_habillement' },
			{ nom: 'Trésorier', modele: 'membre_comite' },
			// Le natif renommé par le centre : pas de création au journal.
			{ nom: 'Tenues', modele: null }
		]);
	});

	it('laisse un « Référent habillement » créé à la main par le centre (son journal le dit)', () => {
		const sqlite = new DatabaseSync(':memory:');
		sqlite.exec('PRAGMA foreign_keys = ON');
		for (const f of migrations.filter((f) => f < '0028_')) for (const i of instructions(f)) sqlite.exec(i);
		sqlite.exec(`
			INSERT INTO responsabilite (nom, nature, type_perimetre, modele) VALUES ('Référent habillement', 'mission', 'centre', 'referent_habillement');
			INSERT INTO journal (quand, acteur, action, cible_type, cible_id) VALUES ('2026-11-01T10:00', 'Chef', 'creer_responsabilite', 'responsabilite', 1);
		`);
		for (const i of instructions(la0028)) sqlite.exec(i);
		expect(sqlite.prepare('SELECT modele FROM responsabilite').get()).toEqual({ modele: 'referent_habillement' });
	});
});
