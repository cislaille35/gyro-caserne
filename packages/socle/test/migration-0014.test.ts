import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

const dossier = new URL('../migrations/', import.meta.url);
const migrations = readdirSync(dossier).filter((f) => f.endsWith('.sql')).sort();
const appliquer = (sqlite: DatabaseSync, fichier: string) => {
	for (const instruction of readFileSync(new URL(fichier, dossier), 'utf8').split('--> statement-breakpoint')) sqlite.exec(instruction);
};

describe('migration 0014', () => {
	it('le rôle « Chef d’équipe » devient « Chef de garde » ; ses libellé seul ; un nom choisi par le centre est gardé', () => {
		const sqlite = new DatabaseSync(':memory:');
		for (const f of migrations.filter((f) => f < '0014_')) appliquer(sqlite, f);
		const role = (nom: string, systeme: string | null) =>
			sqlite.prepare(`INSERT INTO responsabilite (nom, nature, type_perimetre, systeme) VALUES (?, 'fonction', 'equipe', ?) RETURNING id`).get(nom, systeme) as { id: number };
		const chef = role('Chef d’équipe', 'chef_equipe');
		role('Référent', null);
		appliquer(sqlite, migrations.find((f) => f.startsWith('0014_'))!);
		expect(sqlite.prepare('SELECT id, nom, systeme FROM responsabilite ORDER BY id').all().map((r) => ({ ...r }))).toEqual([
			{ id: chef.id, nom: 'Chef de garde', systeme: 'chef_equipe' },
			{ id: chef.id + 1, nom: 'Référent', systeme: null }
		]);
		sqlite.exec(`UPDATE responsabilite SET nom = 'Chef d''agrès de garde' WHERE id = ${chef.id}`);
		sqlite.exec(/^UPDATE `responsabilite`.*$/m.exec(readFileSync(new URL(migrations.find((f) => f.startsWith('0014_'))!, dossier), 'utf8'))![0]);
		expect(sqlite.prepare(`SELECT nom FROM responsabilite WHERE id = ${chef.id}`).get()).toEqual({ nom: "Chef d'agrès de garde" });
	});
});
