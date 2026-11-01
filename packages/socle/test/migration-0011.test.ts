import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

const dossier = new URL('../migrations/', import.meta.url);
const migrations = readdirSync(dossier).filter((f) => f.endsWith('.sql')).sort();
const appliquer = (sqlite: DatabaseSync, fichier: string) => {
	for (const instruction of readFileSync(new URL(fichier, dossier), 'utf8').split('--> statement-breakpoint')) sqlite.exec(instruction);
};
const jusqua = (sqlite: DatabaseSync, prefixe: string) => {
	for (const f of migrations.filter((f) => f < prefixe)) appliquer(sqlite, f);
};
const fichier0011 = migrations.find((f) => f.startsWith('0011_'))!;

describe('migration 0011', () => {
	it('base déjà remplie : la VL, gérée par le référent engins, et RESERVER pour les profils Agent et Réserve citoyenne', () => {
		const sqlite = new DatabaseSync(':memory:');
		jusqua(sqlite, '0011_');
		sqlite.exec(`INSERT INTO profil (nom, type_personne) VALUES ('Agent', 'agent'), ('Réserve citoyenne', 'exterieur'), ('Autre', 'agent');`);
		sqlite.exec(`INSERT INTO responsabilite (nom, nature, type_perimetre) VALUES ('Référent engins', 'mission', 'centre');`);
		appliquer(sqlite, fichier0011);
		expect(sqlite.prepare('SELECT nom, forme, stock, icone, ouverte_reserve, geree_par_responsabilite_id, geree_par_comite_id FROM ressource').all()).toEqual([
			{ nom: 'VL', forme: 'creneau', stock: null, icone: 'camion', ouverte_reserve: 1, geree_par_responsabilite_id: 1, geree_par_comite_id: null }
		]);
		expect(sqlite.prepare(`SELECT profil_id, perimetre_type, perimetre_id FROM profil_droit WHERE droit = 'RESERVER' ORDER BY profil_id`).all()).toEqual([
			{ profil_id: 1, perimetre_type: 'centre', perimetre_id: null },
			{ profil_id: 2, perimetre_type: 'centre', perimetre_id: null }
		]);
	});

	it('base vide : rien d’ajouté ; rejouée, pas de doublon', () => {
		const vide = new DatabaseSync(':memory:');
		jusqua(vide, '0011_');
		appliquer(vide, fichier0011);
		expect(vide.prepare('SELECT * FROM ressource').all()).toEqual([]);

		const sqlite = new DatabaseSync(':memory:');
		jusqua(sqlite, '0011_');
		sqlite.exec(`INSERT INTO profil (nom, type_personne) VALUES ('Agent', 'agent');`);
		sqlite.exec(`INSERT INTO profil_droit (profil_id, droit, perimetre_type) VALUES (1, 'RESERVER', 'centre');`);
		sqlite.exec(`INSERT INTO responsabilite (nom, nature, type_perimetre) VALUES ('Référent engins', 'mission', 'centre');`);
		appliquer(sqlite, fichier0011);
		const [suite] = readFileSync(new URL(fichier0011, dossier), 'utf8').split('-- Ajouté à la main').slice(1);
		for (const instruction of `--${suite}`.split('--> statement-breakpoint')) sqlite.exec(instruction);
		expect(sqlite.prepare('SELECT count(*) AS n FROM ressource').get()).toEqual({ n: 1 });
		expect(sqlite.prepare(`SELECT count(*) AS n FROM profil_droit WHERE droit = 'RESERVER'`).get()).toEqual({ n: 1 });
	});

	it('une ressource a un seul gestionnaire, et un stock si elle se prend par jours', () => {
		const sqlite = new DatabaseSync(':memory:');
		jusqua(sqlite, '0012_');
		sqlite.exec(`INSERT INTO responsabilite (nom, nature, type_perimetre) VALUES ('R', 'mission', 'centre');`);
		sqlite.exec(`INSERT INTO comite (nom, theme) VALUES ('Amicale', 'amicale');`);
		expect(() => sqlite.exec(`INSERT INTO ressource (nom, forme, stock, icone, geree_par_responsabilite_id, geree_par_comite_id, cree_le) VALUES ('X', 'jours', 3, 'outil', 1, 1, 'x');`)).toThrow();
		expect(() => sqlite.exec(`INSERT INTO ressource (nom, forme, stock, icone, cree_le) VALUES ('X', 'jours', 3, 'outil', 'x');`)).toThrow();
		expect(() => sqlite.exec(`INSERT INTO ressource (nom, forme, stock, icone, geree_par_comite_id, cree_le) VALUES ('X', 'jours', NULL, 'outil', 1, 'x');`)).toThrow();
		sqlite.exec(`INSERT INTO ressource (nom, forme, stock, icone, geree_par_comite_id, cree_le) VALUES ('X', 'jours', 3, 'outil', 1, 'x');`);
	});
});
