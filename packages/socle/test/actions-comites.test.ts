import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import centreExemple from '../../../centres/exemple/centre.ts';
import { attribuer } from '../src/actions/attributions.ts';
import { creerComite, dissoudreComite, listerComites, modifierComite } from '../src/actions/comites.ts';
import { aLeDroit, type Acteur } from '../src/droits.ts';
import { DonneeInvalide, RefusDroit } from '../src/erreurs.ts';
import { chargerJeuDeDepart, NOM_COMITE_CENTRE } from '../src/jeu-de-depart.ts';
import { attribution, comite, journal, personne, profil, responsabilite, responsabiliteDroit } from '../src/schema.ts';
import { baseDeTest } from './base-de-test.ts';

const aujourdhui = '2026-10-25';
const superAdmin: Acteur = { type: 'super', email: 'admin@exemple.fr' };

async function jeu() {
	const base = await baseDeTest();
	await chargerJeuDeDepart(base, centreExemple);
	const [agent] = await base.select().from(profil).where(eq(profil.nom, 'Agent'));
	const nouvelle = async (email: string) => (await base.insert(personne).values({ email, prenom: 'P', nom: 'N', profilId: agent!.id }).returning())[0]!.id;
	const responsabilite_ = async (nom: string) => (await base.select().from(responsabilite).where(eq(responsabilite.nom, nom)))[0]!;
	const comite_ = async (nom: string) => (await base.select().from(comite).where(eq(comite.nom, nom)))[0]!;
	const donner = async (email: string, nomResp: string, perimetre: Parameters<typeof attribuer>[2]['perimetre'], debut = '2026-01-01') => {
		const id = await nouvelle(email);
		await attribuer(base, superAdmin, { personneId: id, responsabiliteId: (await responsabilite_(nomResp)).id, perimetre, debut }, aujourdhui);
		return { type: 'personne', id } as Acteur;
	};
	return { base, nouvelle, responsabilite_, comite_, donner };
}

describe('droit GERER_COMITES', () => {
	it('refuse un agent et un chef d’équipe', async () => {
		const { base, nouvelle, donner } = await jeu();
		const agent: Acteur = { type: 'personne', id: await nouvelle('agent@exemple.fr') };
		const chefEquipe = await donner('chef@exemple.fr', 'Chef d’équipe', { type: 'equipe', id: 1 });
		for (const acteur of [agent, chefEquipe]) {
			await expect(listerComites(base, acteur, aujourdhui)).rejects.toBeInstanceOf(RefusDroit);
			await expect(creerComite(base, acteur, { nom: 'Sport', theme: 'sport' }, aujourdhui)).rejects.toBeInstanceOf(RefusDroit);
			await expect(modifierComite(base, acteur, 1, { theme: 'x' }, aujourdhui)).rejects.toBeInstanceOf(RefusDroit);
			await expect(dissoudreComite(base, acteur, 2, aujourdhui)).rejects.toBeInstanceOf(RefusDroit);
		}
	});

	it('accepte le référent technique, le chef de centre et le super administrateur', async () => {
		const { base, donner } = await jeu();
		const referent = await donner('ref@exemple.fr', 'Référent technique', { type: 'centre' });
		const chef = await donner('chef@exemple.fr', 'Chef de centre', { type: 'centre' });
		for (const [i, acteur] of [referent, chef, superAdmin].entries()) {
			await expect(creerComite(base, acteur, { nom: `Sport ${i}`, theme: 'sport' }, aujourdhui)).resolves.toBeTypeOf('number');
			await expect(listerComites(base, acteur, aujourdhui)).resolves.toBeInstanceOf(Array);
		}
	});
});

