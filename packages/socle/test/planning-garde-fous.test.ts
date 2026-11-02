import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import centreExemple from '../../../centres/exemple/centre.ts';
import { DonneeInvalide } from '../src/erreurs.ts';
import { changerSemaines, preparerAnnee, reglerRoulement, remplacementsDeSemaine } from '../src/planning/annee.ts';
import { apercuPlanning, appliquerPlanning, donneesFichierPlanning, type DonneesFichierPlanning, type FichierPlanningLu } from '../src/planning/fichier.ts';
import { avisEte, demandeRemplacement } from '../src/schema.ts';
import { jeuEte } from './jeu-ete.ts';

// Garde-fous d'une année publiée : une semaine commencée ne change plus d'équipe ; un changement prévient les deux équipes
// et les personnes des remplacements de la semaine.

const reglage = centreExemple.astreinte;
const maintenant = '2027-03-01T10:00';
const S = '2027-07-09';

async function jeu() {
	const j = await jeuEte();
	const p = await preparerAnnee(j.base, j.chef, 2027, maintenant, reglage);
	const avant = p.semaines.find((s) => s.debut === S)!.equipeId;
	const apres = j.ids.find((id) => id !== avant)!;
	const autre = j.ids.find((id) => id !== avant && id !== apres)!;
	const rang = (id: number) => j.ids.indexOf(id) + 1;
	const deAvant = await j.nouvelle('Avant', rang(avant));
	const deApres = await j.nouvelle('Apres', rang(apres));
	const dAutre = await j.nouvelle('Autre', rang(autre));
	return { ...j, avant, apres, deAvant, deApres, dAutre };
}

const avisDe = async (base: Awaited<ReturnType<typeof jeu>>['base'], id: number) => (await base.select().from(avisEte).where(eq(avisEte.personneId, id))).map((a) => a.texte);

describe('changer l’équipe d’une semaine', () => {
	it('une semaine commencée ou passée ne change plus, l’année publiée ; une semaine à venir, si', async () => {
		const { base, chef, apres } = await jeu();
		await expect(changerSemaines(base, chef, 2027, { [S]: apres }, '2027-07-12T10:00', reglage)).rejects.toThrow(new DonneeInvalide('Semaine du vendredi 9 juillet commencée : son équipe ne change plus'));
		await expect(changerSemaines(base, chef, 2027, { '2027-07-02': apres }, '2027-07-12T10:00', reglage)).rejects.toThrow(DonneeInvalide);
		await changerSemaines(base, chef, 2027, { [S]: apres }, '2027-07-08T10:00', reglage);
	});

	it('l’année publiée : les agents des deux équipes sont prévenus, pas les autres', async () => {
		const { base, chef, apres, deAvant, deApres, dAutre } = await jeu();
		await changerSemaines(base, chef, 2027, { [S]: apres }, maintenant, reglage);
		const texte = expect.stringMatching(/^La semaine du vendredi 9 juillet passe de l’Équipe \d à l’Équipe \d\.$/);
		expect(await avisDe(base, deAvant)).toEqual([texte]);
		expect(await avisDe(base, deApres)).toEqual([texte]);
		expect(await avisDe(base, dAutre)).toEqual([]);
		const [a] = await base.select().from(avisEte).where(eq(avisEte.personneId, deAvant));
		expect(a).toMatchObject({ quoi: 'semaine', url: '/planning' });
	});

	it('une semaine remise à la même équipe ne prévient personne', async () => {
		const { base, chef, avant, deAvant } = await jeu();
		await changerSemaines(base, chef, 2027, { [S]: avant }, maintenant, reglage);
		expect(await avisDe(base, deAvant)).toEqual([]);
	});

	it('année non publiée : personne n’est prévenu', async () => {
		const { base, chef, ids, deAvant } = await jeu();
		await reglerRoulement(base, chef, 2028, ids, maintenant);
		await changerSemaines(base, chef, 2028, { '2028-07-07': ids[0]! }, maintenant, reglage);
		await changerSemaines(base, chef, 2028, { '2028-07-07': ids[1]! }, maintenant, reglage);
		expect(await avisDe(base, deAvant)).toEqual([]);
	});

	it('les remplacements conclus ou en cours de la semaine sont montrés avant, et leurs personnes prévenues après', async () => {
		const { base, chef, apres, deAvant, dAutre, deApres } = await jeu();
		const nuit = { debut: '2027-07-12T18:00', fin: '2027-07-13T06:00' };
		await base.insert(demandeRemplacement).values([
			{ genre: 'remplacement', demandeurId: deAvant, remplacantId: dAutre, periodes: JSON.stringify([nuit]), debut: nuit.debut, etat: 'conclue', creeLe: maintenant },
			{ genre: 'remplacement', demandeurId: deAvant, periodes: JSON.stringify([{ debut: '2027-07-14T18:00', fin: '2027-07-15T06:00' }]), debut: '2027-07-14T18:00', etat: 'attente', creeLe: maintenant },
			// Hors de la semaine, ou refusée : pas touchées.
			{ genre: 'remplacement', demandeurId: deApres, remplacantId: dAutre, periodes: JSON.stringify([{ debut: '2027-07-19T18:00', fin: '2027-07-20T06:00' }]), debut: '2027-07-19T18:00', etat: 'conclue', creeLe: maintenant },
			{ genre: 'remplacement', demandeurId: deApres, periodes: JSON.stringify([nuit]), debut: nuit.debut, etat: 'refusee', creeLe: maintenant }
		]);
		expect(await remplacementsDeSemaine(base, chef, 2027, S, maintenant, reglage)).toEqual([
			{ texte: 'Nuit du lundi 12 juillet : Avant Test remplacé par Autre Test', conclu: true, personnes: [deAvant, dAutre] },
			{ texte: 'Nuit du mercredi 14 juillet : Avant Test cherche un remplaçant', conclu: false, personnes: [deAvant] }
		]);
		await changerSemaines(base, chef, 2027, { [S]: apres }, maintenant, reglage);
		const touche = expect.stringMatching(/^Votre remplacement \(nuit du lundi 12 juillet\) est touché : la semaine du vendredi 9 juillet passe de l’Équipe \d à l’Équipe \d\. Voyez-le avec votre chef de garde\.$/);
		expect(await avisDe(base, dAutre)).toEqual([touche]);
		// Une personne d'une des équipes qui a un remplacement dans la semaine : un avis par remplacement, pas en plus celui de l'équipe.
		expect(await avisDe(base, deAvant)).toHaveLength(2);
		expect((await avisDe(base, deAvant)).every((t) => t.startsWith('Votre remplacement'))).toBe(true);
		expect(await avisDe(base, deApres)).toHaveLength(1);
	});

	it('un échange dont une partie tombe dans la semaine est touché, même si l’autre est bien avant', async () => {
		const { base, chef, deAvant, dAutre } = await jeu();
		const avant = { debut: '2027-06-14T18:00', fin: '2027-06-15T06:00' };
		const dedans = { debut: '2027-07-12T18:00', fin: '2027-07-13T06:00' };
		await base.insert(demandeRemplacement).values({ genre: 'echange', demandeurId: dAutre, remplacantId: deAvant, periodes: JSON.stringify([avant]), periodesCible: JSON.stringify([dedans]), debut: avant.debut, etat: 'conclue', creeLe: maintenant });
		expect(await remplacementsDeSemaine(base, chef, 2027, S, maintenant, reglage)).toEqual([{ texte: 'Nuit du lundi 12 juillet : Autre Test échange avec Avant Test', conclu: true, personnes: [dAutre, deAvant] }]);
	});

	it('un même choix peut garder une semaine commencée et changer une semaine à venir', async () => {
		const { base, chef, apres } = await jeu();
		const passee = (await preparerAnnee(base, chef, 2027, maintenant, reglage)).semaines.find((s) => s.debut === '2027-07-02')!;
		await changerSemaines(base, chef, 2027, { [passee.debut]: passee.equipeId, '2027-07-16': apres }, '2027-07-12T10:00', reglage);
	});
});

