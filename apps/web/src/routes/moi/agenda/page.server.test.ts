import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { cleAgenda, personne, profil } from '@gyro-caserne/socle';
import { actions, load } from './+page.server';
import { locaux, preparer } from '../../planning/de-test.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const charger = (locals: unknown, ua = '') => (load as any)({ locals, url: new URL('https://caserne.exemple.fr/moi/agenda'), request: new Request('https://caserne.exemple.fr/moi/agenda', { headers: { 'user-agent': ua } }) });

describe('/moi/agenda', () => {
	it('demande la connexion ; le super administrateur n’a pas d’agenda', async () => {
		await expect(charger({ acteur: null })).rejects.toMatchObject({ status: 303, location: '/connexion' });
		const { base } = await preparer();
		expect(await charger(locaux(base, { type: 'super', email: 'admin@exemple.fr' }))).toEqual({ lien: null });
	});

	it('sans le droit de voir le planning : pas de lien, aucune clé créée', async () => {
		const { base } = await preparer();
		const [ext] = await base.select().from(profil).where(eq(profil.nom, 'Réserve citoyenne'));
		const [x] = await base.insert(personne).values({ email: 'x@exemple.fr', prenom: 'X', nom: 'Y', profilId: ext!.id }).returning();
		expect(await charger(locaux(base, { type: 'personne', id: x!.id }))).toEqual({ lien: null, sansPlanning: true });
		expect(await base.select().from(cleAgenda)).toHaveLength(0);
	});

	it('donne le lien https et webcal ; « Changer le lien » le remplace', async () => {
		const { base, alice } = await preparer();
		const { lien, webcal } = await charger(locaux(base, alice));
		expect(lien).toMatch(new RegExp(`^https://caserne\\.exemple\\.fr/agenda/${alice.id}-[A-Za-z0-9_-]{43}\\.ics$`));
		expect(webcal).toBe(lien.replace('https://', 'webcal://'));
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		expect(await (actions.changer as any)({ locals: locaux(base, alice) })).toEqual({ change: true });
		expect((await charger(locaux(base, alice))).lien).not.toBe(lien);
	});

	it('reconnaît simplement le téléphone : iPhone, Android, sinon rien', async () => {
		const { base, alice } = await preparer();
		expect((await charger(locaux(base, alice), 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')).appareil).toBe('iphone');
		expect((await charger(locaux(base, alice), 'Mozilla/5.0 (Linux; Android 15; Pixel 9)')).appareil).toBe('android');
		expect((await charger(locaux(base, alice), 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).appareil).toBeNull();
	});
});
