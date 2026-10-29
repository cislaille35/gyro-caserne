import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { envoyer, lireConversation, message, prendreConnaissance, publier, repondreEvenement, signaler, supprimerMessage } from '@gyro-caserne/socle';
import { maintenantParis, septJoursPlusTard } from '#lib/aujourdhui.ts';
import { locaux, preparer, requeteFormulaire } from '../echanges/de-test.ts';
import { actions, load } from './+page.server';

const datesSondage = (m: string) => ({ ouverture: m.slice(0, 16), cloture: septJoursPlusTard(m) });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const charger = (locals: unknown) => (load as any)({ locals });
const agir = async (nom: 'retirer' | 'classer', locals: unknown, id: number | string) =>
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	(actions[nom] as any)({ locals, request: await requeteFormulaire([['id', String(id)]]) });

describe('load de /notifications', () => {
	it('demande la connexion', async () => {
		await expect(charger({ acteur: null })).rejects.toMatchObject({ status: 303, location: '/connexion' });
	});

	it('annonces à prendre en compte, événements sans réponse et sondages ouverts ; ce qui est fait disparaît', async () => {
		const { base, chef, alice } = await preparer();
		const maintenant = maintenantParis();
		const annonce = await publier(base, base.photos, chef, 'centre', { type: 'annonce', texte: 'Note de service', priseDeConnaissance: true }, maintenant);
		const evenement = await publier(base, base.photos, chef, 'centre', { type: 'evenement', texte: 'Manœuvre', evenement: { debut: '2099-01-01T19:00', lieu: 'Caserne', convoques: 'tous' } }, maintenant);
		const sondage = await publier(base, base.photos, chef, 'vie', { type: 'message', texte: 'Repas', sondage: { question: 'Venez-vous ?', reponses: ['Oui', 'Non'], ...datesSondage(maintenant) } }, maintenant);
		const data = await charger({ base, acteur: alice });
		expect(data.annonces).toMatchObject([{ id: annonce, cle: 'centre', nomMur: 'Le centre', titre: 'Note de service' }]);
		expect(data.evenements).toMatchObject([{ id: evenement, debut: '2099-01-01T19:00' }]);
		expect(data.sondages).toMatchObject([{ id: sondage, cle: 'vie' }]);
		await prendreConnaissance(base, alice, annonce, maintenant);
		await repondreEvenement(base, alice, evenement, 'absent', maintenant);
		expect(await charger({ base, acteur: alice })).toMatchObject({ annonces: [], evenements: [], sondages: [{ id: sondage }] });
		// Un événement avec sondage : une seule ligne, sous les événements, tant que la réponse ou le vote manque.
		const repas = await publier(base, base.photos, chef, 'centre', { type: 'evenement', texte: 'Repas', evenement: { debut: '2099-02-01T12:00', lieu: 'Caserne', convoques: 'tous' }, sondage: { question: 'Petit déjeuner ?', reponses: ['Oui', 'Non'], ...datesSondage(maintenant) } }, maintenant);
		await repondreEvenement(base, alice, repas, 'present', maintenant);
		expect(await charger({ base, acteur: alice })).toMatchObject({ evenements: [{ id: repas, sondage: true }], sondages: [{ id: sondage }] });
	});
});

describe('signalements dans /notifications', () => {
	// Bruno écrit à Alice deux messages ; Alice signale le premier.
	async function signale() {
		const p = await preparer();
		const { base, alice, bruno } = p;
		const grave = await envoyer(base, base.photos, bruno, { personne: alice.id }, { texte: 'Texte grave' }, '2026-10-29T10:00');
		await envoyer(base, base.photos, bruno, { conversation: grave.conversation }, { texte: 'Le reste' }, '2026-10-29T10:01');
		await signaler(base, alice, grave.message, '2026-10-29T10:05');
		return { ...p, grave };
	}

	it('le modérateur voit le message signalé seul ; les autres, rien', async () => {
		const { base, chef, alice } = await signale();
		const data = await charger(locaux(base, chef));
		expect(data.signalements).toMatchObject([{ texte: 'Texte grave', auteur: { prenom: 'Bruno' }, par: { prenom: 'Alice' }, envoye_le: '2026-10-29T10:00', le: '2026-10-29T10:05', retirable: true }]);
		expect(JSON.stringify(data)).not.toContain('Le reste');
		expect((await charger(locaux(base, alice))).signalements).toEqual([]);
	});

	it('« Retirer le message » : retiré pour tous, le signalement disparaît', async () => {
		const { base, chef, alice, grave } = await signale();
		const [s] = (await charger(locaux(base, chef))).signalements;
		expect(await agir('retirer', locaux(base, chef), s.id)).toEqual({ succes: 'Message retiré pour tous.' });
		expect((await base.select().from(message).where(eq(message.id, grave.message)))[0]).toMatchObject({ supprime: 'moderation' });
		expect((await charger(locaux(base, chef))).signalements).toEqual([]);
		const vue = await lireConversation(base, alice, grave.conversation, {}, '2026-10-29T10:10');
		expect(vue.messages[0]).toMatchObject({ supprime: 'moderation' });
	});

	it('« Classer » : le message reste, le signalement disparaît', async () => {
		const { base, chef, grave } = await signale();
		const [s] = (await charger(locaux(base, chef))).signalements;
		expect(await agir('classer', locaux(base, chef), s.id)).toEqual({ succes: 'Signalement classé.' });
		expect((await base.select().from(message).where(eq(message.id, grave.message)))[0]).toMatchObject({ supprime: null, texte: 'Texte grave' });
		expect((await charger(locaux(base, chef))).signalements).toEqual([]);
	});

	it('refus dits en phrases : pas modérateur, déjà traité, identifiant illisible ; connexion requise', async () => {
		const { base, chef, alice } = await signale();
		const [s] = (await charger(locaux(base, chef))).signalements;
		expect(await agir('classer', locaux(base, alice), s.id)).toMatchObject({ status: 403, data: { message: 'Seule la modération peut traiter un signalement.' } });
		await agir('classer', locaux(base, chef), s.id);
		for (const nom of ['retirer', 'classer'] as const) expect(await agir(nom, locaux(base, chef), s.id)).toMatchObject({ status: 400, data: { message: 'Ce signalement a déjà été traité.' } });
		expect(await agir('classer', locaux(base, chef), 'abc')).toMatchObject({ status: 400, data: { message: 'Ce signalement a déjà été traité.' } });
		await expect(agir('classer', { base, acteur: null }, s.id)).rejects.toMatchObject({ status: 303, location: '/connexion' });
	});

	it('retirer un message que l’auteur a déjà supprimé : on propose de classer', async () => {
		const { base, chef, bruno, grave } = await signale();
		await supprimerMessage(base, base.photos, bruno, grave.message, '2026-10-29T10:06');
		const [s] = (await charger(locaux(base, chef))).signalements;
		expect(s.retirable).toBe(false);
		expect(await agir('retirer', locaux(base, chef), s.id)).toMatchObject({ status: 400, data: { message: 'Ce message n’est plus dans la conversation : classez le signalement.' } });
	});
});
