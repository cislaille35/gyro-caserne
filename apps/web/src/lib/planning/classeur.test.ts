import type { DonneesFichierPlanning } from '@gyro-caserne/socle';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ecrireClasseurPlanning, lireClasseurPlanning } from './classeur.ts';

const donnees: DonneesFichierPlanning = {
	annee: 2027,
	feuilles: [
		{ nom: 'Semaines', entetes: ['N°', 'Du', 'Au', 'Équipe'], lignes: [['S53', '01/01/2027', '08/01/2027', 'Équipe 1']], listes: { Équipe: ['Équipe 1', 'Équipe 2'] } },
		{ nom: 'Manœuvres', entetes: ['Réf.', 'Date', 'Heure', 'Thème', 'Lieu', 'Équipes', 'Petit-déjeuner'], lignes: [['4', '07/03/2027', '08:30', 'Feux de forêt', 'Caserne', '1, 3', 'Oui']], listes: { 'Petit-déjeuner': ['Oui', 'Non'] } },
		{ nom: 'Vacances scolaires', entetes: ['Nom', 'Du', 'Au'], lignes: [], listes: {} }
	]
};

async function xml(classeur: Blob, chemin: string): Promise<string> {
	const fichier = join(mkdtempSync(join(tmpdir(), 'planning-')), 'c.xlsx');
	writeFileSync(fichier, Buffer.from(await classeur.arrayBuffer()));
	return execFileSync('unzip', ['-p', fichier, chemin], { encoding: 'utf8' });
}

describe('classeur du planning', () => {
	it('aller-retour : les cellules relues sont celles écrites, la feuille Listes est ignorée', async () => {
		const classeur = await ecrireClasseurPlanning(donnees);
		const lu = await lireClasseurPlanning(classeur, ['Semaines', 'Manœuvres', 'Vacances scolaires']);
		expect(lu.feuilles).toEqual({
			Semaines: [{ numero: 2, cellules: ['S53', '01/01/2027', '08/01/2027', 'Équipe 1'] }],
			Manœuvres: [{ numero: 2, cellules: ['4', '07/03/2027', '08:30', 'Feux de forêt', 'Caserne', '1, 3', 'Oui'] }],
			'Vacances scolaires': []
		});
	});

	it('listes déroulantes sur les colonnes Équipe et Petit-déjeuner ; feuille Listes masquée', async () => {
		const classeur = await ecrireClasseurPlanning(donnees);
		expect(await xml(classeur, 'xl/worksheets/sheet1.xml')).toContain('<dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="D2:D400"><formula1>Listes!$A$1:$A$2</formula1>');
		expect(await xml(classeur, 'xl/worksheets/sheet2.xml')).toContain('sqref="G2:G400"><formula1>Listes!$B$1:$B$2</formula1>');
		expect(await xml(classeur, 'xl/workbook.xml')).toMatch(/name="Listes"[^>]*state="hidden"/);
	});

	it('un fichier sans feuille du planning est refusé', async () => {
		const classeur = await ecrireClasseurPlanning({ annee: 2027, feuilles: [{ nom: 'Autre', entetes: ['A'], lignes: [], listes: {} }] });
		await expect(lireClasseurPlanning(classeur, ['Semaines'])).rejects.toThrow('Aucune feuille du planning');
	});
});
