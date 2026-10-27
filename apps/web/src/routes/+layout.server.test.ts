import { describe, expect, it } from 'vitest';
import centre from '$centre';
import { attribuer, chargerJeuDeDepart, personne, profil, responsabilite } from '@gyro-caserne/socle';
import { baseDeTest } from '@gyro-caserne/socle/base-de-test';
import { eq } from 'drizzle-orm';
import { aujourdhuiParis } from '#lib/aujourdhui.ts';
import { load } from './+layout.server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const appeler = (acteur: unknown, base: unknown = null) => (load as any)({ locals: { acteur, base, affichage: { niveau: 1, theme: 'clair' } } });
const super_ = { type: 'super', email: 'a@b.fr' } as const;

describe('load du layout', () => {
	it('distingue personne connectée, super administrateur et visiteur', async () => {
		const base = await baseDeTest();
		expect(await appeler({ type: 'personne', id: 1 }, base)).toMatchObject({ connecte: true, estPersonne: true });
		expect(await appeler(super_, base)).toMatchObject({ connecte: true, estPersonne: false });
		expect(await appeler(null)).toMatchObject({ connecte: false, estPersonne: false });
	});

	it('propose « Réglages » au super administrateur, au référent technique et au chef de centre, pas aux autres', async () => {
		const base = await baseDeTest();
		await chargerJeuDeDepart(base, centre);
		const [agent] = await base.select().from(profil).where(eq(profil.nom, 'Agent'));
		const nouveau = async (email: string, nomResp?: string) => {
			const [p] = await base.insert(personne).values({ email, prenom: 'P', nom: 'N', profilId: agent!.id }).returning();
			if (nomResp) {
				const [r] = await base.select().from(responsabilite).where(eq(responsabilite.nom, nomResp));
				await attribuer(base, super_, { personneId: p!.id, responsabiliteId: r!.id, perimetre: { type: 'centre' }, debut: '2026-01-01' }, aujourdhuiParis());
			}
			return { type: 'personne', id: p!.id };
		};
		expect((await appeler(super_, base)).peutReglages).toBe(true);
		expect((await appeler(await nouveau('r@x.fr', 'Référent technique'), base)).peutReglages).toBe(true);
		expect((await appeler(await nouveau('c@x.fr', 'Chef de centre'), base)).peutReglages).toBe(true);
		expect((await appeler(await nouveau('a@x.fr'), base)).peutReglages).toBe(false);
		expect((await appeler(null, base)).peutReglages).toBe(false);
	});

	it('propose « Nominations » à qui peut attribuer une responsabilité, pas aux autres', async () => {
		const base = await baseDeTest();
		await chargerJeuDeDepart(base, centre);
		const [agent] = await base.select().from(profil).where(eq(profil.nom, 'Agent'));
		const nouveau = async (email: string, nomResp?: string) => {
			const [p] = await base.insert(personne).values({ email, prenom: 'P', nom: 'N', profilId: agent!.id }).returning();
			if (nomResp) {
				const [r] = await base.select().from(responsabilite).where(eq(responsabilite.nom, nomResp));
				await attribuer(base, super_, { personneId: p!.id, responsabiliteId: r!.id, perimetre: { type: 'centre' }, debut: '2026-01-01' }, aujourdhuiParis());
			}
			return { type: 'personne', id: p!.id };
		};
		expect((await appeler(super_, base)).peutNominations).toBe(true);
		expect((await appeler(await nouveau('c@x.fr', 'Chef de centre'), base)).peutNominations).toBe(true);
		expect((await appeler(await nouveau('a@x.fr'), base)).peutNominations).toBe(false);
		expect((await appeler(null, base)).peutNominations).toBe(false);
	});
});
