import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

const dossier = new URL('../migrations/', import.meta.url);
const migrations = readdirSync(dossier).filter((f) => f.endsWith('.sql')).sort();
const instructions = (nom: string) => readFileSync(new URL(nom, dossier), 'utf8').split('--> statement-breakpoint');
const la0022 = migrations.find((f) => f.startsWith('0022_'))!;

// Comme D1 : clés étrangères actives, toute la migration dans une seule transaction (où `PRAGMA foreign_keys` ne fait rien).
function commeD1(sqlite: DatabaseSync, nom: string) {
	sqlite.exec('BEGIN');
	try {
		for (const i of instructions(nom)) sqlite.exec(i);
		sqlite.exec('COMMIT');
	} catch (e) {
		sqlite.exec('ROLLBACK');
		throw e;
	}
}

function baseA0021(): DatabaseSync {
	const sqlite = new DatabaseSync(':memory:');
	sqlite.exec('PRAGMA foreign_keys = ON');
	for (const f of migrations.filter((f) => f < '0022_')) for (const i of instructions(f)) sqlite.exec(i);
	return sqlite;
}

// Des droits comme en préprod : deux profils, tous les périmètres, des rôles système et d'autres, verrouillés ou non, et un trou dans les rowid.
function remplir(sqlite: DatabaseSync) {
	sqlite.exec(`
		INSERT INTO profil (nom, type_personne) VALUES ('Agent', 'agent'), ('Réserve citoyenne', 'exterieur');
		INSERT INTO comite (nom, theme) VALUES ('Comité du centre', 'centre'), ('Amicale', 'amicale');
		INSERT INTO equipe (nom, couleur, ordre_rotation) VALUES ('Équipe 1', '#aa0000', 1);
		INSERT INTO responsabilite (nom, nature, type_perimetre, comite_attributeur_id, systeme, modele, icone) VALUES
			('Chef de centre', 'fonction', 'centre', NULL, 'chef_centre', NULL, NULL),
			('Chef de centre adjoint', 'fonction', 'centre', NULL, 'chef_centre_adjoint', NULL, NULL),
			('Chef de garde', 'fonction', 'equipe', 1, 'chef_equipe', NULL, NULL),
			('Référent pharmacie', 'mission', 'centre', 1, NULL, 'referent_pharmacie', 'croix'),
			('Ancien rôle', 'mission', 'centre', 1, NULL, NULL, NULL);
		UPDATE responsabilite SET archivee_le = '2026-01-01' WHERE nom = 'Ancien rôle';
		INSERT INTO profil_droit (profil_id, droit, perimetre_type, perimetre_id) VALUES
			(1, 'VOIR_PLANNING', 'centre', NULL), (1, 'RESERVER', 'centre', NULL), (1, 'LIRE_SALON', 'salon', 3),
			(1, 'PUBLIER_SALON', 'equipe', 1), (1, 'GERER_STOCK', 'comite', 2), (1, 'RESERVER', 'ressource', 4),
			(2, 'RESERVER', 'centre', NULL), (2, 'VOIR_PLANNING', 'centre', NULL);
		DELETE FROM profil_droit WHERE droit = 'LIRE_SALON';
		INSERT INTO responsabilite_droit (responsabilite_id, droit, verrouille) VALUES
			(1, 'GERER_ACCES', 1), (1, 'GERER_STOCK', 1), (2, 'GERER_ACCES', 1), (3, 'VALIDER_REMPLACEMENT', 1),
			(4, 'GERER_STOCK', 0), (5, 'ATTRIBUER_RESPONSABILITE', 0);
		DELETE FROM responsabilite_droit WHERE responsabilite_id = 1 AND droit = 'GERER_STOCK';
		INSERT INTO responsabilite_droit (responsabilite_id, droit, verrouille) VALUES (1, 'GERER_STOCK', 1);
	`);
}

const lignes = (sqlite: DatabaseSync, table: string) => sqlite.prepare(`SELECT rowid, * FROM ${table} ORDER BY rowid`).all();
// Tout ce qui décrit une table : colonnes, clés étrangères, index (et leurs colonnes), et sa définition, liste des droits mise à part.
function forme(sqlite: DatabaseSync, table: string) {
	const index = sqlite.prepare(`SELECT name, "unique", origin, partial FROM pragma_index_list(?) ORDER BY name`).all(table);
	const definition = String(sqlite.prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?`).get(table)!.sql);
	return {
		colonnes: sqlite.prepare(`SELECT * FROM pragma_table_info(?)`).all(table),
		cles: sqlite.prepare(`SELECT * FROM pragma_foreign_key_list(?)`).all(table),
		index: index.map((i) => ({ ...i, colonnes: sqlite.prepare(`SELECT * FROM pragma_index_info(?)`).all(String(i.name)) })),
		definition: definition.replace(/^CREATE TABLE [`"]\w+[`"]/, 'CREATE TABLE').replace(", 'GERER_HABILLEMENT'", '')
	};
}
const TABLES = ['profil_droit', 'responsabilite_droit'];

