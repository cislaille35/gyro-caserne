import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

const dossier = new URL('../migrations/', import.meta.url);
const migrations = readdirSync(dossier).filter((f) => f.endsWith('.sql')).sort();
const appliquer = (sqlite: DatabaseSync, nom: string) => {
	for (const instruction of readFileSync(new URL(nom, dossier), 'utf8').split('--> statement-breakpoint')) sqlite.exec(instruction);
};
const jusqua = (limite: string) => {
	const sqlite = new DatabaseSync(':memory:');
	sqlite.exec('PRAGMA foreign_keys = ON');
	for (const f of migrations.filter((f) => f < limite)) appliquer(sqlite, f);
	return sqlite;
};
const droitsAgent = (sqlite: DatabaseSync) =>
	sqlite.prepare(`SELECT droit FROM profil_droit d JOIN profil p ON p.id = d.profil_id WHERE p.nom = 'Agent' AND droit = 'FAIRE_PRISE_DE_GARDE'`).all().length;

describe('migration 0018', () => {
	it('donne la prise de garde au profil Agent, une seule fois', () => {
		const sqlite = jusqua('0018_');
		sqlite.exec(`INSERT INTO profil (nom, type_personne) VALUES ('Agent', 'agent'), ('Extérieur', 'exterieur');`);
		const fichier = migrations.find((f) => f.startsWith('0018_'))!;
		appliquer(sqlite, fichier);
		expect(droitsAgent(sqlite)).toBe(1);
		expect(sqlite.prepare(`SELECT count(*) AS n FROM profil_droit WHERE droit = 'FAIRE_PRISE_DE_GARDE'`).get()).toEqual({ n: 1 });
	});

	it('base vide : rien d’ajouté (le jeu de départ s’en charge)', () => {
		const sqlite = jusqua('0019_');
		expect(droitsAgent(sqlite)).toBe(0);
	});

	it('une seule prise par engin et par relève ; une prise validée a sa date', () => {
		const sqlite = jusqua('0019_');
		sqlite.exec(`INSERT INTO profil (nom, type_personne) VALUES ('Agent', 'agent');
			INSERT INTO personne (email, prenom, nom) VALUES ('a@b.fr', 'A', 'B');
			INSERT INTO type_engin (nom, ordre) VALUES ('VSAV', 1);
			INSERT INTO fiche_version (type_id, numero, auteur, cree_le) VALUES (1, 1, 'x', 'x');
			INSERT INTO engin (nom, type_id, cree_le) VALUES ('VSAV 1', 1, 'x');`);
		const prise = (releve: string, etat = 'en_cours', validee: string | null = null) =>
			sqlite.prepare(`INSERT INTO prise_garde (engin_id, releve, version_id, etat, commencee_par, commencee_le, modifiee_par, modifiee_le, validee_le) VALUES (1, ?, 1, ?, 1, 'x', 1, 'x', ?)`).run(releve, etat, validee);
		prise('2026-10-30T17:30');
		expect(() => prise('2026-10-30T17:30')).toThrow(/UNIQUE/);
		expect(() => prise('2026-11-06T17:30', 'validee')).toThrow(/CHECK/);
		expect(() => prise('2026-11-06T17:30', 'validee', '2026-11-06T18:40')).not.toThrow();
	});
});
