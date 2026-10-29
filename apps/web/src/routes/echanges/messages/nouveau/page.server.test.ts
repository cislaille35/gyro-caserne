import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { attribution, comite, envoyer, personne, profil, responsabilite } from '@gyro-caserne/socle';
import { locaux, preparer } from '../../de-test.ts';
import { load } from './+page.server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const charger = (locals: unknown, url = 'http://x/echanges/messages/nouveau') => (load as any)({ locals, url: new URL(url) });

async function nommer(base: Awaited<ReturnType<typeof preparer>>['base'], personneId: number, nom: string, type: 'equipe' | 'comite', id: number) {
	const [r] = await base.select().from(responsabilite).where(eq(responsabilite.nom, nom));
	await base.insert(attribution).values({ personneId, responsabiliteId: r!.id, perimetreType: type, perimetreId: id, debut: '2026-01-01', saisiePar: 'super:a@b.fr', saisieLe: '2026-01-01' });
}

describe('nouveau message', () => {
	it('demande la connexion', async () => {
		await expect(charger({ acteur: null })).rejects.toMatchObject({ status: 303, location: '/connexion' });
	});

	it('tout le centre, rangé par nom, avec le rôle ou l’équipe ; le lien ouvre la conversation existante, sinon la conversation à créer', async () => {
		const { base, chef, alice, bruno } = await preparer();
		const { conversation } = await envoyer(base, base.photos, alice, { personne: bruno.id }, { texte: 'Salut' }, '2026-10-29T08:00');
		const { personnes } = await charger(locaux(base, alice));
		expect(personnes.map((p: { prenom: string }) => p.prenom)).toEqual(['Bruno', 'Chef']);
		expect(personnes[0]).toMatchObject({ id: bruno.id, sous: 'Équipe 2', lien: `/echanges/messages/${conversation}` });
		expect(personnes[1]).toMatchObject({ id: chef.id, sous: 'Chef de centre', couleur: null, lien: `/echanges/messages/a/${chef.id}` });
		expect(personnes[0].couleur).not.toBeNull();
	});

	it('pour vous : le chef d’équipe, le groupe de l’équipe et ceux des comités, avec leurs liens de création', async () => {
		const { base, alice, bruno, e1 } = await preparer();
		await nommer(base, bruno.id, 'Chef d’équipe', 'equipe', e1.id);
		const [amicale] = await base.select().from(comite).where(eq(comite.nom, 'Amicale'));
		await nommer(base, alice.id, 'Membre de comité', 'comite', amicale!.id);
		await nommer(base, bruno.id, 'Membre de comité', 'comite', amicale!.id);
		const { pourVous } = await charger(locaux(base, alice));
		expect(pourVous.chefs.map((p: { id: number }) => p.id)).toEqual([bruno.id]);
		expect(pourVous.equipes).toEqual([{ id: e1.id, numero: e1.ordreRotation, nom: e1.nom, couleur: e1.couleur, membres: 1, lien: `/echanges/messages/nouveau/groupe?equipe=${e1.id}` }]);
		expect(pourVous.comites).toEqual([{ id: amicale!.id, nom: 'Amicale', icone: 'coeur', membres: 1, lien: `/echanges/messages/nouveau/groupe?comite=${amicale!.id}` }]);
	});

	it('sans raccourci qui ait un sens, « Pour vous » est vide', async () => {
		const { base, bruno } = await preparer();
		expect((await charger(locaux(base, bruno))).pourVous).toEqual({ chefs: [], equipes: [], comites: [] });
	});

	it('rend la recherche reçue sans JavaScript', async () => {
		const { base, alice } = await preparer();
		expect((await charger(locaux(base, alice), 'http://x/echanges/messages/nouveau?q=%20bru%20')).q).toBe('bru');
	});

	it('un extérieur ou le super administrateur repart vers Échanges, avec la raison', async () => {
		const { base } = await preparer();
		const [ext] = await base.select().from(profil).where(eq(profil.typePersonne, 'exterieur'));
		const [p] = await base.insert(personne).values({ email: 'ext@exemple.fr', prenom: 'Ext', nom: 'Rieur', profilId: ext!.id }).returning();
		for (const acteur of [
			{ type: 'personne', id: p!.id },
			{ type: 'super', email: 'a@b.fr' }
		])
			await expect(charger(locaux(base, acteur))).rejects.toMatchObject({ status: 303, location: '/echanges?refus=messagerie' });
	});
});
