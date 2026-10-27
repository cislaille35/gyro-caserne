import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import centreExemple from '../../../centres/exemple/centre.ts';
import { chargerJeuDeDepart } from '../src/jeu-de-depart.ts';
import { estDroitPouvoir } from '../src/listes.ts';
import { responsabilite, responsabiliteDroit } from '../src/schema.ts';
import { baseDeTest } from './base-de-test.ts';

const dossier = new URL('../migrations/', import.meta.url);
const migration = (prefixe: string) => {
	const fichier = readdirSync(dossier).find((f) => f.startsWith(prefixe) && f.endsWith('.sql'));
	if (!fichier) throw new Error(`migration ${prefixe} introuvable`);
	return readFileSync(new URL(fichier, dossier), 'utf8');
};
// Instructions du fichier, sans les lignes de commentaire.
const instructions = (contenu: string) =>
	contenu
		.split('--> statement-breakpoint')
		.map((i) => i.replace(/^\s*--.*$/gm, '').trim())
		.filter(Boolean);
const appliquer = (sqlite: DatabaseSync, contenu: string) => {
	for (const instruction of instructions(contenu)) sqlite.exec(instruction);
};

// Une base comme la préprod avant le lot 2 : 0000 seule, des données et une attribution en cours.
function basePreprod(): DatabaseSync {
	const sqlite = new DatabaseSync(':memory:');
	sqlite.exec('PRAGMA foreign_keys = ON');
	appliquer(sqlite, migration('0000_'));
	sqlite.exec(`
		INSERT INTO profil (nom, type_personne) VALUES ('Agent', 'agent');
		INSERT INTO comite (nom, theme) VALUES ('Comité du centre', 'centre'), ('Amicale', 'amicale');
		INSERT INTO responsabilite (nom, nature, type_perimetre, systeme) VALUES ('Chef de centre', 'fonction', 'centre', 'chef_centre');
		INSERT INTO responsabilite_droit (responsabilite_id, droit, verrouille) VALUES (1, 'GERER_ACCES', 1);
		INSERT INTO personne (email, prenom, nom, profil_id) VALUES ('chef@exemple.fr', 'P', 'N', 1);
		INSERT INTO attribution (personne_id, responsabilite_id, perimetre_type, perimetre_id, debut, saisie_par, saisie_le)
			VALUES (1, 1, 'centre', NULL, '2026-01-01', 'super:admin@exemple.fr', '2026-01-01T08:00:00Z');
	`);
	return sqlite;
}

const referentTechnique = (sqlite: DatabaseSync) =>
	sqlite.prepare(`SELECT id, nature, type_perimetre, comite_attributeur_id, systeme, archivee_le FROM responsabilite WHERE nom = 'Référent technique'`).all();

describe('migration 0001', () => {
	it('jeu de départ sur une base neuve : un seul référent technique, avec ses deux droits', async () => {
		const base = await baseDeTest();
		await chargerJeuDeDepart(base, centreExemple);
		const lignes = await base.select().from(responsabilite).where(eq(responsabilite.nom, 'Référent technique'));
		expect(lignes.map((r) => [r.nature, r.typePerimetre, r.comiteAttributeurId, r.systeme, r.archiveeLe])).toEqual([['fonction', 'centre', null, null, null]]);
		const droits = await base.select().from(responsabiliteDroit).where(eq(responsabiliteDroit.responsabiliteId, lignes[0]!.id));
		expect(droits.map((d) => [d.droit, d.verrouille]).sort()).toEqual([['GERER_COMITES', 0], ['GERER_LISTES', 0]]);
	});

	it('sur une base qui a déjà des données : rien de perdu, colonnes nouvelles à nul, référent technique ajouté une fois', () => {
		const sqlite = basePreprod();
		appliquer(sqlite, migration('0001_'));

		expect(sqlite.prepare('SELECT personne_id, responsabilite_id, debut, fin FROM attribution').all()).toEqual([{ personne_id: 1, responsabilite_id: 1, debut: '2026-01-01', fin: null }]);
		expect(sqlite.prepare('SELECT nom, dissous_le FROM comite ORDER BY id').all()).toEqual([
			{ nom: 'Comité du centre', dissous_le: null },
			{ nom: 'Amicale', dissous_le: null }
		]);
		expect(sqlite.prepare(`SELECT archivee_le FROM responsabilite WHERE nom = 'Chef de centre'`).all()).toEqual([{ archivee_le: null }]);
		const [ref] = referentTechnique(sqlite);
		expect(ref).toEqual({ id: ref!.id, nature: 'fonction', type_perimetre: 'centre', comite_attributeur_id: null, systeme: null, archivee_le: null });
		expect(sqlite.prepare('SELECT droit, verrouille FROM responsabilite_droit WHERE responsabilite_id = ? ORDER BY droit').all(ref!.id)).toEqual([
			{ droit: 'GERER_COMITES', verrouille: 0 },
			{ droit: 'GERER_LISTES', verrouille: 0 }
		]);
	});

	it('rejouer les insertions ne crée pas de doublon', () => {
		const sqlite = basePreprod();
		const contenu = migration('0001_');
		appliquer(sqlite, contenu);
		const insertions = instructions(contenu).filter((i) => i.startsWith('INSERT'));
		expect(insertions).toHaveLength(2);
		for (const i of insertions) sqlite.exec(i);
		const lignes = referentTechnique(sqlite);
		expect(lignes).toHaveLength(1);
		expect(sqlite.prepare('SELECT count(*) AS n FROM responsabilite_droit WHERE responsabilite_id = ?').get(lignes[0]!.id)).toEqual({ n: 2 });
	});

	it('ne contient que des ajouts de colonnes et des insertions', () => {
		expect(instructions(migration('0001_')).every((i) => /^ALTER TABLE `\w+` ADD `\w+` text;$/.test(i) || i.startsWith('INSERT INTO'))).toBe(true);
	});
});

describe('estDroitPouvoir', () => {
	it('distingue les droits de pouvoir des droits métier', () => {
		expect(estDroitPouvoir('GERER_ACCES')).toBe(true);
		expect(estDroitPouvoir('GERER_STOCK')).toBe(false);
	});
});