describe('listerComites', () => {
	it('donne les rapporteurs en cours (rôle de comité qui nomme), par comité', async () => {
		const { base, comite_, donner, nouvelle, responsabilite_ } = await jeu();
		const amicale = await comite_('Amicale');
		const rap = await donner('rap@exemple.fr', 'Rapporteur de comité', { type: 'comite', id: amicale.id });
		await base.update(personne).set({ prenom: 'Alice', nom: 'Martin' }).where(eq(personne.id, (rap as { id: number }).id));
		await donner('membre@exemple.fr', 'Membre de comité', { type: 'comite', id: amicale.id });
		const ancien = await nouvelle('ancien@exemple.fr');
		await base.insert(attribution).values({ personneId: ancien, responsabiliteId: (await responsabilite_('Rapporteur de comité')).id, perimetreType: 'comite', perimetreId: amicale.id, debut: '2025-01-01', fin: '2025-12-31', saisiePar: 'super:a@b.fr', saisieLe: '2025-01-01' });
		const liste = await listerComites(base, superAdmin, aujourdhui);
		expect(liste.find((c) => c.id === amicale.id)).toMatchObject({ membresEnCours: 2, rapporteurs: ['Alice Martin'] });
		expect(liste.find((c) => c.estCentre)!.rapporteurs).toEqual([]);
	});

	it('ne compte pas comme rapporteur un agent parti, ni un rôle archivé', async () => {
		const { base, comite_, donner } = await jeu();
		const amicale = await comite_('Amicale');
		const parti = await donner('parti@exemple.fr', 'Rapporteur de comité', { type: 'comite', id: amicale.id });
		await base.update(personne).set({ statut: 'parti' }).where(eq(personne.id, (parti as { id: number }).id));
		const [archive] = await base.insert(responsabilite).values({ nom: 'Ancien rapporteur', nature: 'mission', typePerimetre: 'comite', archiveeLe: '2026-01-01' }).returning();
		await base.insert(responsabiliteDroit).values({ responsabiliteId: archive!.id, droit: 'ATTRIBUER_RESPONSABILITE' });
		const autre = await donner('autre@exemple.fr', 'Membre de comité', { type: 'comite', id: amicale.id });
		await base.insert(attribution).values({ personneId: (autre as { id: number }).id, responsabiliteId: archive!.id, perimetreType: 'comite', perimetreId: amicale.id, debut: '2026-01-01', saisiePar: 'super:a@b.fr', saisieLe: '2026-01-01' });
		expect((await listerComites(base, superAdmin, aujourdhui)).find((c) => c.id === amicale.id)!.rapporteurs).toEqual([]);
	});
});

describe('creerComite', () => {
	it('crée, journalise et apparaît dans la liste', async () => {
		const { base } = await jeu();
		const id = await creerComite(base, superAdmin, { nom: '  Sport  ', theme: ' sport ' }, aujourdhui);
		const liste = await listerComites(base, superAdmin, aujourdhui);
		expect(liste.find((c) => c.id === id)).toEqual({ id, nom: 'Sport', theme: 'sport', icone: null, dissousLe: null, estCentre: false, membresEnCours: 0, rapporteurs: [] });
		expect(liste.filter((c) => c.estCentre).map((c) => c.nom)).toEqual([NOM_COMITE_CENTRE]);
		const [ligne] = await base.select().from(journal).where(eq(journal.action, 'creer_comite'));
		expect(ligne).toMatchObject({ cibleType: 'comite', cibleId: id, acteur: 'super:admin@exemple.fr' });
	});

	it('refuse un nom en double, sans tenir compte de la casse ni des espaces de bord', async () => {
		const { base } = await jeu();
		await expect(creerComite(base, superAdmin, { nom: 'amicale', theme: 'x' }, aujourdhui)).rejects.toThrow(new DonneeInvalide('Nom déjà utilisé'));
		await expect(creerComite(base, superAdmin, { nom: ' AMICALE ', theme: 'x' }, aujourdhui)).rejects.toThrow(new DonneeInvalide('Nom déjà utilisé'));
	});

	it('refuse un nom vide ou de plus de 60 caractères', async () => {
		const { base } = await jeu();
		await expect(creerComite(base, superAdmin, { nom: '   ', theme: 'x' }, aujourdhui)).rejects.toBeInstanceOf(DonneeInvalide);
		await expect(creerComite(base, superAdmin, { nom: 'a'.repeat(61), theme: 'x' }, aujourdhui)).rejects.toBeInstanceOf(DonneeInvalide);
		await expect(creerComite(base, superAdmin, { nom: 'a'.repeat(60), theme: 'x' }, aujourdhui)).resolves.toBeTypeOf('number');
		await expect(creerComite(base, superAdmin, { nom: 'Ok', theme: '' }, aujourdhui)).rejects.toBeInstanceOf(DonneeInvalide);
	});
});

