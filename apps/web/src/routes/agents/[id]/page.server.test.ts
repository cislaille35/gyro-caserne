import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import centre from '$centre';
import { affectationEquipe, attribution, chargerJeuDeDepart, equipe, grade, personne, profil, responsabilite } from '@gyro-caserne/socle';
import { baseDeTest } from '@gyro-caserne/socle/base-de-test';
import { aujourdhuiParis } from '#lib/aujourdhui.ts';
import { actions, load } from './+page.server';

const super_ = { type: 'super', email: 'admin@exemple.fr' } as const;
const superAdmins = ['admin@exemple.fr'];

async function preparer() {
	const base = await baseDeTest();
	await chargerJeuDeDepart(base, centre);
	const [profilAgent] = await base.select().from(profil).where(eq(profil.nom, 'Agent'));
	const nouvelle = async (prenom: string, valeurs: Partial<typeof personne.$inferInsert> = {}) => {
		const [p] = await base
			.insert(personne)
			.values({ email: `${prenom.toLowerCase()}@exemple.fr`, prenom, nom: 'Test', profilId: profilAgent!.id, ...valeurs })
			.returning();
		return p!.id;
	};
	const fonction = async (personneId: number, systeme: 'chef_centre' | 'chef_centre_adjoint') => {
		const [r] = await base.select().from(responsabilite).where(eq(responsabilite.systeme, systeme));
		await base.insert(attribution).values({ personneId, responsabiliteId: r!.id, perimetreType: 'centre', perimetreId: null, debut: '2026-01-01', saisiePar: 'super:a@b.fr', saisieLe: '2026-01-01' });
	};
	const chef = await nouvelle('Chef');
	await fonction(chef, 'chef_centre');
	const adjoint = await nouvelle('Adjoint');
	await fonction(adjoint, 'chef_centre_adjoint');
	const agent = await nouvelle('Alice', { naissance: '1990-05-01', contactUrgence: 'Maman 06 00 00 00 00' });
	const [equipe1] = await base.select().from(equipe).where(eq(equipe.ordreRotation, 1));
	return { base, chef, adjoint, agent, equipe1: equipe1!, profilAgent: profilAgent! };
}

const locaux = (base: unknown, acteur: unknown) => ({ base, acteur, superAdmins });
const lire = (locals: unknown, id: number) =>
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	(load as any)({ locals, params: { id: String(id) } });
const agir = (nom: 'fiche' | 'equipe' | 'statut', locals: unknown, id: number, corps: Record<string, string>) =>
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	(actions[nom] as any)({ locals, params: { id: String(id) }, request: new Request('http://x', { method: 'POST', body: new URLSearchParams(corps) }) });
const lirePersonne = async (base: Awaited<ReturnType<typeof baseDeTest>>, id: number) => (await base.select().from(personne).where(eq(personne.id, id)))[0]!;

describe('/agents/[id] : accès', () => {
	it('refuse un agent ordinaire, au chargement et à chaque action, sans rien écrire', async () => {
		const { base, agent, equipe1 } = await preparer();
		const autre = await (async () => (await base.insert(personne).values({ email: 'bob@exemple.fr', prenom: 'Bob', nom: 'Test' }).returning())[0]!.id)();
		const locals = locaux(base, { type: 'personne', id: autre });
		await expect(lire(locals, agent)).rejects.toMatchObject({ status: 403 });
		await expect(agir('fiche', locals, agent, { nom: 'Pirate' })).rejects.toMatchObject({ status: 403 });
		await expect(agir('equipe', locals, agent, { equipeId: String(equipe1.id) })).rejects.toMatchObject({ status: 403 });
		await expect(agir('statut', locals, agent, { statut: 'suspendu' })).rejects.toMatchObject({ status: 403 });
		const apres = await lirePersonne(base, agent);
		expect(apres.nom).toBe('Test');
		expect(apres.statut).toBe('operationnel');
		expect(await base.select().from(affectationEquipe)).toEqual([]);
	});

	it('renvoie vers la connexion si personne n\'est connecté', async () => {
		const { base, agent } = await preparer();
		await expect(lire(locaux(base, null), agent)).rejects.toMatchObject({ status: 303, location: '/connexion' });
		await expect(agir('fiche', locaux(base, null), agent, { nom: 'X' })).rejects.toMatchObject({ status: 303, location: '/connexion' });
	});

	it('répond 404 pour un agent inconnu', async () => {
		const { base } = await preparer();
		await expect(lire(locaux(base, super_), 9999)).rejects.toMatchObject({ status: 404 });
		await expect(lire(locaux(base, super_), Number.NaN)).rejects.toMatchObject({ status: 404 });
	});

	it('charge la fiche, les listes et dit si elle est modifiable', async () => {
		const { base, chef, adjoint, agent } = await preparer();
		const data = await lire(locaux(base, super_), agent);
		expect(data.fiche).toMatchObject({ id: agent, prenom: 'Alice', email: 'alice@exemple.fr', naissance: '1990-05-01' });
		expect(data.profils.map((p: { nom: string }) => p.nom)).toContain('Agent');
		expect(data.grades.length).toBeGreaterThan(0);
		expect(data.equipes.map((e: { nom: string }) => e.nom)).toEqual(['Équipe 1', 'Équipe 2', 'Équipe 3']);
		expect(data.raison).toBeNull();

		const parAdjoint = await lire(locaux(base, { type: 'personne', id: adjoint }), chef);
		expect(parAdjoint.raison).toBe('Seul un super administrateur modifie la fiche du chef de centre.');
		const parChef = await lire(locaux(base, { type: 'personne', id: chef }), adjoint);
		expect(parChef.raison).toBeNull();
		const adjointParLuiMeme = await lire(locaux(base, { type: 'personne', id: adjoint }), adjoint);
		expect(adjointParLuiMeme.raison).toBe('Seuls le chef de centre ou un super administrateur modifient la fiche d’un adjoint.');
	});
});

