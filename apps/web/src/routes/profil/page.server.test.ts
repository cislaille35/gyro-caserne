import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { personne } from '@gyro-caserne/socle';
import { baseDeTest } from '@gyro-caserne/socle/base-de-test';
import { actions, load } from './+page.server';

const super_ = { type: 'super', email: 'admin@exemple.fr' } as const;

async function preparer() {
	const base = await baseDeTest();
	const [fiche] = await base.insert(personne).values({ email: 'alice@exemple.fr', prenom: 'Alice', nom: 'Test', surnom: 'Ali', telephone: '06 00 00 00 00', telephoneVisible: 1 }).returning();
	return { base, id: fiche!.id, acteur: { type: 'personne', id: fiche!.id } as const };
}
const lire = async (base: Awaited<ReturnType<typeof baseDeTest>>, id: number) => (await base.select().from(personne).where(eq(personne.id, id)))[0]!;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const charger = (locals: unknown) => (load as any)({ locals });
const envoyer = (locals: unknown, corps: Record<string, string>) =>
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	(actions.default as any)({ locals, request: new Request('http://x', { method: 'POST', body: new URLSearchParams(corps) }) });

describe('/profil : load', () => {
	it('renvoie vers la connexion si personne n\'est connecté', async () => {
		const { base } = await preparer();
		await expect(charger({ base, acteur: null })).rejects.toMatchObject({ status: 303, location: '/connexion' });
		await expect(envoyer({ base, acteur: null }, {})).rejects.toMatchObject({ status: 303, location: '/connexion' });
	});

	it('donne un profil nul au super administrateur', async () => {
		const { base } = await preparer();
		expect(await charger({ base, acteur: super_ })).toEqual({ profil: null });
	});

	it('charge les valeurs de l\'agent', async () => {
		const { base, acteur } = await preparer();
		expect(await charger({ base, acteur })).toEqual({
			profil: { surnom: 'Ali', telephone: '06 00 00 00 00', telephoneVisible: true, contactUrgence: null, anniversaireVisible: true, cochesLecture: true }
		});
	});
});

describe('/profil : envoi', () => {
	it('enregistre les champs, cases cochées en vrai et absentes en faux', async () => {
		const { base, id, acteur } = await preparer();
		const resultat = await envoyer({ base, acteur }, { surnom: ' Lili ', telephone: '', contactUrgence: 'Maman', anniversaireVisible: 'on' });
		expect(resultat).toEqual({ succes: true, message: 'Profil enregistré' });
		expect(await lire(base, id)).toMatchObject({ surnom: 'Lili', telephone: null, telephoneVisible: 0, contactUrgence: 'Maman', anniversaireVisible: 1 });
	});

	it('ne touche pas au reste de la fiche', async () => {
		const { base, id, acteur } = await preparer();
		await envoyer({ base, acteur }, { nom: 'Pirate', email: 'x@exemple.fr', statut: 'parti' });
		expect(await lire(base, id)).toMatchObject({ nom: 'Test', email: 'alice@exemple.fr', statut: 'operationnel' });
	});

	it('refuse le super administrateur avec un message, rien d\'écrit', async () => {
		const { base, id } = await preparer();
		expect(await envoyer({ base, acteur: super_ }, { surnom: 'X' })).toMatchObject({ status: 400, data: { message: 'Pas de fiche pour le super administrateur' } });
		expect((await lire(base, id)).surnom).toBe('Ali');
	});

	it('signale sur le champ un texte trop long', async () => {
		const { base, acteur } = await preparer();
		expect(await envoyer({ base, acteur }, { surnom: 'x'.repeat(61) })).toMatchObject({ status: 400, data: { erreurs: { surnom: 'Surnom trop long' } } });
		expect(await envoyer({ base, acteur }, { contactUrgence: 'x'.repeat(201) })).toMatchObject({ status: 400, data: { erreurs: { contactUrgence: 'Contact d’urgence trop long' } } });
		expect((await lire(base, acteur.id)).surnom).toBe('Ali');
	});
});