describe('modifierComite', () => {
	it('modifie le nom et le thème, journalise les noms de champs', async () => {
		const { base, comite_ } = await jeu();
		const amicale = await comite_('Amicale');
		await modifierComite(base, superAdmin, amicale.id, { nom: 'Amicale des pompiers', theme: 'vie' }, aujourdhui);
		const [apres] = await base.select().from(comite).where(eq(comite.id, amicale.id));
		expect(apres).toMatchObject({ nom: 'Amicale des pompiers', theme: 'vie' });
		const [ligne] = await base.select().from(journal).where(eq(journal.action, 'modifier_comite'));
		expect(JSON.parse(ligne!.details)).toEqual({ champs: ['nom', 'theme'] });
	});

	it('enregistre l’icône, la retire avec null, refuse une icône inconnue', async () => {
		const { base, comite_ } = await jeu();
		const amicale = await comite_('Amicale');
		await modifierComite(base, superAdmin, amicale.id, { icone: 'ballon' }, aujourdhui);
		expect((await comite_('Amicale')).icone).toBe('ballon');
		expect((await listerComites(base, superAdmin, aujourdhui)).find((c) => c.id === amicale.id)?.icone).toBe('ballon');
		const [ligne] = await base.select().from(journal).where(eq(journal.action, 'modifier_comite'));
		expect(JSON.parse(ligne!.details)).toEqual({ champs: ['icone'] });
		await expect(modifierComite(base, superAdmin, amicale.id, { icone: 'licorne' as never }, aujourdhui)).rejects.toThrow(new DonneeInvalide('Icône inconnue'));
		await modifierComite(base, superAdmin, amicale.id, { icone: null }, aujourdhui);
		expect((await comite_('Amicale')).icone).toBeNull();
	});

	it('crée un comité avec une icône, ou sans', async () => {
		const { base, comite_ } = await jeu();
		await creerComite(base, superAdmin, { nom: 'Sport', theme: 'sport', icone: 'ballon' }, aujourdhui);
		await creerComite(base, superAdmin, { nom: 'Fêtes', theme: 'fêtes' }, aujourdhui);
		expect((await comite_('Sport')).icone).toBe('ballon');
		expect((await comite_('Fêtes')).icone).toBeNull();
		await expect(creerComite(base, superAdmin, { nom: 'Autre', theme: 'x', icone: 'licorne' as never }, aujourdhui)).rejects.toThrow(new DonneeInvalide('Icône inconnue'));
	});

	it('refuse le nom d’un autre comité mais pas le sien en changeant la casse', async () => {
		const { base, comite_ } = await jeu();
		const amicale = await comite_('Amicale');
		await expect(modifierComite(base, superAdmin, amicale.id, { nom: `  ${NOM_COMITE_CENTRE.toUpperCase()}` }, aujourdhui)).rejects.toThrow(new DonneeInvalide('Nom déjà utilisé'));
		await expect(modifierComite(base, superAdmin, amicale.id, { nom: 'AMICALE' }, aujourdhui)).resolves.toBeUndefined();
	});

	it('ne renomme pas le comité du centre', async () => {
		const { base, comite_ } = await jeu();
		const centre = await comite_(NOM_COMITE_CENTRE);
		await expect(modifierComite(base, superAdmin, centre.id, { nom: 'Autre' }, aujourdhui)).rejects.toBeInstanceOf(DonneeInvalide);
		await expect(modifierComite(base, superAdmin, centre.id, { theme: 'direction' }, aujourdhui)).resolves.toBeUndefined();
	});

	it('refuse un comité inconnu ou dissous', async () => {
		const { base, comite_ } = await jeu();
		await expect(modifierComite(base, superAdmin, 999, { theme: 'x' }, aujourdhui)).rejects.toThrow(new DonneeInvalide('Comité inconnu'));
		const amicale = await comite_('Amicale');
		await dissoudreComite(base, superAdmin, amicale.id, aujourdhui);
		await expect(modifierComite(base, superAdmin, amicale.id, { theme: 'x' }, aujourdhui)).rejects.toThrow(new DonneeInvalide('Comité dissous'));
	});
});

