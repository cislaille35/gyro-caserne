import type { DonneesFichier } from '@gyro-caserne/socle';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import writeXlsxFile from 'write-excel-file/universal';
import { describe, expect, it } from 'vitest';
import { ecrireClasseur, lireClasseur, nomDuFichier } from './classeur.ts';

const entetes = ['N°', 'E-mail', 'Prénom', 'Nom', 'Grade', 'Date de grade', 'Équipe', 'Statut', 'Profil', 'Téléphone', 'Naissance', 'Entrée au centre', 'Engagement SPV', 'Référent pharmacie', 'Comité : Amicale'];

const donnees: DonneesFichier = {
	entetes,
	listes: {
		grades: ['Sapeur', 'Caporal', 'Sergent'],
		equipes: ['Équipe 1', 'Équipe 2'],
		statuts: ['Opérationnel', 'Stagiaire', 'Inapte temporaire', 'Suspendu', 'Parti'],
		profils: ['Agent', 'Gestionnaire'],
		rolesComite: ['Président', 'Membre']
	},
	colonnesListe: { Grade: 'grades', Équipe: 'equipes', Statut: 'statuts', Profil: 'profils', 'Référent pharmacie': 'oui', 'Comité : Amicale': 'rolesComite' },
	lignes: [
		['12', 'jean.dupont@exemple.fr', 'Jean', 'Dupont', 'Caporal', '01/03/2024', 'Équipe 2', 'Opérationnel', 'Agent', '06 12 34 56 78', '15/07/1990', '01/09/2015', '01/09/2015', 'Oui', 'Membre'],
		['13', 'lea.martin@exemple.fr', 'Léa', 'Martin', '', '', '', 'Stagiaire', 'Gestionnaire', '', '', '', '', '', '']
	],
	repere: { journal: 340, personne: 27, date: '2026-10-27' }
};

// Contenu d'un fichier XML du classeur (un .xlsx est un zip).
async function xml(classeur: Blob, chemin: string): Promise<string> {
	const fichier = join(mkdtempSync(join(tmpdir(), 'classeur-')), 'c.xlsx');
	writeFileSync(fichier, Buffer.from(await classeur.arrayBuffer()));
	return execFileSync('unzip', ['-p', fichier, chemin], { encoding: 'utf8' });
}

// Classeur d'une seule feuille « Effectif », écrit tel quel.
async function feuille(lignes: (string | number | Date | null)[][]): Promise<Blob> {
	const cellule = (v: string | number | Date | null) =>
		v === null ? null : v instanceof Date ? { value: v, type: Date, format: 'dd/mm/yyyy' } : typeof v === 'number' ? { value: v, type: Number } : { value: v, type: String };
	return writeXlsxFile([{ sheet: 'Effectif', data: lignes.map((l) => l.map(cellule)) }]).toBlob();
}

