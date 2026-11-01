import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { attribution, comite, conversation, membreConversation, personne, profil, responsabilite } from '@gyro-caserne/socle';
import { locaux, preparer, requeteFormulaire } from '../../../de-test.ts';
import { actions, load } from './+page.server';

/* eslint-disable @typescript-eslint/no-explicit-any */
const charger = (locals: unknown, requete = '') => (load as any)({ locals, url: new URL(`http://x/echanges/messages/nouveau/groupe${requete}`) });
const creer = async (locals: unknown, corps: [string, string][]) => (actions.creer as any)({ locals, request: await requeteFormulaire(corps) });

describe('nouveau groupe : les membres', () => {
	it('tout le centre, rien de coché, étape des membres', async () => {
		const { base, alice } = await preparer();
		const d = await charger(locaux(base, alice));
		expect(d.etape).toBe('membres');
		expect(d.personnes.map((p: { prenom: string }) => p.prenom)).toEqual(['Bruno', 'Chef']);
		expect(d.coches).toEqual([]);
		expect(d.nom).toBe('');
		expect(d.icone).toBe('groupe');
	});

	it('?equipe= : les membres du jour de l’équipe cochés, le nom de l’équipe proposé', async () => {
		const { base, alice, e1 } = await preparer();
		const [r] = await base.select().from(responsabilite).where(eq(responsabilite.nom, 'Chef de garde'));
		const [claire] = await base.insert(personne).values({ email: 'claire@exemple.fr', prenom: 'Claire', nom: 'Test', profilId: (await base.select().from(profil).where(eq(profil.nom, 'Agent')))[0]!.id }).returning();
		await base.insert(attribution).values({ personneId: claire!.id, responsabiliteId: r!.id, perimetreType: 'equipe', perimetreId: e1.id, debut: '2026-01-01', saisiePar: 'super:a@b.fr', saisieLe: '2026-01-01' });
		const d = await charger(locaux(base, alice), `?equipe=${e1.id}`);
		expect(d.coches).toEqual([claire!.id]);
		expect(d.nom).toBe(e1.nom);
		expect(d.icone).toBe('groupe');
	});

	it('?comite= : ses membres cochés, son nom et son icône proposés', async () => {
		const { base, alice, bruno } = await preparer();
		const [amicale] = await base.select().from(comite).where(eq(comite.nom, 'Amicale'));
		const [r] = await base.select().from(responsabilite).where(eq(responsabilite.nom, 'Membre de comité'));
		for (const p of [alice, bruno]) await base.insert(attribution).values({ personneId: p.id, responsabiliteId: r!.id, perimetreType: 'comite', perimetreId: amicale!.id, debut: '2026-01-01', saisiePar: 'super:a@b.fr', saisieLe: '2026-01-01' });
		const d = await charger(locaux(base, alice), `?comite=${amicale!.id}`);
		expect(d.coches).toEqual([bruno.id]);
		expect(d.nom).toBe('Amicale');
		expect(d.icone).toBe('coeur');
	});

	it('un raccourci illisible, inconnu ou dissous ne coche rien', async () => {
		const { base, alice } = await preparer();
		const [dissous] = await base.insert(comite).values({ nom: 'Ancien', theme: 'centre', dissousLe: '2026-01-01' }).returning();
		for (const q of ['?equipe=abc', '?equipe=9999', '?comite=-1', `?comite=${dissous!.id}`]) {
			const d = await charger(locaux(base, alice), q);
			expect(d.coches, q).toEqual([]);
			expect(d.nom, q).toBe('');
		}
	});

	it('« Suivant » : l’étape du nom avec les membres choisis, le nom et l’icône gardés ; une personne hors annuaire est écartée', async () => {
		const { base, alice, bruno, chef } = await preparer();
		const d = await charger(locaux(base, alice), `?etape=nom&membres=${bruno.id}&membres=${chef.id}&membres=99999&membres=x&nom=Garde&icone=coeur`);
		expect(d.etape).toBe('nom');
		expect(d.coches).toEqual([bruno.id, chef.id]);
		expect(d.nom).toBe('Garde');
		expect(d.icone).toBe('coeur');
		expect(d.erreur).toBeNull();
	});

	it('« Suivant » sans personne : on reste sur les membres, avec l’erreur ; une icône inconnue redevient « groupe »', async () => {
		const { base, alice } = await preparer();
		const vide = await charger(locaux(base, alice), '?etape=nom');
		expect(vide.etape).toBe('membres');
		expect(vide.erreur).toBe('Choisissez au moins une personne.');
		const icone = await charger(locaux(base, alice), '?etape=nom&icone=dragon');
		expect(icone.icone).toBe('groupe');
	});

	it('un extérieur ou le super administrateur repart vers Échanges', async () => {
		const { base } = await preparer();
		await expect(charger(locaux(base, { type: 'super', email: 'a@b.fr' }))).rejects.toMatchObject({ status: 303, location: '/echanges?refus=messagerie' });
	});
});

