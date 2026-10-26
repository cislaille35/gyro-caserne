import { describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import centre from '$centre';
import { attribuer, attribution, chargerJeuDeDepart, comite, journal, personne, profil, responsabilite, responsabiliteDroit } from '@gyro-caserne/socle';
import { baseDeTest } from '@gyro-caserne/socle/base-de-test';
import { aujourdhuiParis } from '#lib/aujourdhui.ts';
import { actions, load } from './+page.server';

const super_ = { type: 'super', email: 'admin@exemple.fr' } as const;

async function preparer() {
	const base = await baseDeTest();
	await chargerJeuDeDepart(base, centre);
	const [agent] = await base.select().from(profil).where(eq(profil.nom, 'Agent'));
	const aujourdhui = aujourdhuiParis();
	const donner = async (email: string, nomResp?: string, perimetre: { type: 'centre' } | { type: 'comite'; id: number } = { type: 'centre' }) => {
		const [p] = await base.insert(personne).values({ email, prenom: 'P', nom: 'N', profilId: agent!.id }).returning();
		if (nomResp) {
			const [r] = await base.select().from(responsabilite).where(eq(responsabilite.nom, nomResp));
			await attribuer(base, super_, { personneId: p!.id, responsabiliteId: r!.id, perimetre, debut: '2026-01-01' }, aujourdhui);
		}
		return { type: 'personne', id: p!.id } as const;
	};
	const referent = await donner('ref@exemple.fr', 'Référent technique');
	const chef = await donner('chef@exemple.fr', 'Chef de centre');
	const ordinaire = await donner('agent@exemple.fr');
	const resp = async (nom: string) => (await base.select().from(responsabilite).where(eq(responsabilite.nom, nom)))[0]!;
	const com = async (nom: string) => (await base.select().from(comite).where(eq(comite.nom, nom)))[0]!;
	const droitsDe = async (id: number) => (await base.select().from(responsabiliteDroit).where(eq(responsabiliteDroit.responsabiliteId, id))).map((l) => l.droit).sort();
	return { base, donner, referent, chef, ordinaire, resp, com, droitsDe, aujourdhui };
}

const locaux = (base: unknown, acteur: unknown) => ({ base, acteur });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const lire = (locals: unknown) => (load as any)({ locals });
const envoyer = (nom: keyof typeof actions, locals: unknown, corps: [string, string][]) =>
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	(actions[nom] as any)({ locals, request: new Request('http://x', { method: 'POST', body: new URLSearchParams(corps) }) });

describe('load de /reglages', () => {
	it('renvoie vers la connexion sans acteur', async () => {
		const { base } = await preparer();
		await expect(lire(locaux(base, null))).rejects.toMatchObject({ status: 303, location: '/connexion' });
	});

	it('refuse un agent ordinaire, au chargement et pour chaque action', async () => {
		const { base, ordinaire, resp } = await preparer();
		const locals = locaux(base, ordinaire);
		await expect(lire(locals)).rejects.toMatchObject({ status: 403 });
		const engins = await resp('Référent engins');
		for (const nom of Object.keys(actions) as (keyof typeof actions)[]) {
			await expect(envoyer(nom, locals, [['id', String(engins.id)], ['nom', 'X'], ['theme', 'x'], ['confirmation', 'oui']])).rejects.toMatchObject({ status: 403 });
		}
		expect(await base.select().from(journal).where(eq(journal.action, 'creer_comite'))).toHaveLength(0);
	});

	it('donne les deux listes au référent technique, sans pouvoir', async () => {
		const { base, referent } = await preparer();
		const data = await lire(locaux(base, referent));
		expect(data.peutPouvoir).toBe(false);
		expect(data.comites.map((c: { nom: string }) => c.nom)).toContain('Amicale');
		const rapporteur = data.responsabilites.find((r: { nom: string }) => r.nom === 'Rapporteur de comité');
		expect(rapporteur.protegee).toBe(true);
		expect(data).not.toHaveProperty('equipes');
	});

	it('donne le pouvoir au chef de centre et au super administrateur', async () => {
		const { base, chef } = await preparer();
		expect((await lire(locaux(base, chef))).peutPouvoir).toBe(true);
		expect((await lire(locaux(base, super_))).peutPouvoir).toBe(true);
	});

	it('met à null la liste dont l’acteur n’a pas le droit', async () => {
		const { base, donner } = await preparer();
		const [liste] = await base.insert(responsabilite).values({ nom: 'Gestion listes', nature: 'mission', typePerimetre: 'centre' }).returning();
		await base.insert(responsabiliteDroit).values({ responsabiliteId: liste!.id, droit: 'GERER_LISTES' });
		const [com] = await base.insert(responsabilite).values({ nom: 'Gestion comités', nature: 'mission', typePerimetre: 'centre' }).returning();
		await base.insert(responsabiliteDroit).values({ responsabiliteId: com!.id, droit: 'GERER_COMITES' });
		const a = await donner('a@exemple.fr', 'Gestion listes');
		const b = await donner('b@exemple.fr', 'Gestion comités');
		expect(await lire(locaux(base, a))).toMatchObject({ comites: null, responsabilites: expect.any(Array) });
		expect(await lire(locaux(base, b))).toMatchObject({ comites: expect.any(Array), responsabilites: null });
	});
});

describe('comités', () => {
	it('crée un comité et le dit', async () => {
		const { base, referent } = await preparer();
		const r = await envoyer('creerComite', locaux(base, referent), [['nom', ' Sport '], ['theme', 'sport']]);
		expect(r).toMatchObject({ cible: 'comite-nouveau', succes: expect.stringContaining('Sport') });
		expect((await base.select().from(comite).where(eq(comite.nom, 'Sport'))).length).toBe(1);
	});

	it('met l’erreur du nom ou du thème sur le bon formulaire', async () => {
		const { base, referent } = await preparer();
		const doublon = await envoyer('creerComite', locaux(base, referent), [['nom', 'amicale '], ['theme', 'x']]);
		expect(doublon).toMatchObject({ status: 400, data: { cible: 'comite-nouveau', erreurs: { nom: expect.stringContaining('déjà') }, valeurs: { theme: 'x' } } });
		const vide = await envoyer('creerComite', locaux(base, referent), [['nom', 'Z'], ['theme', ' ']]);
		expect(vide).toMatchObject({ status: 400, data: { erreurs: { theme: expect.any(String) } } });
	});

	it('modifie un comité ; le comité du centre ne se renomme pas', async () => {
		const { base, referent, com } = await preparer();
		const amicale = await com('Amicale');
		const ok = await envoyer('modifierComite', locaux(base, referent), [['id', String(amicale.id)], ['nom', 'Amicale 2'], ['theme', 'fêtes']]);
		expect(ok).toMatchObject({ cible: `comite-${amicale.id}`, succes: expect.any(String) });
		const centreCom = await com('Comité du centre');
		const refus = await envoyer('modifierComite', locaux(base, referent), [['id', String(centreCom.id)], ['nom', 'Autre'], ['theme', 'centre']]);
		expect(refus).toMatchObject({ status: 400, data: { cible: `comite-${centreCom.id}`, erreurs: { nom: expect.stringContaining('centre') } } });
	});

	it('dissout seulement avec confirmation, et le dit', async () => {
		const { base, referent, com } = await preparer();
		const amicale = await com('Amicale');
		const sans = await envoyer('dissoudreComite', locaux(base, referent), [['id', String(amicale.id)]]);
		expect(sans).toMatchObject({ status: 400, data: { cible: `comite-${amicale.id}`, message: expect.stringContaining('confirme') } });
		expect((await com('Amicale')).dissousLe).toBeNull();
		const ok = await envoyer('dissoudreComite', locaux(base, referent), [['id', String(amicale.id)], ['confirmation', 'oui']]);
		expect(ok).toMatchObject({ succes: expect.any(String) });
		expect((await com('Amicale')).dissousLe).not.toBeNull();
	});

	it('refuse de dissoudre le comité du centre, avec un message clair', async () => {
		const { base, referent, com } = await preparer();
		const c = await com('Comité du centre');
		const r = await envoyer('dissoudreComite', locaux(base, referent), [['id', String(c.id)], ['confirmation', 'oui']]);
		expect(r).toMatchObject({ status: 400, data: { cible: `comite-${c.id}`, message: expect.stringContaining('centre') } });
	});

	it('refuse de dissoudre un comité qui attribue une responsabilité de portée « comité », message sur le bon formulaire', async () => {
		const { base, referent, com } = await preparer();
		const amicale = await com('Amicale');
		await base.insert(responsabilite).values({ nom: 'Délégué', nature: 'mission', typePerimetre: 'comite', comiteAttributeurId: amicale.id });
		const r = await envoyer('dissoudreComite', locaux(base, referent), [['id', String(amicale.id)], ['confirmation', 'oui']]);
		expect(r).toMatchObject({ status: 400, data: { cible: `comite-${amicale.id}`, message: 'Changez d’abord qui attribue « Délégué »' } });
		expect((await com('Amicale')).dissousLe).toBeNull();
	});

	it('traduit le refus de droit en 403', async () => {
		const { base, donner } = await preparer();
		const [liste] = await base.insert(responsabilite).values({ nom: 'Gestion listes', nature: 'mission', typePerimetre: 'centre' }).returning();
		await base.insert(responsabiliteDroit).values({ responsabiliteId: liste!.id, droit: 'GERER_LISTES' });
		const a = await donner('a@exemple.fr', 'Gestion listes');
		const r = await envoyer('creerComite', locaux(base, a), [['nom', 'Sport'], ['theme', 'sport']]);
		expect(r).toMatchObject({ status: 403, data: { message: expect.stringContaining('comités') } });
		expect(r.data.message).not.toContain('GERER');
	});

	it('dissoudre un comité retire le droit au rapporteur et le journal le note', async () => {
		const { base, chef, com, donner } = await preparer();
		const amicale = await com('Amicale');
		const rap = await donner('rap@exemple.fr', 'Rapporteur de comité', { type: 'comite', id: amicale.id });
		await envoyer('dissoudreComite', locaux(base, chef), [['id', String(amicale.id)], ['confirmation', 'oui']]);
		const [ligne] = await base.select().from(attribution).where(and(eq(attribution.personneId, rap.id)));
		expect(ligne!.fin).not.toBeNull();
		expect(await base.select().from(journal).where(eq(journal.action, 'dissoudre_comite'))).toHaveLength(1);
	});
});

// Les champs donnés remplacent ceux par défaut ; « droits » s'ajoute.
const corpsResp = (extra: [string, string][] = []): [string, string][] => {
	const defauts: [string, string][] = [['nom', 'Référent sport'], ['nature', 'mission'], ['portee', 'centre'], ['attributeur', 'chef_centre'], ['droits', 'GERER_PLANNING']];
	const remplaces = new Set(extra.map(([cle]) => cle).filter((cle) => cle !== 'droits'));
	return [...defauts.filter(([cle]) => !remplaces.has(cle)), ...extra];
};

describe('responsabilités', () => {
	it('crée une responsabilité avec ses droits', async () => {
		const { base, referent, resp, droitsDe } = await preparer();
		const r = await envoyer('creerResponsabilite', locaux(base, referent), corpsResp([['droits', 'VOIR_PLANNING']]));
		expect(r).toMatchObject({ cible: 'resp-nouvelle', succes: expect.any(String) });
		expect(await droitsDe((await resp('Référent sport')).id)).toEqual(['GERER_PLANNING', 'VOIR_PLANNING']);
	});

	it('désigne un comité comme attributeur', async () => {
		const { base, chef, resp, com } = await preparer();
		const amicale = await com('Amicale');
		const r = await envoyer('creerResponsabilite', locaux(base, chef), corpsResp([['nom', 'Fêtes'], ['attributeur', `comite:${amicale.id}`]]));
		expect(r.succes).toBeDefined();
		expect((await resp('Fêtes')).comiteAttributeurId).toBe(amicale.id);
	});

	it('refuse « comité visé » sans portée comité et « chef de centre » avec portée comité, sur le champ', async () => {
		const { base, chef } = await preparer();
		const a = await envoyer('creerResponsabilite', locaux(base, chef), corpsResp([['attributeur', 'comite_vise']]));
		expect(a).toMatchObject({ status: 400, data: { cible: 'resp-nouvelle', erreurs: { attributeur: expect.stringContaining('comité') } } });
		const b = await envoyer('creerResponsabilite', locaux(base, chef), corpsResp([['portee', 'comite']]));
		expect(b).toMatchObject({ status: 400, data: { erreurs: { attributeur: expect.any(String) } } });
	});

	it('refuse au référent un droit de pouvoir, sur le champ des droits, rien d’écrit', async () => {
		const { base, referent, resp } = await preparer();
		const r = await envoyer('creerResponsabilite', locaux(base, referent), corpsResp([['droits', 'GERER_ACCES']]));
		expect(r).toMatchObject({ status: 403, data: { cible: 'resp-nouvelle', message: expect.stringContaining('chef de centre') } });
		expect(await base.select().from(responsabilite).where(eq(responsabilite.nom, 'Référent sport'))).toHaveLength(0);
		await resp('Référent engins');
	});

	it('refuse le nom en double sans tenir compte de la casse', async () => {
		const { base, referent } = await preparer();
		const r = await envoyer('creerResponsabilite', locaux(base, referent), corpsResp([['nom', ' référent ENGINS ']]));
		expect(r).toMatchObject({ status: 400, data: { erreurs: { nom: expect.stringContaining('déjà') } } });
	});

	it('modifie une responsabilité sans pouvoir ; les droits verrouillés sont conservés même non envoyés', async () => {
		const { base, referent, resp, droitsDe } = await preparer();
		const engins = await resp('Référent engins');
		const r = await envoyer('modifierResponsabilite', locaux(base, referent), [['id', String(engins.id)], ['nom', 'Référent engins'], ['nature', 'mission'], ['attributeur', 'chef_centre'], ['droits', 'GERER_STOCK']]);
		expect(r).toMatchObject({ cible: `resp-${engins.id}`, succes: expect.any(String) });
		expect(await droitsDe(engins.id)).toEqual(['GERER_STOCK']);
		const chefEq = await resp('Chef d’équipe');
		await base.update(responsabiliteDroit).set({ verrouille: 1 }).where(eq(responsabiliteDroit.responsabiliteId, chefEq.id));
		const garde = await envoyer('modifierResponsabilite', locaux(base, referent), [['id', String(chefEq.id)], ['nom', 'Chef d’équipe'], ['nature', 'fonction'], ['attributeur', 'chef_centre'], ['droits', 'VOIR_PLANNING']]);
		expect(garde.succes).toBeDefined();
		expect(await droitsDe(chefEq.id)).toEqual(['VALIDER_REMPLACEMENT', 'VOIR_MOTIFS_ABSENCE', 'VOIR_PLANNING']);
	});

	it('refuse au référent de modifier ou d’archiver une responsabilité qui porte du pouvoir, rien d’écrit', async () => {
		const { base, referent, resp, droitsDe } = await preparer();
		const sienne = await resp('Référent technique');
		const avant = await droitsDe(sienne.id);
		const m = await envoyer('modifierResponsabilite', locaux(base, referent), [['id', String(sienne.id)], ['nom', 'Autre nom'], ['nature', 'fonction'], ['attributeur', 'chef_centre'], ...avant.map((d): [string, string] => ['droits', d])]);
		expect(m).toMatchObject({ status: 403, data: { cible: `resp-${sienne.id}`, message: expect.stringContaining('chef de centre') } });
		const a = await envoyer('archiverResponsabilite', locaux(base, referent), [['id', String(sienne.id)], ['confirmation', 'oui']]);
		expect(a).toMatchObject({ status: 403, data: { cible: `resp-${sienne.id}` } });
		expect((await resp('Référent technique')).archiveeLe).toBeNull();
		expect((await resp('Référent technique')).nom).toBe('Référent technique');
		expect(await droitsDe(sienne.id)).toEqual(avant);
	});

	it('le référent qui coche un droit de pouvoir sur une responsabilité ordinaire est refusé', async () => {
		const { base, referent, resp, droitsDe } = await preparer();
		const engins = await resp('Référent engins');
		const avant = await droitsDe(engins.id);
		const r = await envoyer('modifierResponsabilite', locaux(base, referent), [['id', String(engins.id)], ['nom', 'Référent engins'], ['nature', 'mission'], ['attributeur', 'chef_centre'], ...avant.map((d): [string, string] => ['droits', d]), ['droits', 'GERER_ACCES']]);
		expect(r).toMatchObject({ status: 403 });
		expect(await droitsDe(engins.id)).toEqual(avant);
	});

	it('le chef de centre modifie une responsabilité qui porte du pouvoir', async () => {
		const { base, chef, resp, droitsDe } = await preparer();
		const rap = await resp('Rapporteur de comité');
		const r = await envoyer('modifierResponsabilite', locaux(base, chef), [['id', String(rap.id)], ['nom', 'Rapporteur'], ['nature', 'mission'], ['attributeur', 'comite_vise'], ['droits', 'ATTRIBUER_RESPONSABILITE'], ['droits', 'VOIR_PLANNING']]);
		expect(r.succes).toBeDefined();
		expect(await droitsDe(rap.id)).toEqual(['ATTRIBUER_RESPONSABILITE', 'VOIR_PLANNING']);
	});

	it('archive avec confirmation seulement, et jamais une responsabilité système', async () => {
		const { base, referent, resp } = await preparer();
		const engins = await resp('Référent engins');
		const sans = await envoyer('archiverResponsabilite', locaux(base, referent), [['id', String(engins.id)]]);
		expect(sans).toMatchObject({ status: 400, data: { cible: `resp-${engins.id}`, message: expect.stringContaining('confirme') } });
		const ok = await envoyer('archiverResponsabilite', locaux(base, referent), [['id', String(engins.id)], ['confirmation', 'oui']]);
		expect(ok.succes).toBeDefined();
		expect((await resp('Référent engins')).archiveeLe).not.toBeNull();
		const sys = await resp('Chef d’équipe');
		const refus = await envoyer('archiverResponsabilite', locaux(base, referent), [['id', String(sys.id)], ['confirmation', 'oui']]);
		expect(refus).toMatchObject({ status: 400, data: { message: expect.stringContaining('système') } });
	});

	it('rejette un identifiant qui n’en est pas un', async () => {
		const { base, referent } = await preparer();
		const r = await envoyer('archiverResponsabilite', locaux(base, referent), [['id', 'abc'], ['confirmation', 'oui']]);
		expect(r).toMatchObject({ status: 400 });
	});
});
