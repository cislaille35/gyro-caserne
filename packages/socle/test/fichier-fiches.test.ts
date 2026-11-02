import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { DonneeInvalide, RefusDroit } from '../src/erreurs.ts';
import { apercuFiches, appliquerFiches, donneesFichierFiches, type FichierFichesLu } from '../src/fichier-fiches.ts';
import { lireFiche } from '../src/fiches.ts';
import { ficheVersion } from '../src/schema.ts';
import { jeuEngins, maintenant } from './de-test-engins.ts';

const ENTETES = ['Réf.', 'Zone', 'Élément', 'Quantité'];
const lu = (feuilles: Record<string, string[][]>): FichierFichesLu => ({
	feuilles: Object.fromEntries(Object.entries(feuilles).map(([nom, lignes]) => [nom, lignes.map((cellules, i) => ({ numero: i + 2, cellules }))])),
	entetes: Object.fromEntries(Object.keys(feuilles).map((nom) => [nom, ENTETES]))
});

async function avecExport() {
	const jeu = await jeuEngins();
	const donnees = await donneesFichierFiches(jeu.base, jeu.referent, maintenant);
	const feuille = (nom: string) => donnees.feuilles.find((f) => f.nom === nom)!.lignes.map((l) => [...l]);
	return { ...jeu, donnees, feuille };
}

