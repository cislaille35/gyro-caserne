import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

const dossier = new URL('../migrations/', import.meta.url);
const migrations = readdirSync(dossier).filter((f) => f.endsWith('.sql')).sort();
const appliquer = (sqlite: DatabaseSync, nom: string) => {
	for (const instruction of readFileSync(new URL(nom, dossier), 'utf8').split('--> statement-breakpoint')) sqlite.exec(instruction);
};

describe('migration 0019', () => {
	it('une anomalie déjà signalée arrive « signalée », sans indisponibilité ; un suivi a un geste connu', () => {
		const sqlite = new DatabaseSync(':memory:');
		sqlite.exec('PRAGMA foreign_keys = ON');
		for (const f of migrations.filter((f) => f < '0019_')) appliquer(sqlite, f);
		sqlite.exec(`INSERT INTO personne (email, prenom, nom) VALUES ('a@b.fr', 'A', 'B');
			INSERT INTO type_engin (nom, ordre) VALUES ('VTU', 1);
			INSERT INTO engin (nom, type_id, cree_le) VALUES ('VTU', 1, 'x');
			INSERT INTO anomalie (engin_id, zone, libelle, genre, signalee_par, signalee_le) VALUES (1, 'Coffres', 'Treuil', 'abime', 1, 'x');`);
		appliquer(sqlite, migrations.find((f) => f.startsWith('0019_'))!);
		expect(sqlite.prepare('SELECT etape, motif_attente, prise_en_charge_par, bloquante FROM anomalie').get()).toEqual({ etape: 'signalee', motif_attente: null, prise_en_charge_par: null, bloquante: 0 });
		const suivi = (quoi: string) => sqlite.prepare(`INSERT INTO anomalie_suivi (anomalie_id, quoi, par, le) VALUES (1, ?, 1, 'x')`).run(quoi);
		expect(() => suivi('prise_en_charge')).not.toThrow();
		expect(() => suivi('n_importe_quoi')).toThrow(/CHECK/);
		expect(() => sqlite.prepare(`INSERT INTO avis_anomalie (personne_id, titre, texte, url, cree_le) VALUES (1, 't', 'x', '/', 'x')`).run()).not.toThrow();
	});
});