describe('ecrireClasseur puis lireClasseur', () => {
	it("redonne les en-têtes, les lignes et le repère", async () => {
		const lu = await lireClasseur(await ecrireClasseur(donnees));
		expect(lu.entetes).toEqual(entetes);
		expect(lu.lignes).toEqual([
			{ numero: 2, cellules: donnees.lignes[0] },
			{ numero: 3, cellules: donnees.lignes[1] }
		]);
		expect(lu.repere).toEqual({ journal: 340, personne: 27, date: '2026-10-27' });
	});

	it("sans repère, le classeur n'a pas de feuille « Repère »", async () => {
		const classeur = await ecrireClasseur({ ...donnees, repere: null });
		expect((await lireClasseur(classeur)).repere).toBeNull();
		expect(await xml(classeur, 'xl/workbook.xml')).not.toContain('Repère');
	});

	it('pose une liste déroulante par colonne à liste et masque les feuilles annexes', async () => {
		const classeur = await ecrireClasseur(donnees);
		const effectif = await xml(classeur, 'xl/worksheets/sheet1.xml');
		const validations = [...effectif.matchAll(/<dataValidation [^>]*sqref="([A-Z]+)2:[A-Z]+1000"[^>]*><formula1>([^<]*)<\/formula1>/g)].map((m) => [m[1], m[2]]);
		expect(validations).toEqual([
			['E', 'Listes!$A$1:$A$3'],
			['G', 'Listes!$B$1:$B$2'],
			['H', 'Listes!$C$1:$C$5'],
			['I', 'Listes!$D$1:$D$2'],
			['N', 'Listes!$F$1:$F$1'],
			['O', 'Listes!$E$1:$E$2']
		]);
		// Ordre imposé par le format : les listes juste après les données.
		expect(effectif).toMatch(/<\/sheetData><dataValidations count="6">/);
		const classeurXml = await xml(classeur, 'xl/workbook.xml');
		expect(classeurXml).toMatch(/<sheet [^>]*name="Listes"[^>]*state="hidden"/);
		expect(classeurXml).toMatch(/<sheet [^>]*name="Repère"[^>]*state="hidden"/);
		expect(classeurXml).not.toMatch(/<sheet [^>]*name="Effectif"[^>]*state="hidden"/);
	});

	it("n'écrit pas de liste vide", async () => {
		const classeur = await ecrireClasseur({ ...donnees, listes: { ...donnees.listes, rolesComite: [] } });
		expect(await xml(classeur, 'xl/worksheets/sheet1.xml')).not.toContain('sqref="O2:O1000"');
	});

	it('met la colonne Téléphone au format texte jusqu’à la ligne 1000', async () => {
		const classeur = await ecrireClasseur(donnees);
		const styles = await xml(classeur, 'xl/styles.xml');
		const formatTexte = /<numFmt numFmtId="(\d+)" formatCode="@"\/>/.exec(styles)![1];
		const xfs = /<cellXfs[^>]*>(.*?)<\/cellXfs>/.exec(styles)![1]!.match(/<xf [^>]*>/g)!;
		const styleTexte = xfs.findIndex((x) => x.includes(`numFmtId="${formatTexte}"`));
		expect(styleTexte).toBeGreaterThan(0);
		const effectif = await xml(classeur, 'xl/worksheets/sheet1.xml');
		for (const cellule of ['J2', 'J3', 'J1000']) expect(effectif).toMatch(new RegExp(`<c r="${cellule}" s="${styleTexte}"`));
		expect(effectif).not.toContain('r="J1001"');
		expect((await lireClasseur(classeur)).lignes).toHaveLength(2);
	});
});

describe('lireClasseur', () => {
	it('lit une date en cellule date comme une date en texte J/M/AAAA', async () => {
		const enDate = await lireClasseur(await feuille([['N°', 'Naissance'], [12, new Date(Date.UTC(2024, 2, 1))]]));
		const enTexte = await lireClasseur(await feuille([['N°', 'Naissance'], [12, '1/3/2024']]));
		expect(enDate.lignes).toEqual([{ numero: 2, cellules: ['12', '01/03/2024'] }]);
		expect(enTexte).toEqual(enDate);
	});

	it('redonne son 0 à un téléphone saisi en nombre', async () => {
		const lu = await lireClasseur(await feuille([['N°', 'Téléphone'], [12, 612345678], [13, 123]]));
		expect(lu.lignes.map((l) => l.cellules[1])).toEqual(['0612345678', '123']);
	});

	it('retire les espaces autour des valeurs', async () => {
		const lu = await lireClasseur(await feuille([[' N° ', '  E-mail'], ['  12 ', ' jean.dupont@exemple.fr  ']]));
		expect(lu.entetes).toEqual(['N°', 'E-mail']);
		expect(lu.lignes[0]!.cellules).toEqual(['12', 'jean.dupont@exemple.fr']);
	});

	it('saute les lignes vides en gardant le vrai n° de ligne', async () => {
		const lu = await lireClasseur(await feuille([['N°', 'Nom'], [1, 'Dupont'], [null, '   '], [null, null], [3, 'Martin']]));
		expect(lu.lignes).toEqual([
			{ numero: 2, cellules: ['1', 'Dupont'] },
			{ numero: 5, cellules: ['3', 'Martin'] }
		]);
		expect(lu.repere).toBeNull();
	});

	it("refuse un classeur sans feuille « Effectif »", async () => {
		const autre = await writeXlsxFile([{ sheet: 'Autre', data: [[{ value: 'N°', type: String }]] }]).toBlob();
		await expect(lireClasseur(autre)).rejects.toThrow('Feuille « Effectif » introuvable');
	});
});

describe('nomDuFichier', () => {
	it('date le fichier exporté, pas le modèle', () => {
		expect(nomDuFichier(false, '2026-10-27')).toBe('effectif-2026-10-27.xlsx');
		expect(nomDuFichier(true, '2026-10-27')).toBe('modele-effectif.xlsx');
	});
});