describe('migration 0022 : le droit GERER_HABILLEMENT', () => {
	it('reconstruit les deux tables sans perdre ni changer une ligne, rowid compris', () => {
		const sqlite = baseA0021();
		remplir(sqlite);
		const avant = Object.fromEntries(TABLES.map((t) => [t, lignes(sqlite, t)]));
		commeD1(sqlite, la0022);
		const apres = Object.fromEntries(TABLES.map((t) => [t, lignes(sqlite, t)]));
		expect(apres.profil_droit).toEqual(avant.profil_droit);
		expect(apres.responsabilite_droit!.filter((l) => l.droit !== 'GERER_HABILLEMENT')).toEqual(avant.responsabilite_droit);
		expect(sqlite.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
		expect(sqlite.prepare('PRAGMA integrity_check').get()).toEqual({ integrity_check: 'ok' });
		expect(sqlite.prepare(`SELECT name FROM sqlite_master WHERE name LIKE '__new_%'`).all()).toEqual([]);
	});

	it('recrée colonnes, clés, index et contraintes à l’identique, la liste des droits mise à part', () => {
		const sqlite = baseA0021();
		const avant = TABLES.map((t) => forme(sqlite, t));
		commeD1(sqlite, la0022);
		expect(TABLES.map((t) => forme(sqlite, t))).toEqual(avant);
	});

	it('accepte GERER_HABILLEMENT et refuse toujours un droit inconnu, un périmètre faux, un doublon ou un parent absent', () => {
		const sqlite = baseA0021();
		remplir(sqlite);
		commeD1(sqlite, la0022);
		const profilDroit = (droit: string, type: string, id: number | null, profil = 1) =>
			sqlite.prepare('INSERT INTO profil_droit (profil_id, droit, perimetre_type, perimetre_id) VALUES (?, ?, ?, ?)').run(profil, droit, type, id);
		const roleDroit = (role: number, droit: string, verrou = 0) => sqlite.prepare('INSERT INTO responsabilite_droit (responsabilite_id, droit, verrouille) VALUES (?, ?, ?)').run(role, droit, verrou);
		expect(() => profilDroit('GERER_HABILLEMENT', 'centre', null)).not.toThrow();
		expect(() => roleDroit(5, 'GERER_HABILLEMENT')).not.toThrow();
		expect(() => profilDroit('INCONNU', 'centre', null)).toThrow(/CHECK/);
		expect(() => profilDroit('VOIR_PLANNING', 'centre', 1)).toThrow(/CHECK/);
		expect(() => profilDroit('VOIR_PLANNING', 'caserne', 1)).toThrow(/CHECK/);
		expect(() => profilDroit('VOIR_PLANNING', 'centre', null, 99)).toThrow(/FOREIGN KEY/);
		expect(() => roleDroit(5, 'INCONNU')).toThrow(/CHECK/);
		expect(() => roleDroit(5, 'RESERVER', 2)).toThrow(/CHECK/);
		expect(() => roleDroit(4, 'GERER_STOCK')).toThrow(/UNIQUE|PRIMARY/);
		expect(() => roleDroit(99, 'RESERVER')).toThrow(/FOREIGN KEY/);
		// Un rôle qui a des droits ne se supprime toujours pas.
		expect(() => sqlite.exec('DELETE FROM responsabilite WHERE id = 4')).toThrow(/FOREIGN KEY/);
		expect(() => sqlite.exec('DELETE FROM profil WHERE id = 2')).toThrow(/FOREIGN KEY/);
	});

	it('donne le droit, verrouillé, au chef de centre et à l’adjoint, et ajoute le référent habillement', () => {
		const sqlite = baseA0021();
		remplir(sqlite);
		commeD1(sqlite, la0022);
		expect(sqlite.prepare(`SELECT r.nom, d.verrouille FROM responsabilite_droit d JOIN responsabilite r ON r.id = d.responsabilite_id WHERE d.droit = 'GERER_HABILLEMENT' ORDER BY r.id`).all()).toEqual([
			{ nom: 'Chef de centre', verrouille: 1 },
			{ nom: 'Chef de centre adjoint', verrouille: 1 },
			{ nom: 'Référent habillement', verrouille: 0 }
		]);
		expect(sqlite.prepare(`SELECT nature, type_perimetre, comite_attributeur_id, systeme, archivee_le, modele, icone FROM responsabilite WHERE nom = 'Référent habillement'`).all()).toEqual([
			{ nature: 'mission', type_perimetre: 'centre', comite_attributeur_id: 1, systeme: null, archivee_le: null, modele: 'referent_habillement', icone: null }
		]);
	});

	it('n’ajoute rien à une base vide, ni un second référent habillement à un centre qui en a déjà un', () => {
		const vide = baseA0021();
		commeD1(vide, la0022);
		expect(vide.prepare('SELECT count(*) AS n FROM responsabilite').get()).toEqual({ n: 0 });
		expect(vide.prepare('SELECT count(*) AS n FROM responsabilite_droit').get()).toEqual({ n: 0 });

		const deja = baseA0021();
		remplir(deja);
		deja.exec(`INSERT INTO responsabilite (nom, nature, type_perimetre, comite_attributeur_id) VALUES ('Référent habillement', 'fonction', 'centre', NULL)`);
		commeD1(deja, la0022);
		expect(deja.prepare(`SELECT count(*) AS n FROM responsabilite WHERE nom = 'Référent habillement'`).get()).toEqual({ n: 1 });
		// Celui du centre est gardé tel quel : pas de droit imposé.
		expect(deja.prepare(`SELECT count(*) AS n FROM responsabilite_droit WHERE responsabilite_id = 6`).get()).toEqual({ n: 0 });
	});
});
