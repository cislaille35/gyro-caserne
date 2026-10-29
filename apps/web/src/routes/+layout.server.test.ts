import { describe, expect, it, vi } from 'vitest';
import centre from '$centre';
import { attribuer, chargerJeuDeDepart, comite, envoyer, personne, profil, publier, repondreEvenement, responsabilite } from '@gyro-caserne/socle';
import { preparer } from './echanges/de-test.ts';
import { baseDeTest } from '@gyro-caserne/socle/base-de-test';
import { eq } from 'drizzle-orm';
import { aujourdhuiParis, maintenantParis, septJoursPlusTard } from '#lib/aujourdhui.ts';
import { load } from './+layout.server';

const datesSondage = (m: string) => ({ ouverture: m.slice(0, 16), cloture: septJoursPlusTard(m) });

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

		// Rapporteur seul : il nomme dans son comité, donc il voit « Nominations ».
		const [amicale] = await base.select().from(comite).where(eq(comite.nom, 'Amicale'));
		const [rapporteur] = await base.insert(personne).values({ email: 'rap@x.fr', prenom: 'P', nom: 'N', profilId: agent!.id }).returning();
		const [r] = await base.select().from(responsabilite).where(eq(responsabilite.nom, 'Rapporteur de comité'));
		await attribuer(base, super_, { personneId: rapporteur!.id, responsabiliteId: r!.id, perimetre: { type: 'comite', id: amicale!.id }, debut: '2026-01-01' }, aujourdhuiParis());
		expect((await appeler({ type: 'personne', id: rapporteur!.id }, base)).peutNominations).toBe(true);
	});

	it('la cloche : annonces à prendre en compte, événements sans réponse et sondages ouverts', async () => {
		const { base, chef, alice } = await preparer();
		const maintenant = maintenantParis();
		expect((await appeler(alice, base)).cloche).toBe(0);
		await publier(base, base.photos, chef, 'centre', { type: 'annonce', texte: 'Note', priseDeConnaissance: true }, maintenant);
		await publier(base, base.photos, chef, 'centre', { type: 'annonce', texte: 'Sans demande', priseDeConnaissance: false }, maintenant);
		const evenement = await publier(base, base.photos, chef, 'centre', { type: 'evenement', texte: 'Manœuvre', evenement: { debut: '2099-01-01T19:00', lieu: 'Caserne', convoques: 'tous' } }, maintenant);
		await publier(base, base.photos, chef, 'vie', { type: 'message', texte: 'Repas', sondage: { question: 'Venez-vous ?', reponses: ['Oui', 'Non'], ...datesSondage(maintenant) } }, maintenant);
		expect((await appeler(alice, base)).cloche).toBe(3);
		await repondreEvenement(base, alice, evenement, 'incertain', maintenant);
		expect((await appeler(alice, base)).cloche).toBe(2);
		// Un événement avec sondage compte une fois, tant que la réponse ou le vote manque.
		await publier(base, base.photos, chef, 'centre', { type: 'evenement', texte: 'Repas', evenement: { debut: '2099-02-01T12:00', lieu: 'Caserne', convoques: 'tous' }, sondage: { question: 'Petit déjeuner ?', reponses: ['Oui', 'Non'], ...datesSondage(maintenant) } }, maintenant);
		expect((await appeler(alice, base)).cloche).toBe(3);
		// Le super administrateur et le visiteur : rien.
		expect((await appeler(super_, base)).cloche).toBe(0);
		expect((await appeler(null, base)).cloche).toBe(0);
	});

	it('la cloche ne fait jamais tomber la page : 0 si sa lecture échoue', async () => {
		const { base, alice } = await preparer();
		const enPanne = new Proxy(base, { get: (cible, cle) => (cle === 'batch' ? () => Promise.reject(new Error('D1 indisponible')) : Reflect.get(cible, cle)) });
		const erreur = vi.spyOn(console, 'error').mockImplementation(() => {});
		expect(await appeler(alice, enPanne)).toMatchObject({ connecte: true, cloche: 0 });
		expect(erreur).toHaveBeenCalled();
		erreur.mockRestore();
	});

	it('compte les messages non lus pour la pastille d’Échanges ; 0 pour le super administrateur, le visiteur, ou si la lecture échoue', async () => {
		const { base, alice, bruno } = await preparer();
		await envoyer(base, base.photos, bruno, { personne: alice.id }, { texte: 'Salut' }, maintenantParis());
		expect((await appeler(alice, base)).nonLus).toBe(1);
		expect((await appeler(super_, base)).nonLus).toBe(0);
		expect((await appeler(null, base)).nonLus).toBe(0);
		// Seul le compte des non-lus (une sélection de « n ») tombe en panne.
		const select = base.select.bind(base) as (champs?: object) => unknown;
		const enPanne = new Proxy(base, {
			get: (cible, cle) =>
				cle === 'select'
					? (champs?: object) => {
							if (champs && 'n' in champs) throw new Error('D1 indisponible');
							return select(champs);
						}
					: Reflect.get(cible, cle)
		});
		const erreur = vi.spyOn(console, 'error').mockImplementation(() => {});
		expect(await appeler(alice, enPanne)).toMatchObject({ connecte: true, nonLus: 0 });
		erreur.mockRestore();
	});
});