// Le classeur relu tel qu'exporté, chaque ligne numérotée comme dans le tableur.
const relu = (d: DonneesFichierPlanning, retouche: (f: Record<string, string[][]>) => void): FichierPlanningLu => {
	const f = Object.fromEntries(d.feuilles.map((x) => [x.nom, x.lignes.map((l) => [...l])]));
	retouche(f);
	return { feuilles: Object.fromEntries(Object.entries(f).map(([nom, lignes]) => [nom, lignes.map((cellules, i) => ({ numero: i + 2, cellules }))])) };
};

describe('changer une semaine par le fichier', () => {
	const changer = (nom: string) => (f: Record<string, string[][]>) => {
		const l = f['Semaines']!.find((x) => x[1] === '09/07/2027')!;
		l[3] = nom;
	};

	it('une semaine commencée est refusée, avec sa ligne', async () => {
		const { base, chef, ids, apres } = await jeu();
		const nom = `Équipe ${ids.indexOf(apres) + 1}`;
		const d = await donneesFichierPlanning(base, chef, 2027, '2027-07-12T10:00', reglage);
		const apercu = await apercuPlanning(base, chef, 2027, relu(d, changer(nom)), '2027-07-12T10:00', reglage);
		expect(apercu.erreurs).toEqual([{ feuille: 'Semaines', ligne: expect.any(Number), message: 'Semaine du vendredi 9 juillet commencée : son équipe ne change plus' }]);
	});

	it('appliqué sur une année publiée : les deux équipes sont prévenues', async () => {
		const { base, chef, ids, apres, deAvant, deApres, dAutre } = await jeu();
		const d = await donneesFichierPlanning(base, chef, 2027, maintenant, reglage);
		await appliquerPlanning(base, chef, 2027, relu(d, changer(`Équipe ${ids.indexOf(apres) + 1}`)), maintenant, reglage);
		expect(await avisDe(base, deAvant)).toHaveLength(1);
		expect(await avisDe(base, deApres)).toHaveLength(1);
		expect(await avisDe(base, dAutre)).toEqual([]);
	});
});
