import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import centre from '$centre';
import { affectationEquipe, chargerJeuDeDepart, equipe, personne, profil } from '@gyro-caserne/socle';
import { baseDeTest } from '@gyro-caserne/socle/base-de-test';
import { aujourdhuiParis } from '#lib/aujourdhui.ts';
import { actions, load } from './+page.server';

const super_ = { type: 'super', email: 'admin@exemple.fr' } as const;
const superAdmins = ['admin@exemple.fr'];

async function preparer() {
	const base = await baseDeTest();
	await chargerJeuDeDepart(base, centre);
	const [profilAgent] = await base.select().from(profil).where(eq(profil.nom, 'Agent'));
	const [alice] = await base.insert(personne).values({ email: 'alice@exemple.fr', prenom: 'Alice', nom: 'Martin', profilId: profilAgent!.id }).returning();
	const [equipe1] = await base.select().from(equipe).where(eq(equipe.ordreRotation, 1));
	return { base, alice: alice!, profilAgent: profilAgent!, equipe1: equipe1! };
}

const locaux = (base: unknown, acteur: unknown) => ({ base, acteur, superAdmins });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const lire = (locals: unknown) => (load as any)({ locals });
const ajouter = (locals: unknown, corps: Record<string, string>) =>
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	(actions.default as any)({ locals, request: new Request('http://x', { method: 'POST', body: new URLSearchParams(corps) }) });

