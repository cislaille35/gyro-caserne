import { describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import centre from '$centre';
import { attribuer, attribution, chargerJeuDeDepart, comite, personne, profil, responsabilite, type Acteur } from '@gyro-caserne/socle';
import { baseDeTest } from '@gyro-caserne/socle/base-de-test';
import { aujourdhuiParis } from '#lib/aujourdhui.ts';
import { actions, load } from './+page.server';

const super_: Acteur = { type: 'super', email: 'admin@exemple.fr' };
const aujourdhui = aujourdhuiParis();

async function preparer() {
	const base = await baseDeTest();
	await chargerJeuDeDepart(base, centre);
	const [profilAgent] = await base.select().from(profil).where(eq(profil.nom, 'Agent'));
	const comites = await base.select().from(comite);
	const amicale = comites.find((c) => c.nom === 'Amicale')!.id;
	const autreComite = comites.find((c) => c.nom !== 'Amicale')!.id;
	const roles = await base.select().from(responsabilite);
	const role = (nom: string) => roles.find((r) => r.nom === nom)!.id;
	const nouvelle = async (prenom: string, statut: 'operationnel' | 'parti' = 'operationnel') =>
		(await base.insert(personne).values({ email: `${prenom.toLowerCase()}@exemple.fr`, prenom, nom: 'Test', profilId: profilAgent!.id, statut }).returning())[0]!.id;
	const nommer = (personneId: number, nom: string, perimetre: Parameters<typeof attribuer>[2]['perimetre']) =>
		attribuer(base, super_, { personneId, responsabiliteId: role(nom), perimetre, debut: '2026-01-01' }, aujourdhui);
	const chef = await nouvelle('Chef');
	await nommer(chef, 'Chef de centre', { type: 'centre' });
	const rapporteur = await nouvelle('Rapporteur');
	await nommer(rapporteur, 'Rapporteur de comité', { type: 'comite', id: amicale });
	const simple = await nouvelle('Simple');
	const acteur = (id: number) => ({ type: 'personne' as const, id });
	const nombre = async () => (await base.select().from(attribution)).length;
	return { base, role, amicale, autreComite, nouvelle, nommer, chef: acteur(chef), rapporteur: acteur(rapporteur), simple: acteur(simple), simpleId: simple, nombre };
}

const locaux = (base: unknown, acteur: unknown) => ({ base, acteur, superAdmins: ['admin@exemple.fr'] });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const lire = (locals: unknown, adresse = 'http://x/nominations') => (load as any)({ locals, url: new URL(adresse) });
const agir = (nom: 'attribuer' | 'terminer' | 'finir', locals: unknown, corps: Record<string, string>) =>
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	(actions[nom] as any)({ locals, request: new Request('http://x', { method: 'POST', body: new URLSearchParams(corps) }) });

describe('/nominations : accès', () => {
	it('refuse un agent ordinaire (403) au chargement et à chaque action, sans rien écrire', async () => {
		const { base, role, simple, simpleId, nombre } = await preparer();
		const locals = locaux(base, simple);
		const avant = await nombre();
		await expect(lire(locals)).rejects.toMatchObject({ status: 403 });
		await expect(agir('attribuer', locals, { personneId: String(simpleId), responsabiliteId: String(role('Référent engins')), perimetre: 'centre', debut: aujourdhui })).rejects.toMatchObject({ status: 403 });
		await expect(agir('terminer', locals, { attributionId: '1', responsabiliteId: String(role('Référent engins')), confirmation: 'oui' })).rejects.toMatchObject({ status: 403 });
		await expect(agir('finir', locals, { attributionId: '1', responsabiliteId: String(role('Référent engins')), fin: '2099-01-01' })).rejects.toMatchObject({ status: 403 });
		expect(await nombre()).toBe(avant);
	});

	it('renvoie un visiteur non connecté vers la connexion', async () => {
		const { base } = await preparer();
		await expect(lire(locaux(base, null))).rejects.toMatchObject({ status: 303, location: '/connexion' });
	});
});

describe('/nominations : chargement', () => {
	it('le rapporteur ne voit que les rôles de son comité, avec leurs titulaires', async () => {
		const { base, rapporteur, amicale, nouvelle, nommer, role, autreComite } = await preparer();
		const membre = await nouvelle('Membre');
		await nommer(membre, 'Membre de comité', { type: 'comite', id: amicale });
		const ailleurs = await nouvelle('Ailleurs');
		await nommer(ailleurs, 'Membre de comité', { type: 'comite', id: autreComite });
		const donnees = await lire(locaux(base, rapporteur));
		expect(donnees.roles.map((r: { nom: string }) => r.nom)).toEqual(['Membre de comité', 'Rapporteur de comité']);
		const parNom = (nom: string) => donnees.roles.find((r: { nom: string }) => r.nom === nom);
		expect(parNom('Membre de comité').responsabiliteId).toBe(role('Membre de comité'));
		expect(parNom('Membre de comité').perimetres.map((p: { nom: string }) => p.nom)).toEqual(['Amicale']);
		expect(parNom('Membre de comité').titulaires.map((t: { personne: { prenom: string } }) => t.personne.prenom)).toEqual(['Membre']);
	});

	it('propose pour l’agent les seules personnes présentes, par leur nom et leur équipe', async () => {
		const { base, chef, nouvelle } = await preparer();
		const parti = await nouvelle('Partie', 'parti');
		const donnees = await lire(locaux(base, chef));
		const noms = donnees.agents.map((a: { id: number; nom: string; equipe: string }) => a.nom);
		expect(noms).toContain('Simple Test');
		expect(noms).not.toContain('Partie Test');
		expect(donnees.agents.map((a: { id: number }) => a.id)).not.toContain(parti);
		expect(Object.keys(donnees.agents[0]).sort()).toEqual(['equipe', 'id', 'nom']);
	});
});

describe('/nominations : adresse', () => {
	it('lit le panneau ouvert et la recherche dans l’adresse (sans JavaScript)', async () => {
		const { base, chef } = await preparer();
		expect(await lire(locaux(base, chef))).toMatchObject({ nommer: null, retirer: null, recherche: '' });
		expect(await lire(locaux(base, chef), 'http://x/nominations?nommer=5&retirer=7&q=+pharmacie+')).toMatchObject({ nommer: 5, retirer: 7, recherche: 'pharmacie' });
		expect(await lire(locaux(base, chef), 'http://x/nominations?nommer=abc&retirer=-1')).toMatchObject({ nommer: null, retirer: null });
	});

	it('donne l’icône de chaque rôle', async () => {
		const { base, chef } = await preparer();
		const { roles } = await lire(locaux(base, chef));
		expect(roles.find((r: { nom: string }) => r.nom === 'Référent engins').icone).toBe('camion');
	});
});

describe('/nominations : nommer', () => {
	it('nomme l’agent choisi', async () => {
		const { base, chef, simpleId, role } = await preparer();
		const resultat = await agir('attribuer', locaux(base, chef), { personneId: String(simpleId), responsabiliteId: String(role('Référent engins')), perimetre: 'centre', debut: aujourdhui });
		expect(resultat).toMatchObject({ succes: true, message: 'Rôle attribué', cible: `attribuer-${role('Référent engins')}` });
		expect(await base.select().from(attribution).where(and(eq(attribution.personneId, simpleId), eq(attribution.responsabiliteId, role('Référent engins'))))).toHaveLength(1);
	});

	it('demande de choisir un agent', async () => {
		const { base, chef, role, nombre } = await preparer();
		const avant = await nombre();
		const resultat = await agir('attribuer', locaux(base, chef), { responsabiliteId: String(role('Référent engins')), perimetre: 'centre', debut: aujourdhui });
		expect(resultat.status).toBe(400);
		expect(resultat.data.erreurs.personneId).toBe('Choisissez un agent.');
		expect(await nombre()).toBe(avant);
	});

	it('refuse un doublon, sur le champ début', async () => {
		const { base, chef, simpleId, role, nommer } = await preparer();
		await nommer(simpleId, 'Référent engins', { type: 'centre' });
		const resultat = await agir('attribuer', locaux(base, chef), { personneId: String(simpleId), responsabiliteId: String(role('Référent engins')), perimetre: 'centre', debut: aujourdhui });
		expect(resultat.status).toBe(400);
		expect(resultat.data.erreurs.debut).toBe('Cette personne tient déjà ce rôle sur cette période');
	});

	it('refuse au rapporteur un rôle hors de son comité (formulaire fabriqué), sans rien écrire', async () => {
		const { base, rapporteur, simpleId, role, amicale, autreComite, nombre } = await preparer();
		const avant = await nombre();
		const engins = await agir('attribuer', locaux(base, rapporteur), { personneId: String(simpleId), responsabiliteId: String(role('Référent engins')), perimetre: 'centre', debut: aujourdhui });
		expect(engins.status).toBe(403);
		const ailleurs = await agir('attribuer', locaux(base, rapporteur), { personneId: String(simpleId), responsabiliteId: String(role('Membre de comité')), perimetre: String(autreComite), debut: aujourdhui });
		expect(ailleurs.status).toBe(403);
		expect(await nombre()).toBe(avant);
		const chezLui = await agir('attribuer', locaux(base, rapporteur), { personneId: String(simpleId), responsabiliteId: String(role('Membre de comité')), perimetre: String(amicale), debut: aujourdhui });
		expect(chezLui).toMatchObject({ succes: true });
	});

	it('refuse une personne inconnue, sur le champ de l’agent', async () => {
		const { base, chef, role } = await preparer();
		const resultat = await agir('attribuer', locaux(base, chef), { personneId: '99999', responsabiliteId: String(role('Référent engins')), perimetre: 'centre', debut: aujourdhui });
		expect(resultat.status).toBe(400);
		expect(resultat.data.erreurs.personneId).toBe('Personne inconnue');
	});

	it('refuse une personne partie, sur le champ de l’agent', async () => {
		const { base, chef, role, nouvelle, nombre } = await preparer();
		const partie = await nouvelle('Partie', 'parti');
		const avant = await nombre();
		const resultat = await agir('attribuer', locaux(base, chef), { personneId: String(partie), responsabiliteId: String(role('Référent engins')), perimetre: 'centre', debut: aujourdhui });
		expect(resultat.status).toBe(400);
		expect(resultat.data.erreurs.personneId).toBe('Cette personne est partie');
		expect(await nombre()).toBe(avant);
	});
});

describe('/nominations : terminer', () => {
	async function avecTitulaire() {
		const contexte = await preparer();
		const id = await contexte.nommer(contexte.simpleId, 'Référent engins', { type: 'centre' });
		return { ...contexte, id, roleId: String(contexte.role('Référent engins')) };
	}

	it('exige la confirmation', async () => {
		const { base, chef, id, roleId } = await avecTitulaire();
		const resultat = await agir('terminer', locaux(base, chef), { attributionId: String(id), responsabiliteId: roleId });
		expect(resultat.status).toBe(400);
		expect(resultat.data).toMatchObject({ cible: `terminer-${id}`, erreurs: { confirmation: expect.any(String) } });
		expect(await base.select().from(attribution).where(eq(attribution.id, id))).toMatchObject([{ fin: null }]);
	});

	it('termine le rôle dès aujourd’hui', async () => {
		const { base, chef, id, roleId } = await avecTitulaire();
		const resultat = await agir('terminer', locaux(base, chef), { attributionId: String(id), responsabiliteId: roleId, confirmation: 'oui' });
		expect(resultat).toMatchObject({ succes: true, message: 'Rôle terminé', cible: `terminer-${id}`, role: Number(roleId) });
		const [ligne] = await base.select().from(attribution).where(eq(attribution.id, id));
		expect(ligne!.fin! < aujourdhui).toBe(true);
	});

	it('refuse une attribution d’un autre rôle que celui du formulaire, ou hors des droits du rapporteur', async () => {
		const { base, rapporteur, chef, id, role } = await avecTitulaire();
		const horsDroits = await agir('terminer', locaux(base, rapporteur), { attributionId: String(id), responsabiliteId: String(role('Membre de comité')), confirmation: 'oui' });
		expect(horsDroits.status).toBe(400);
		const autreRole = await agir('terminer', locaux(base, chef), { attributionId: String(id), responsabiliteId: String(role('Référent pharmacie')), confirmation: 'oui' });
		expect(autreRole.status).toBe(400);
		const [ligne] = await base.select().from(attribution).where(eq(attribution.id, id));
		expect(ligne!.fin).toBeNull();
	});
});

describe('/nominations : changer la date de fin', () => {
	async function avecTitulaire() {
		const contexte = await preparer();
		const id = await attribuer(contexte.base, super_, { personneId: contexte.simpleId, responsabiliteId: contexte.role('Référent engins'), perimetre: { type: 'centre' }, debut: '2026-01-01', fin: '2099-12-31' }, aujourdhui);
		return { ...contexte, id, roleId: String(contexte.role('Référent engins')) };
	}
	const finDe = async (base: Awaited<ReturnType<typeof baseDeTest>>, id: number) => (await base.select().from(attribution).where(eq(attribution.id, id)))[0]!.fin;

	it('raccourcit le rôle ; le message vise le rôle', async () => {
		const { base, chef, id, roleId } = await avecTitulaire();
		const resultat = await agir('finir', locaux(base, chef), { attributionId: String(id), responsabiliteId: roleId, fin: '2099-06-30' });
		expect(resultat).toMatchObject({ succes: true, message: 'Date de fin enregistrée', cible: `finir-${id}`, role: Number(roleId) });
		expect(await finDe(base, id)).toBe('2099-06-30');
	});

	it('refuse d’allonger, sur le champ « fin »', async () => {
		const { base, chef, id, roleId } = await avecTitulaire();
		const resultat = await agir('finir', locaux(base, chef), { attributionId: String(id), responsabiliteId: roleId, fin: '2100-01-01' });
		expect(resultat).toMatchObject({ status: 400, data: { erreurs: { fin: 'Une attribution ne peut qu’être raccourcie' } } });
		expect(await finDe(base, id)).toBe('2099-12-31');
	});

	it('refuse un titulaire hors des droits du rapporteur, ou d’un autre rôle que celui du formulaire', async () => {
		const { base, rapporteur, chef, id, role } = await avecTitulaire();
		const horsDroits = await agir('finir', locaux(base, rapporteur), { attributionId: String(id), responsabiliteId: String(role('Membre de comité')), fin: '2099-01-01' });
		expect(horsDroits.status).toBe(400);
		const autreRole = await agir('finir', locaux(base, chef), { attributionId: String(id), responsabiliteId: String(role('Référent pharmacie')), fin: '2099-01-01' });
		expect(autreRole.status).toBe(400);
		expect(await finDe(base, id)).toBe('2099-12-31');
	});
});