describe('nouveau groupe : créer', () => {
	it('crée le groupe et ouvre sa conversation', async () => {
		const { base, alice, bruno, chef } = await preparer();
		const reponse = await creer(locaux(base, alice), [
			['nom', '  Départ de Thomas '],
			['icone', 'coeur'],
			['membres', String(bruno.id)],
			['membres', String(chef.id)]
		]).catch((e: unknown) => e);
		const [g] = await base.select().from(conversation).where(eq(conversation.type, 'groupe'));
		expect(reponse).toMatchObject({ status: 303, location: `/echanges/messages/${g!.id}` });
		expect(g).toMatchObject({ nom: 'Départ de Thomas', icone: 'coeur', creePar: alice.id });
		expect((await base.select().from(membreConversation).where(eq(membreConversation.conversationId, g!.id))).map((m) => m.personneId).sort()).toEqual([alice.id, bruno.id, chef.id].sort());
	});

	it('erreurs reliées à leur champ : nom vide, nom trop long, icône inconnue, aucun membre ; les valeurs sont gardées', async () => {
		const { base, alice, bruno } = await preparer();
		const cas: [[string, string][], string, string][] = [
			[[['nom', '  '], ['membres', String(bruno.id)]], 'nom', 'Donnez un nom au groupe.'],
			[[['nom', 'x'.repeat(61)], ['membres', String(bruno.id)]], 'nom', 'Nom trop long : 60 caractères au plus.'],
			[[['nom', 'Garde'], ['icone', 'dragon'], ['membres', String(bruno.id)]], 'icone', 'Choisissez une icône de la liste.'],
			[[['nom', 'Garde']], 'membres', 'Choisissez au moins une personne.'],
			[[['nom', 'Garde'], ...Array.from({ length: 60 }, (_, i): [string, string] => ['membres', String(1000 + i)])], 'membres', '60 membres au plus, vous compris.']
		];
		for (const [corps, champ, message] of cas) {
			const r = await creer(locaux(base, alice), corps);
			expect(r.status, champ).toBe(400);
			expect(r.data.erreurs).toEqual({ [champ]: message });
			expect(r.data.valeurs.nom).toBe(corps.find(([c]) => c === 'nom')![1]);
		}
		expect(await base.select().from(conversation)).toHaveLength(0);
	});

	it('une personne partie entre-temps : l’erreur est sur les membres', async () => {
		const { base, alice, bruno } = await preparer();
		await base.update(personne).set({ statut: 'parti' }).where(eq(personne.id, bruno.id));
		const r = await creer(locaux(base, alice), [['nom', 'Garde'], ['membres', String(bruno.id)]]);
		expect(r.status).toBe(400);
		expect(r.data.erreurs).toEqual({ membres: 'Une personne choisie n’est plus dans l’annuaire.' });
	});

	it('les membres choisis reviennent avec l’erreur', async () => {
		const { base, alice, bruno } = await preparer();
		const r = await creer(locaux(base, alice), [
			['nom', ''],
			['icone', 'livre'],
			['membres', String(bruno.id)]
		]);
		expect(r.data.valeurs).toEqual({ nom: '', icone: 'livre', membres: [bruno.id] });
	});

	it('un extérieur ou le super administrateur repart vers Échanges', async () => {
		const { base, bruno } = await preparer();
		await expect(creer(locaux(base, { type: 'super', email: 'a@b.fr' }), [['nom', 'Garde'], ['membres', String(bruno.id)]])).rejects.toMatchObject({ status: 303, location: '/echanges?refus=messagerie' });
	});
});