describe('dissoudreComite', () => {
	it('arrête les attributions dès aujourd’hui, supprime celles à venir, libère les responsabilités attribuées, journalise', async () => {
		const { base, comite_, responsabilite_, donner, nouvelle } = await jeu();
		const amicale = await comite_('Amicale');
		const perimetre = { type: 'comite' as const, id: amicale.id };
		const rapporteur = await donner('rapp@exemple.fr', 'Rapporteur de comité', perimetre);
		const futur = await nouvelle('futur@exemple.fr');
		const rapp = await responsabilite_('Rapporteur de comité');
		await attribuer(base, superAdmin, { personneId: futur, responsabiliteId: rapp.id, perimetre, debut: '2026-12-01' }, aujourdhui);
		const aujourdhuiMeme = await nouvelle('jour@exemple.fr');
		await attribuer(base, superAdmin, { personneId: aujourdhuiMeme, responsabiliteId: rapp.id, perimetre, debut: aujourdhui }, aujourdhui);
		// Une responsabilité de centre attribuée par ce comité.
		const [attribuee] = await base.insert(responsabilite).values({ nom: 'Fêtes', nature: 'mission', typePerimetre: 'centre', comiteAttributeurId: amicale.id }).returning();
		// Une attribution ailleurs ne bouge pas.
		const ailleurs = await donner('ailleurs@exemple.fr', 'Rapporteur de comité', { type: 'comite', id: (await comite_(NOM_COMITE_CENTRE)).id });

		expect(await aLeDroit(base, rapporteur, 'ATTRIBUER_RESPONSABILITE', perimetre, aujourdhui)).toBe(true);
		const avant = (await listerComites(base, superAdmin, aujourdhui)).find((c) => c.id === amicale.id);
		expect(avant?.membresEnCours).toBe(2);

		await dissoudreComite(base, superAdmin, amicale.id, aujourdhui);

		expect(await aLeDroit(base, rapporteur, 'ATTRIBUER_RESPONSABILITE', perimetre, aujourdhui)).toBe(false);
		expect(await aLeDroit(base, ailleurs, 'ATTRIBUER_RESPONSABILITE', { type: 'comite', id: (await comite_(NOM_COMITE_CENTRE)).id }, aujourdhui)).toBe(true);
		const restantes = await base.select().from(attribution).where(eq(attribution.perimetreId, amicale.id));
		expect(restantes.map((a) => [a.personneId, a.fin])).toEqual([[(rapporteur as { id: number }).id, '2026-10-24']]);
		const [lue] = await base.select().from(responsabilite).where(eq(responsabilite.id, attribuee!.id));
		expect(lue!.comiteAttributeurId).toBeNull();
		const [apres] = await base.select().from(comite).where(eq(comite.id, amicale.id));
		expect(apres!.dissousLe).toBe(aujourdhui);
		const [ligne] = await base.select().from(journal).where(eq(journal.action, 'dissoudre_comite'));
		expect(ligne).toMatchObject({ cibleType: 'comite', cibleId: amicale.id });
		expect(JSON.parse(ligne!.details)).toEqual({ attributionsClose: 3 });
	});

	it('refuse tant qu’une responsabilité de portée « comité » en cours est attribuée par ce comité, rien n’est écrit', async () => {
		const { base, comite_, nouvelle } = await jeu();
		const amicale = await comite_('Amicale');
		await nouvelle('x@exemple.fr');
		await base.insert(responsabilite).values({ nom: 'Archivée', nature: 'mission', typePerimetre: 'comite', comiteAttributeurId: amicale.id, archiveeLe: '2026-01-01' });
		await base.insert(responsabilite).values({ nom: 'Délégué', nature: 'mission', typePerimetre: 'comite', comiteAttributeurId: amicale.id });
		const avant = await base.select().from(journal);
		await expect(dissoudreComite(base, superAdmin, amicale.id, aujourdhui)).rejects.toThrow(new DonneeInvalide('Changez d’abord qui attribue « Délégué »'));
		expect((await comite_('Amicale')).dissousLe).toBeNull();
		expect(await base.select().from(journal)).toHaveLength(avant.length);
		// Une fois archivée, la dissolution passe.
		await base.update(responsabilite).set({ archiveeLe: aujourdhui }).where(eq(responsabilite.nom, 'Délégué'));
		await expect(dissoudreComite(base, superAdmin, amicale.id, aujourdhui)).resolves.toBeUndefined();
	});

	it('refuse le comité du centre, un comité inconnu et un comité déjà dissous', async () => {
		const { base, comite_ } = await jeu();
		const centre = await comite_(NOM_COMITE_CENTRE);
		await expect(dissoudreComite(base, superAdmin, centre.id, aujourdhui)).rejects.toThrow(new DonneeInvalide('Le comité du centre ne se dissout pas'));
		await expect(dissoudreComite(base, superAdmin, 999, aujourdhui)).rejects.toThrow(new DonneeInvalide('Comité inconnu'));
		const amicale = await comite_('Amicale');
		await dissoudreComite(base, superAdmin, amicale.id, aujourdhui);
		await expect(dissoudreComite(base, superAdmin, amicale.id, aujourdhui)).rejects.toThrow(new DonneeInvalide('Comité déjà dissous'));
	});
});