describe('fichier des fiches', () => {
	it('exporte une feuille par type, une ligne par élément, dans l’ordre de la fiche', async () => {
		const { donnees, feuille } = await avecExport();
		expect(donnees.entetes).toEqual(ENTETES);
		expect(donnees.feuilles.map((f) => [f.nom, f.lignes.length])).toEqual([['VSAV', 33], ['FPT', 24], ['VTU', 15]]);
		expect(feuille('VTU')[3]).toEqual(['61', 'Cabine', 'Gilets haute visibilité', '3']);
		expect(feuille('VTU')[4]).toEqual(['62', 'Épuisement', 'Motopompe : plein et essai', '']);
	});

	it('réservé à qui gère les engins', async () => {
		const { base, alice } = await jeuEngins();
		await expect(donneesFichierFiches(base, alice, maintenant)).rejects.toBeInstanceOf(RefusDroit);
		await expect(apercuFiches(base, alice, lu({}), maintenant)).rejects.toBeInstanceOf(RefusDroit);
	});

	it('réimporté tel quel : aucun changement, rien d’écrit', async () => {
		const { base, referent, feuille } = await avecExport();
		const fichier = lu({ VSAV: feuille('VSAV'), FPT: feuille('FPT'), VTU: feuille('VTU') });
		const apercu = await apercuFiches(base, referent, fichier, maintenant);
		expect(apercu.erreurs).toEqual([]);
		expect(apercu.fiches.every((f) => !f.ajoutes.length && !f.retires.length && !f.modifies.length && !f.ordre)).toBe(true);
		await appliquerFiches(base, referent, fichier, maintenant);
		expect((await lireFiche(base, (await jeuEngins()).types.VTU)).version.creeLe).not.toBe(maintenant);
	});

	it('aperçu puis application : ajout sans Réf., retrait, libellé, quantité et zone changés ; les autres fiches ne bougent pas', async () => {
		const { base, referent, types, feuille } = await avecExport();
		const vtu = feuille('VTU');
		vtu[0]![2] = 'Carburant (au moins 3/4)';
		vtu[3]![3] = '4';
		vtu[5]![1] = 'Coffres';
		vtu.splice(6, 1);
		vtu.push(['', 'Toit', 'Échelle de toit', '']);
		const fichier = lu({ VTU: vtu });
		const apercu = await apercuFiches(base, referent, fichier, maintenant);
		expect(apercu).toEqual({
			erreurs: [],
			fiches: [
				{
					type: 'VTU',
					version: 1,
					nouvelleVersion: false,
					ajoutes: ['Échelle de toit'],
					retires: ['Aspirateur à eau'],
					modifies: ['Niveau de carburant (au moins 3/4) → Carburant (au moins 3/4)', 'Gilets haute visibilité : 3 → 4', 'Électropompe (passe en Coffres)'],
					ordre: false
				}
			]
		});
		await appliquerFiches(base, referent, fichier, maintenant);
		const fiche = await lireFiche(base, types.VTU);
		expect(fiche.zones.map((z) => z.nom)).toEqual(['Cabine', 'Épuisement', 'Coffres', 'Toit']);
		expect(fiche.zones[0]!.elements[0]).toEqual({ ref: 58, libelle: 'Carburant (au moins 3/4)', quantite: null });
		expect(fiche.zones[3]!.elements[0]!.ref).toBe(73);
		expect(fiche.version).toMatchObject({ numero: 1, creeLe: maintenant });
		expect((await lireFiche(base, types.VSAV)).version.creeLe).not.toBe(maintenant);
	});

	it('une fiche déjà utilisée reçoit une nouvelle version', async () => {
		const { base, referent, types, feuille } = await avecExport();
		await base.update(ficheVersion).set({ utilisee: 1 }).where(eq(ficheVersion.typeId, types.FPT));
		const fpt = feuille('FPT');
		fpt.pop();
		const apercu = await apercuFiches(base, referent, lu({ FPT: fpt }), maintenant);
		expect(apercu.fiches[0]).toMatchObject({ nouvelleVersion: true, retires: ['Tronçonneuse : plein et essai'] });
		await appliquerFiches(base, referent, lu({ FPT: fpt }), maintenant);
		expect((await lireFiche(base, types.FPT)).version.numero).toBe(2);
	});

	it('signale les erreurs ligne par ligne et n’applique rien', async () => {
		const { base, referent, types, feuille } = await avecExport();
		const vtu = feuille('VTU');
		vtu[0]![3] = 'deux';
		vtu[1]![1] = '';
		vtu[2]![0] = vtu[3]![0]!;
		const fichier = lu({ VTU: vtu, CCF: [['', 'Cabine', 'Radio', '']], FPT: [] });
		const { erreurs } = await apercuFiches(base, referent, fichier, maintenant);
		expect(erreurs).toEqual([
			{ feuille: 'VTU', ligne: 2, message: 'Quantité « deux » : un nombre entier de 1 à 999, ou rien' },
			{ feuille: 'VTU', ligne: 3, message: 'Zone vide' },
			{ feuille: 'VTU', ligne: 5, message: 'Réf. 61 en double : effacez-la sur la copie' },
			{ feuille: 'CCF', ligne: 1, message: 'Type d’engin « CCF » inconnu : créez-le d’abord dans l’appli (Fiches → Nouveau type)' },
			{ feuille: 'FPT', ligne: 2, message: 'Feuille vide : une fiche garde au moins un élément (retirez la feuille pour ne pas toucher à cette fiche)' }
		]);
		await expect(appliquerFiches(base, referent, fichier, maintenant)).rejects.toThrow(new DonneeInvalide('Le fichier contient des erreurs'));
		expect((await lireFiche(base, types.VTU)).version.creeLe).not.toBe(maintenant);
	});

	it('refuse deux feuilles pour un même type', async () => {
		const { base, referent, feuille } = await avecExport();
		const { erreurs } = await apercuFiches(base, referent, lu({ VTU: feuille('VTU'), vtu: feuille('VTU') }), maintenant);
		expect(erreurs).toEqual([{ feuille: 'vtu', ligne: 1, message: 'Deux feuilles pour le type VTU' }]);
	});

	it('refuse des colonnes déplacées', async () => {
		const { base, referent, feuille } = await avecExport();
		const fichier = { ...lu({ VTU: feuille('VTU') }), entetes: { VTU: ['Zone', 'Réf.', 'Élément', 'Quantité'] } };
		expect((await apercuFiches(base, referent, fichier, maintenant)).erreurs).toEqual([{ feuille: 'VTU', ligne: 1, message: 'Colonnes attendues, dans l’ordre : Réf., Zone, Élément, Quantité' }]);
	});
});
