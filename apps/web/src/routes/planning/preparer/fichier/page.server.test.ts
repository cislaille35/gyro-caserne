import { describe, expect, it } from 'vitest';
import writeXlsxFile from 'write-excel-file/universal';
import { manoeuvre, semaineChangee } from '@gyro-caserne/socle';
import { lireClasseurPlanning } from '#lib/planning/classeur.ts';
import { load } from './+page.server';
import { GET } from './donnees/+server';
import { POST as apercu } from './apercu/+server';
import { POST as appliquer } from './appliquer/+server';
import { charger, locaux, preparer } from '../../de-test.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const lire = (locals: unknown, annee: number) => (GET as any)({ locals, url: new URL(`http://x/planning/preparer/fichier/donnees?annee=${annee}`) });
const envoyer = (route: unknown, locals: unknown, corps: unknown) =>
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	(route as any)({ locals: { ...(locals as object), enArrierePlan: () => {} }, request: new Request('http://x', { method: 'POST', body: JSON.stringify(corps), headers: { 'content-type': 'application/json' } }) });

describe('/planning/preparer/fichier', () => {
	it('réservé à qui gère le planning, à la page et à chaque route', async () => {
		const { base, alice, annee } = await preparer();
		const l = locaux(base, alice);
		await expect(charger(load, l)).rejects.toMatchObject({ status: 403 });
		await expect(lire(l, annee)).rejects.toMatchObject({ status: 403 });
		await expect(envoyer(apercu, l, {})).rejects.toMatchObject({ status: 403 });
		await expect(envoyer(appliquer, l, {})).rejects.toMatchObject({ status: 403 });
	});

	it('exporte, prévisualise, applique ; refuse un fichier mal formé', async () => {
		const { base, chef, annee, ids } = await preparer({ publiee: false });
		const l = locaux(base, chef);
		expect(await charger(load, l, `?annee=${annee + 1}`)).toEqual({ annee: annee + 1 });
		const donnees = await (await lire(l, annee)).json();
		const lignes = donnees.feuilles[0].lignes.map((cellules: string[], i: number) => ({ numero: i + 2, cellules }));
		lignes[3].cellules[3] = lignes[3].cellules[3] === 'Équipe 1' ? 'Équipe 2' : 'Équipe 1';
		const lu = { feuilles: { Semaines: lignes, Manœuvres: [{ numero: 2, cellules: ['', `02/05/${annee + 1}`, '08:30', 'Incendie', 'Caserne', 'Toutes', 'Non'] }] } };
		expect((await envoyer(apercu, l, { annee, lu: 'non' })).status).toBe(400);
		const a = await (await envoyer(apercu, l, { annee, lu })).json();
		expect(a.semaines).toHaveLength(1);
		expect(a.erreurs).toEqual([{ feuille: 'Manœuvres', ligne: 2, message: `Date hors de ${annee}` }]);
		expect((await envoyer(appliquer, l, { annee, lu })).status).toBe(400);
		lu.feuilles.Manœuvres = [];
		expect((await envoyer(appliquer, l, { annee, lu })).status).toBe(200);
		expect(await base.select().from(semaineChangee)).toHaveLength(1);
		expect(await base.select().from(manoeuvre)).toEqual([]);
		expect(ids).toHaveLength(4);
	});

	it('aller-retour : les heures retapées en nombre dans le tableur s’importent sans erreur', async () => {
		const { base, chef, annee } = await preparer({ publiee: false });
		const l = locaux(base, chef);
		await base.insert(manoeuvre).values({ debut: `${annee}-01-15T07:45`, fin: `${annee}-01-15T12:00`, theme: 'Incendie', lieu: 'Caserne', convoques: '"tous"' });
		const donnees = await (await lire(l, annee)).json();
		// Le fichier exporté, Début et Fin retapés : le tableur en fait des fractions de journée.
		const enNombre = (h: string) => (Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5))) / (24 * 60);
		const cellule = (entete: string, v: string) => (v === '' ? null : ['Début', 'Fin'].includes(entete) ? { value: enNombre(v), type: Number } : { value: v, type: String });
		const feuilles = donnees.feuilles.map((f: { nom: string; entetes: string[]; lignes: string[][] }) => ({
			sheet: f.nom,
			data: [f.entetes.map((e) => ({ value: e, type: String })), ...f.lignes.map((ligne) => ligne.map((v, i) => cellule(f.entetes[i]!, v)))]
		}));
		const lu = await lireClasseurPlanning(await writeXlsxFile(feuilles).toBlob(), donnees.feuilles.map((f: { nom: string }) => f.nom));
		const a = await (await envoyer(apercu, l, { annee, lu })).json();
		expect(a.erreurs).toEqual([]);
		expect(a.manoeuvres).toEqual({ ajoutees: [], modifiees: [], retirees: [] });
	});
});