describe('/agents/[id] : ?/fiche', () => {
	it('enregistre les champs envoyés, convertit vides, identifiants et dates', async () => {
		const { base, agent } = await preparer();
		const [unGrade] = await base.select().from(grade).limit(1);
		const resultat = await agir('fiche', locaux(base, super_), agent, { prenom: ' Alicia ', telephone: '', gradeId: String(unGrade!.id), dateGrade: '2026-03-01', entreeCentre: '' });
		expect(resultat).toEqual({ succes: true, message: 'Fiche enregistrée' });
		expect(await lirePersonne(base, agent)).toMatchObject({ prenom: 'Alicia', telephone: null, gradeId: unGrade!.id, dateGrade: '2026-03-01', entreeCentre: null, nom: 'Test' });
	});

	it('renvoie le refus du socle en 403, rien d\'écrit', async () => {
		const { base, chef, adjoint } = await preparer();
		const resultat = await agir('fiche', locaux(base, { type: 'personne', id: adjoint }), chef, { email: 'pirate@exemple.fr' });
		expect(resultat).toMatchObject({ status: 403, data: { message: 'Seul un super administrateur modifie la fiche du chef de centre' } });
		expect((await lirePersonne(base, chef)).email).toBe('chef@exemple.fr');
	});

	it('met « Adresse déjà utilisée » sur le champ, même en majuscules et avec des espaces', async () => {
		const { base, agent } = await preparer();
		const resultat = await agir('fiche', locaux(base, super_), agent, { email: '  CHEF@Exemple.fr ' });
		expect(resultat).toMatchObject({ status: 400, data: { erreurs: { email: 'Adresse déjà utilisée' } } });
	});

	it('refuse l\'adresse d\'un super administrateur', async () => {
		const { base, agent } = await preparer();
		const resultat = await agir('fiche', locaux(base, super_), agent, { email: 'Admin@exemple.fr' });
		expect(resultat).toMatchObject({ status: 400, data: { erreurs: { email: 'Adresse réservée au super administrateur' } } });
		expect((await lirePersonne(base, agent)).email).toBe('alice@exemple.fr');
	});

	it('donne une erreur par champ : vide, date ou identifiant invalide', async () => {
		const { base, agent } = await preparer();
		const resultat = await agir('fiche', locaux(base, super_), agent, { prenom: ' ', naissance: '2026-02-30', gradeId: 'abc', profilId: '' });
		expect(resultat).toMatchObject({
			status: 400,
			data: { erreurs: { prenom: 'Indiquez le prénom.', naissance: 'Date invalide', gradeId: 'Choix inconnu', profilId: 'Choisissez un profil.' }, valeurs: { prenom: ' ' } }
		});
		expect((await lirePersonne(base, agent)).prenom).toBe('Alice');
	});
});

