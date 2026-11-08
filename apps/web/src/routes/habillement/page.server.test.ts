import { eq } from 'drizzle-orm';
import { attribution, demandeHabillement, responsabilite } from '@gyro-caserne/socle';
import { describe, expect, it } from 'vitest';
import { locaux, preparer, requeteFormulaire } from '../echanges/de-test.ts';
import { actions, load } from './+page.server';
import { actions as actionsDemande, load as demande } from './[id]/+page.server';
import { load as toutes } from './toutes/+page.server';

/* eslint-disable @typescript-eslint/no-explicit-any */
async function jeu() {
	const p = await preparer();
	const [r] = await p.base.select().from(responsabilite).where(eq(responsabilite.nom, 'Référent habillement'));
	await p.base.insert(attribution).values({ personneId: p.bruno.id, responsabiliteId: r!.id, perimetreType: 'centre', perimetreId: null, debut: '2026-01-01', saisiePar: 'super:a@b.fr', saisieLe: '2026-01-01' });
	const demander = async (acteur: unknown, texte: string) => (actions.default as any)({ locals: locaux(p.base, acteur), request: await requeteFormulaire([['texte', texte]]) });
	const geste = async (acteur: unknown, id: number, corps: [string, string][]) => (actionsDemande.default as any)({ locals: locaux(p.base, acteur), params: { id: String(id) }, request: await requeteFormulaire(corps) });
	const ouvrir = (acteur: unknown, id: number | string) => (demande as any)({ locals: locaux(p.base, acteur), params: { id: String(id) }, url: new URL(`http://x/habillement/${id}`) });
	return { ...p, referent: p.bruno, demander, geste, ouvrir };
}
const idDe = async (promesse: Promise<unknown>) => {
	const r = (await promesse.catch((e) => e)) as { status: number; location: string };
	expect(r.status).toBe(303);
	return Number(/\/habillement\/(\d+)\?envoyee$/.exec(r.location)![1]);
};

describe('/habillement', () => {
	it('demande la connexion ; le super administrateur va à toutes les demandes', async () => {
		const { base } = await jeu();
		await expect((load as any)({ locals: locaux(base, null) })).rejects.toMatchObject({ status: 303, location: '/connexion' });
		await expect((load as any)({ locals: locaux(base, { type: 'super', email: 'a@b.fr' }) })).rejects.toMatchObject({ status: 303, location: '/habillement/toutes' });
	});

	it('envoyer une demande mène à son suivi ; vide, elle est refusée avec une phrase, le texte gardé', async () => {
		const { base, alice, demander } = await jeu();
		const id = await idDe(demander(alice, 'Veste textile en L'));
		expect((await (load as any)({ locals: locaux(base, alice) })).enCours.map((d: { id: number }) => d.id)).toEqual([id]);
		expect(await demander(alice, '   ')).toMatchObject({ status: 400, data: { texte: '   ', message: 'Décrivez votre besoin : quelle pièce, quelle taille, pourquoi.' } });
	});

	it('« Toutes les demandes » : pour le référent (et le lien sur sa page), refusé à un agent', async () => {
		const { base, alice, referent, demander } = await jeu();
		await idDe(demander(alice, 'Veste'));
		expect((await (load as any)({ locals: locaux(base, referent) })).gere).toBe(true);
		expect(await (load as any)({ locals: locaux(base, alice) })).toMatchObject({ gere: false, peutDemander: true });
		expect((await (toutes as any)({ locals: locaux(base, referent) })).enCours).toHaveLength(1);
		await expect((toutes as any)({ locals: locaux(base, alice) })).rejects.toMatchObject({ status: 403 });
	});
});

describe('/habillement/[id]', () => {
	it('404 pour un autre agent ou une adresse inconnue ; « envoyee » affiche le bandeau', async () => {
		const { alice, chef, demander, ouvrir, base } = await jeu();
		const id = await idDe(demander(alice, 'Veste'));
		const autre = (await base.select().from(demandeHabillement))[0]!;
		expect(autre.id).toBe(id);
		await expect(ouvrir({ type: 'personne', id: 9999 }, id)).rejects.toMatchObject({ status: 404 });
		await expect(ouvrir(alice, 'abc')).rejects.toMatchObject({ status: 404 });
		expect((await ouvrir(chef, id)).demande.gestes).toEqual(['prendre', 'question', 'traiter']);
	});

	it('les gestes par le formulaire : prendre, question, réponse, traiter, livrer (« Autre » et son mot) ; refus lisible', async () => {
		const { alice, referent, demander, geste, ouvrir } = await jeu();
		const id = await idDe(demander(alice, 'Rangers'));
		expect(await geste(referent, id, [['quoi', 'prendre']])).toEqual({ quoi: 'prendre', succes: 'Vous l’avez prise en compte.' });
		expect(await geste(referent, id, [['quoi', 'question'], ['texte', '']])).toMatchObject({ status: 400, data: { quoi: 'question', message: 'Écrivez votre message.' } });
		await geste(referent, id, [['quoi', 'question'], ['texte', 'Quelle taille ?']]);
		await geste(alice, id, [['quoi', 'repondre'], ['texte', '43']]);
		expect(await geste(referent, id, [['quoi', 'traiter'], ['issue', 'refus'], ['texte', '']])).toMatchObject({ status: 400, data: { message: 'Expliquez le refus en un mot : l’agent le lira.' } });
		await geste(referent, id, [['quoi', 'traiter'], ['issue', 'stock'], ['texte', '']]);
		await geste(referent, id, [['quoi', 'livrer'], ['recuperation', 'autre'], ['texte', 'Au bureau du chef']]);
		expect((await ouvrir(alice, id)).demande).toMatchObject({ etape: 'livree', livraison: 'Au bureau du chef' });
		expect(await geste(alice, id, [['quoi', 'annuler']])).toMatchObject({ status: 400, data: { message: 'Ce geste n’est plus possible : la demande a avancé.' } });
		expect(await geste(alice, id, [['quoi', 'nimporte']])).toMatchObject({ status: 400, data: { quoi: null } });
		await expect(geste({ type: 'personne', id: 9999 }, id, [['quoi', 'prendre']])).rejects.toMatchObject({ status: 404 });
	});

	it('livrer avec une récupération proposée', async () => {
		const { alice, referent, demander, geste, ouvrir } = await jeu();
		const id = await idDe(demander(alice, 'Gants'));
		await geste(referent, id, [['quoi', 'traiter'], ['issue', 'commande'], ['texte', '']]);
		await geste(referent, id, [['quoi', 'livrer'], ['recuperation', 'Dans votre casier'], ['texte', '']]);
		expect((await ouvrir(alice, id)).demande.livraison).toBe('Dans votre casier');
	});
});