describe('ajouter des membres à un groupe (?ajouter=)', () => {
	const ajouter = async (locals: unknown, id: number | string, corps: [string, string][]) =>
		(actions.ajouter as any)({ locals, url: new URL(`http://x/echanges/messages/nouveau/groupe?ajouter=${id}&/ajouter`), request: await requeteFormulaire(corps) }).catch((e: unknown) => e);

	async function groupe() {
		const jeu = await preparer();
		const [claire] = await jeu.base.insert(personne).values({ email: 'claire@exemple.fr', prenom: 'Claire', nom: 'Test', profilId: (await jeu.base.select().from(profil).where(eq(profil.nom, 'Agent')))[0]!.id }).returning();
		const id = await (await import('@gyro-caserne/socle')).creerGroupe(jeu.base, jeu.alice, { nom: 'Garde', membres: [jeu.bruno.id] }, '2026-10-28T09:00');
		return { ...jeu, claire: claire!, id };
	}

	it('ceux qui ne sont pas encore membres, le groupe nommé, à l’étape des membres', async () => {
		const { base, alice, id } = await groupe();
		const d = await charger(locaux(base, alice), `?ajouter=${id}`);
		expect(d).toMatchObject({ etape: 'membres', ajouter: { id, nom: 'Garde' }, coches: [] });
		expect(d.personnes.map((p: { prenom: string }) => p.prenom)).toEqual(['Chef', 'Claire']);
	});

	it('un simple membre : refusé ; un non-membre ou une conversation à deux : introuvable', async () => {
		const { base, bruno, chef, claire, id } = await groupe();
		await expect(charger(locaux(base, bruno), `?ajouter=${id}`)).rejects.toMatchObject({ status: 403 });
		await expect(charger(locaux(base, chef), `?ajouter=${id}`)).rejects.toMatchObject({ status: 404 });
		const { conversation: aDeux } = await (await import('@gyro-caserne/socle')).envoyer(base, base.photos, chef, { personne: claire.id }, { texte: 'Salut' }, '2026-10-28T09:00');
		await expect(charger(locaux(base, chef), `?ajouter=${aDeux}`)).rejects.toMatchObject({ status: 404 });
	});

	it('l’ajout ramène aux infos du groupe ; les refus sont reliés aux membres', async () => {
		const { base, alice, bruno, chef, claire, id } = await groupe();
		expect(await ajouter(locaux(base, alice), id, [])).toMatchObject({ status: 400, data: { erreurs: { membres: 'Choisissez au moins une personne.' } } });
		expect(await ajouter(locaux(base, bruno), id, [['membres', String(claire.id)]])).toMatchObject({ status: 403, data: { erreurs: { membres: 'Seuls les animateurs du groupe peuvent ajouter des membres.' } } });
		expect(await ajouter(locaux(base, alice), id, [['membres', String(chef.id)], ['membres', String(claire.id)]])).toMatchObject({ status: 303, location: `/echanges/messages/${id}/infos` });
		const membres = await base.select().from(membreConversation).where(eq(membreConversation.conversationId, id));
		expect(membres).toHaveLength(4);
		expect(await ajouter(locaux(base, alice), id, [['membres', String(chef.id)]])).toMatchObject({ status: 400, data: { erreurs: { membres: 'Une personne choisie fait déjà partie du groupe.' } } });
	});
});
