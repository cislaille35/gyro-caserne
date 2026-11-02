import { describe, expect, it } from 'vitest';
import { lireFiche } from '@gyro-caserne/socle';
import { load } from './+page.server';
import { GET as donnees } from './donnees/+server';
import { POST as apercu } from './apercu/+server';
import { POST as appliquer } from './appliquer/+server';
import { locaux, preparer } from '../../de-test.ts';

const json = (corps: unknown) => new Request('http://x', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corps) });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const appeler = (f: unknown, locals: unknown, request?: Request) => (f as any)({ locals, request });

describe('/engins/fiches/fichier', () => {
	it('réservé à qui gère : page, données, aperçu, application', async () => {
		const { base, alice } = await preparer();
		for (const [f, requete] of [[load, undefined], [donnees, undefined], [apercu, json({ feuilles: {} })], [appliquer, json({ feuilles: {} })]] as const)
			await expect(appeler(f, locaux(base, alice), requete)).rejects.toMatchObject({ status: 403 });
	});

	it('exporte, prévoit puis applique ; refuse un corps qui n’est pas un fichier lu', async () => {
		const { base, chef, types } = await preparer();
		const lues = await (await appeler(donnees, locaux(base, chef))).json();
		expect(lues.feuilles.map((f: { nom: string }) => f.nom)).toEqual(['VSAV', 'FPT', 'VTU']);
		const vtu = lues.feuilles[2].lignes.slice(1).map((cellules: string[], i: number) => ({ numero: i + 2, cellules }));
		const lu = { feuilles: { VTU: vtu }, entetes: { VTU: lues.entetes } };
		const prevu = await (await appeler(apercu, locaux(base, chef), json(lu))).json();
		expect(prevu).toMatchObject({ erreurs: [], fiches: [{ type: 'VTU', retires: ['Niveau de carburant (au moins 3/4)'] }] });
		expect((await appeler(appliquer, locaux(base, chef), json(lu))).status).toBe(200);
		expect((await lireFiche(base, types.VTU)).zones[0]!.elements).toHaveLength(3);
		expect((await appeler(apercu, locaux(base, chef), json({ feuilles: 'non' }))).status).toBe(400);
		expect((await appeler(apercu, locaux(base, chef), new Request('http://x', { method: 'POST', body: 'x' }))).status).toBe(415);
		const erreur = await appeler(appliquer, locaux(base, chef), json({ feuilles: { CCF: [{ numero: 2, cellules: ['', 'A', 'B', ''] }] } }));
		expect(erreur.status).toBe(400);
	});
});