describe('/agents/[id] : ?/equipe', () => {
	it('affecte à une équipe à partir d\'aujourd\'hui, puis retire avec « aucune »', async () => {
		const { base, agent, equipe1 } = await preparer();
		const locals = locaux(base, super_);
		expect(await agir('equipe', locals, agent, { equipeId: String(equipe1.id) })).toEqual({ succes: true, message: 'Équipe enregistrée' });
		expect(await base.select().from(affectationEquipe)).toEqual([{ personneId: agent, equipeId: equipe1.id, debut: aujourdhuiParis(), fin: null }]);

		expect(await agir('equipe', locals, agent, { equipeId: 'aucune' })).toEqual({ succes: true, message: 'Équipe enregistrée' });
		expect(await base.select().from(affectationEquipe)).toEqual([]);
	});

	it('ne réécrit rien si l\'équipe ne change pas', async () => {
		const { base, agent, equipe1 } = await preparer();
		await base.insert(affectationEquipe).values({ personneId: agent, equipeId: equipe1.id, debut: '2026-01-01' });
		expect(await agir('equipe', locaux(base, super_), agent, { equipeId: String(equipe1.id) })).toEqual({ succes: true, message: 'Équipe enregistrée' });
		expect(await base.select().from(affectationEquipe)).toEqual([{ personneId: agent, equipeId: equipe1.id, debut: '2026-01-01', fin: null }]);
	});

	it('le même jour, corrige l\'équipe ; refuse à un adjoint l\'équipe du chef de centre', async () => {
		const { base, chef, adjoint, agent, equipe1 } = await preparer();
		const [equipe2] = await base.select().from(equipe).where(eq(equipe.ordreRotation, 2));
		await agir('equipe', locaux(base, super_), agent, { equipeId: String(equipe1.id) });
		await agir('equipe', locaux(base, super_), agent, { equipeId: String(equipe2!.id) });
		expect(await base.select().from(affectationEquipe)).toEqual([{ personneId: agent, equipeId: equipe2!.id, debut: aujourdhuiParis(), fin: null }]);

		const refus = await agir('equipe', locaux(base, { type: 'personne', id: adjoint }), chef, { equipeId: String(equipe1.id) });
		expect(refus).toMatchObject({ status: 403, data: { message: 'Seul un super administrateur change l’équipe du chef de centre' } });
		expect(await base.select().from(affectationEquipe)).toHaveLength(1);
	});

	it('renvoie « Équipe inconnue » sur le champ affiché par la page', async () => {
		const { base, agent } = await preparer();
		expect(await agir('equipe', locaux(base, super_), agent, { equipeId: '9999' })).toMatchObject({ status: 400, data: { erreurs: { equipeId: 'Équipe inconnue' } } });
		expect(await base.select().from(affectationEquipe)).toEqual([]);
	});

	it('refuse une valeur inconnue', async () => {
		const { base, agent } = await preparer();
		expect(await agir('equipe', locaux(base, super_), agent, { equipeId: 'abc' })).toMatchObject({ status: 400, data: { erreurs: { equipeId: 'Choix inconnu' } } });
	});
});

describe('/agents/[id] : ?/statut', () => {
	it('vers « parti » sans confirmation : refusé, rien d\'écrit', async () => {
		const { base, agent } = await preparer();
		const resultat = await agir('statut', locaux(base, super_), agent, { statut: 'parti' });
		expect(resultat).toMatchObject({ status: 400, data: { erreurs: { confirmation: 'Cochez « Je confirme » pour déclarer le départ.' }, valeurs: { statut: 'parti' } } });
		expect(await lirePersonne(base, agent)).toMatchObject({ statut: 'operationnel', naissance: '1990-05-01', contactUrgence: 'Maman 06 00 00 00 00' });
	});

	it('vers « parti » confirmé : statut changé, naissance et contact d\'urgence effacés', async () => {
		const { base, agent } = await preparer();
		expect(await agir('statut', locaux(base, super_), agent, { statut: 'parti', confirmation: 'oui' })).toEqual({ succes: true, message: 'Statut enregistré' });
		expect(await lirePersonne(base, agent)).toMatchObject({ statut: 'parti', naissance: null, contactUrgence: null });
	});

	it('change un autre statut sans confirmation', async () => {
		const { base, agent } = await preparer();
		expect(await agir('statut', locaux(base, super_), agent, { statut: 'suspendu' })).toEqual({ succes: true, message: 'Statut enregistré' });
		expect((await lirePersonne(base, agent)).statut).toBe('suspendu');
	});

	it('refuse un statut inconnu, et renvoie le refus du socle en 403', async () => {
		const { base, chef, adjoint, agent } = await preparer();
		expect(await agir('statut', locaux(base, super_), agent, { statut: 'zzz' })).toMatchObject({ status: 400, data: { erreurs: { statut: 'Choix inconnu' } } });
		const refus = await agir('statut', locaux(base, { type: 'personne', id: adjoint }), chef, { statut: 'suspendu' });
		expect(refus).toMatchObject({ status: 403, data: { message: 'Seul un super administrateur change le statut du chef de centre' } });
		expect((await lirePersonne(base, chef)).statut).toBe('operationnel');
	});
});