describe('/agents/nouveau', () => {
	it('refuse un agent ordinaire, au chargement et à l\'envoi', async () => {
		const { base, alice, profilAgent } = await preparer();
		const locals = locaux(base, { type: 'personne', id: alice.id });
		await expect(lire(locals)).rejects.toMatchObject({ status: 403 });
		await expect(ajouter(locals, { email: 'x@exemple.fr', prenom: 'X', nom: 'Y', profilId: String(profilAgent.id) })).rejects.toMatchObject({ status: 403 });
		expect(await base.select().from(personne)).toHaveLength(1);
	});

	it('présélectionne le profil « Agent »', async () => {
		const { base, profilAgent } = await preparer();
		const data = await lire(locaux(base, super_));
		expect(data.profilParDefaut).toBe(String(profilAgent.id));
		expect(data.equipes.map((e: { nom: string }) => e.nom)).toEqual(['Équipe 1', 'Équipe 2', 'Équipe 3', 'Équipe 4']);
		expect(data.grades.length).toBeGreaterThan(0);
	});

	it('donne une erreur par champ obligatoire manquant', async () => {
		const { base, profilAgent } = await preparer();
		const resultat = await ajouter(locaux(base, super_), { email: ' ', prenom: '', nom: '', profilId: String(profilAgent.id) });
		expect(resultat).toMatchObject({ status: 400, data: { erreurs: { email: 'Indiquez l’adresse e-mail.', prenom: 'Indiquez le prénom.', nom: 'Indiquez le nom.' } } });
		expect(await base.select().from(personne)).toHaveLength(1);
	});

	it('met « Adresse déjà utilisée » sur le champ, même en majuscules et avec des espaces', async () => {
		const { base, profilAgent } = await preparer();
		const resultat = await ajouter(locaux(base, super_), { email: ' ALICE@Exemple.FR ', prenom: 'Autre', nom: 'Alice', profilId: String(profilAgent.id) });
		expect(resultat).toMatchObject({ status: 400, data: { erreurs: { email: 'Adresse déjà utilisée' }, valeurs: { prenom: 'Autre' } } });
	});

	it('refuse l\'adresse d\'un super administrateur', async () => {
		const { base, profilAgent } = await preparer();
		const resultat = await ajouter(locaux(base, super_), { email: 'ADMIN@exemple.fr', prenom: 'A', nom: 'B', profilId: String(profilAgent.id) });
		expect(resultat).toMatchObject({ status: 400, data: { erreurs: { email: 'Adresse réservée au super administrateur' } } });
		expect(await base.select().from(personne)).toHaveLength(1);
	});

	it('ajoute l\'agent, dans son équipe dès aujourd\'hui, puis redirige vers sa fiche', async () => {
		const { base, profilAgent, equipe1 } = await preparer();
		const envoi = ajouter(locaux(base, super_), {
			email: ' Bob@Exemple.fr ',
			prenom: ' Bob ',
			nom: 'Durand',
			profilId: String(profilAgent.id),
			equipeId: String(equipe1.id),
			gradeId: '',
			dateGrade: '',
			telephone: '',
			naissance: '1995-02-03',
			entreeCentre: '',
			engagementSpv: ''
		});
		const redirection = await envoi.catch((r: unknown) => r);
		const [bob] = await base.select().from(personne).where(eq(personne.email, 'bob@exemple.fr'));
		expect(redirection).toMatchObject({ status: 303, location: `/agents/${bob!.id}` });
		expect(bob).toMatchObject({ prenom: 'Bob', nom: 'Durand', gradeId: null, telephone: null, naissance: '1995-02-03', profilId: profilAgent.id });
		expect(await base.select().from(affectationEquipe)).toEqual([{ personneId: bob!.id, equipeId: equipe1.id, debut: aujourdhuiParis(), fin: null }]);
	});

	it('ajoute sans équipe quand « Aucune équipe » est choisi', async () => {
		const { base, profilAgent } = await preparer();
		const redirection = await ajouter(locaux(base, super_), { email: 'bob@exemple.fr', prenom: 'Bob', nom: 'Durand', profilId: String(profilAgent.id), equipeId: '' }).catch((r: unknown) => r);
		const [bob] = await base.select().from(personne).where(eq(personne.email, 'bob@exemple.fr'));
		expect(redirection).toMatchObject({ status: 303, location: `/agents/${bob!.id}` });
		expect(await base.select().from(affectationEquipe)).toEqual([]);
	});
	it('enregistre le statut choisi, « opérationnel » si rien n\'est envoyé', async () => {
		const { base, profilAgent } = await preparer();
		const corps = { prenom: 'Bob', nom: 'Durand', profilId: String(profilAgent.id) };
		await ajouter(locaux(base, super_), { ...corps, email: 'bob@exemple.fr', statut: 'stagiaire' }).catch(() => {});
		await ajouter(locaux(base, super_), { ...corps, email: 'cleo@exemple.fr' }).catch(() => {});
		const statut = async (email: string) => (await base.select().from(personne).where(eq(personne.email, email)))[0]!.statut;
		expect(await statut('bob@exemple.fr')).toBe('stagiaire');
		expect(await statut('cleo@exemple.fr')).toBe('operationnel');
	});

	it('refuse « parti » et un statut inconnu, sur le champ', async () => {
		const { base, profilAgent } = await preparer();
		const corps = { email: 'bob@exemple.fr', prenom: 'Bob', nom: 'Durand', profilId: String(profilAgent.id) };
		expect(await ajouter(locaux(base, super_), { ...corps, statut: 'parti' })).toMatchObject({ status: 400, data: { erreurs: { statut: 'Statut impossible à la création' } } });
		expect(await ajouter(locaux(base, super_), { ...corps, statut: 'zombie' })).toMatchObject({ status: 400, data: { erreurs: { statut: 'Choix inconnu' } } });
		expect(await base.select().from(personne)).toHaveLength(1);
	});

	it('signale un champ trop long sur le champ', async () => {
		const { base, profilAgent } = await preparer();
		const resultat = await ajouter(locaux(base, super_), { email: 'bob@exemple.fr', prenom: 'x'.repeat(61), nom: 'Durand', profilId: String(profilAgent.id) });
		expect(resultat).toMatchObject({ status: 400, data: { erreurs: { prenom: 'Prénom trop long' } } });
	});
});
