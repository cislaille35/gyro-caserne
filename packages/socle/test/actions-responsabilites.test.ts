import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import centreExemple from '../../../centres/exemple/centre.ts';
import { attribuer } from '../src/actions/attributions.ts';
import { dissoudreComite } from '../src/actions/comites.ts';
import { archiverResponsabilite, creerResponsabilite, listerResponsabilites, modifierResponsabilite } from '../src/actions/responsabilites.ts';
import { aLeDroit, type Acteur } from '../src/droits.ts';
import { DonneeInvalide, RefusDroit } from '../src/erreurs.ts';
import { chargerJeuDeDepart, NOM_COMITE_CENTRE } from '../src/jeu-de-depart.ts';
import { attribution, comite, journal, personne, profil, responsabilite, responsabiliteDroit } from '../src/schema.ts';
import { baseDeTest } from './base-de-test.ts';

const aujourdhui = '2026-10-25';
const superAdmin: Acteur = { type: 'super', email: 'admin@exemple.fr' };
const DONNER = 'Seuls le chef de centre ou un super administrateur donnent un droit de pouvoir';
const MODIFIER = 'Seuls le chef de centre ou un super administrateur modifient une responsabilité qui donne un droit de pouvoir';

async function jeu() {
	const base = await baseDeTest();
	await chargerJeuDeDepart(base, centreExemple);
	const [agent] = await base.select().from(profil).where(eq(profil.nom, 'Agent'));
	const nouvelle = async (email: string) => (await base.insert(personne).values({ email, prenom: 'P', nom: 'N', profilId: agent!.id }).returning())[0]!.id;
	const resp = async (nom: string) => (await base.select().from(responsabilite).where(eq(responsabilite.nom, nom)))[0]!;
	const comite_ = async (nom: string) => (await base.select().from(comite).where(eq(comite.nom, nom)))[0]!;
	const donner = async (email: string, nomResp: string, perimetre: Parameters<typeof attribuer>[2]['perimetre'], debut = '2026-01-01') => {
		const id = await nouvelle(email);
		await attribuer(base, superAdmin, { personneId: id, responsabiliteId: (await resp(nomResp)).id, perimetre, debut }, aujourdhui);
		return { type: 'personne', id } as Acteur;
	};
	const referent = await donner('ref@exemple.fr', 'Référent technique', { type: 'centre' });
	const chef = await donner('chef@exemple.fr', 'Chef de centre', { type: 'centre' });
	const droitsDe = async (id: number) => (await base.select().from(responsabiliteDroit).where(eq(responsabiliteDroit.responsabiliteId, id))).map((l) => l.droit).sort();
	return { base, nouvelle, resp, comite_, donner, referent, chef, droitsDe };
}

const nouvelleResp = { nom: 'Référent sport', nature: 'mission' as const, portee: 'centre' as const, attributeur: { type: 'chef_centre' as const }, droits: ['GERER_PLANNING' as const] };

describe('droit GERER_LISTES', () => {
	it('refuse un agent et un chef de garde', async () => {
		const { base, nouvelle, donner, resp } = await jeu();
		const agent: Acteur = { type: 'personne', id: await nouvelle('agent@exemple.fr') };
		const chefEquipe = await donner('ce@exemple.fr', 'Chef de garde', { type: 'equipe', id: 1 });
		const engins = await resp('Référent engins');
		for (const acteur of [agent, chefEquipe]) {
			await expect(listerResponsabilites(base, acteur, aujourdhui)).rejects.toBeInstanceOf(RefusDroit);
			await expect(creerResponsabilite(base, acteur, nouvelleResp, aujourdhui)).rejects.toBeInstanceOf(RefusDroit);
			await expect(modifierResponsabilite(base, acteur, engins.id, { nom: 'X' }, aujourdhui)).rejects.toBeInstanceOf(RefusDroit);
			await expect(archiverResponsabilite(base, acteur, engins.id, aujourdhui)).rejects.toBeInstanceOf(RefusDroit);
		}
	});

	it('le référent technique gère les responsabilités sans droit de pouvoir', async () => {
		const { base, referent, resp } = await jeu();
		const id = await creerResponsabilite(base, referent, nouvelleResp, aujourdhui);
		await expect(modifierResponsabilite(base, referent, id, { droits: ['GERER_PLANNING', 'GERER_STOCK'] }, aujourdhui)).resolves.toBeUndefined();
		await expect(modifierResponsabilite(base, referent, (await resp('Chef de garde')).id, { nom: 'Chef d’agrès' }, aujourdhui)).resolves.toBeUndefined();
		await expect(archiverResponsabilite(base, referent, id, aujourdhui)).resolves.toBeUndefined();
	});
});

describe('droits de pouvoir', () => {
	it('le référent technique ne crée pas une responsabilité avec un droit de pouvoir, rien n’est écrit', async () => {
		const { base, referent } = await jeu();
		const avant = await base.select().from(responsabilite);
		const refus = creerResponsabilite(base, referent, { ...nouvelleResp, droits: ['GERER_PLANNING', 'GERER_ACCES'] }, aujourdhui);
		await expect(refus).rejects.toBeInstanceOf(RefusDroit);
		await expect(refus).rejects.toThrow(DONNER);
		expect(await base.select().from(responsabilite)).toHaveLength(avant.length);
		expect(await base.select().from(journal).where(eq(journal.action, 'creer_responsabilite'))).toHaveLength(0);
	});

	it('le référent technique n’ajoute pas un droit de pouvoir à une responsabilité existante', async () => {
		const { base, referent, resp, droitsDe } = await jeu();
		const engins = await resp('Référent engins');
		await expect(modifierResponsabilite(base, referent, engins.id, { droits: ['TRAITER_ANOMALIE', 'GERER_FICHES', 'ATTRIBUER_RESPONSABILITE'] }, aujourdhui)).rejects.toThrow(DONNER);
		expect(await droitsDe(engins.id)).toEqual(['GERER_FICHES', 'TRAITER_ANOMALIE']);
	});

	it('le référent technique ne modifie ni n’archive une responsabilité qui donne un droit de pouvoir, la sienne comprise', async () => {
		const { base, referent, resp, droitsDe } = await jeu();
		for (const nom of ['Référent technique', 'Rapporteur de comité', 'Chef de centre']) {
			const r = await resp(nom);
			const droitsAvant = await droitsDe(r.id);
			await expect(modifierResponsabilite(base, referent, r.id, { nom: `${nom} bis` }, aujourdhui)).rejects.toThrow(new RefusDroit('GERER_ACCES', { type: 'centre' }, MODIFIER));
			await expect(modifierResponsabilite(base, referent, r.id, { droits: [] }, aujourdhui)).rejects.toThrow(MODIFIER);
			await expect(archiverResponsabilite(base, referent, r.id, aujourdhui)).rejects.toThrow(MODIFIER);
			expect(await resp(nom)).toMatchObject({ nom, archiveeLe: null });
			expect(await droitsDe(r.id)).toEqual(droitsAvant);
		}
		expect(await aLeDroit(base, referent, 'GERER_LISTES', { type: 'centre' }, aujourdhui)).toBe(true);
	});

	it('le référent technique ne change ni la portée ni qui attribue d’une responsabilité qui donne un pouvoir, rien n’est écrit', async () => {
		const { base, referent, resp, comite_ } = await jeu();
		const rapporteur = await resp('Rapporteur de comité');
		const amicale = await comite_('Amicale');
		await expect(modifierResponsabilite(base, referent, rapporteur.id, { portee: 'centre', attributeur: { type: 'chef_centre' } }, aujourdhui)).rejects.toThrow(MODIFIER);
		await expect(modifierResponsabilite(base, referent, rapporteur.id, { attributeur: { type: 'comite', id: amicale.id } }, aujourdhui)).rejects.toThrow(MODIFIER);
		expect(await resp('Rapporteur de comité')).toEqual(rapporteur);
		expect(await base.select().from(journal).where(eq(journal.action, 'modifier_responsabilite'))).toHaveLength(0);
	});

	it('le chef de centre adjoint (GERER_ACCES sur le centre) ajoute un droit de pouvoir', async () => {
		const { base, donner, resp, droitsDe } = await jeu();
		const adjoint = await donner('adjoint@exemple.fr', 'Chef de centre adjoint', { type: 'centre' });
		const engins = await resp('Référent engins');
		await modifierResponsabilite(base, adjoint, engins.id, { droits: ['TRAITER_ANOMALIE', 'GERER_ACCES'] }, aujourdhui);
		expect(await droitsDe(engins.id)).toEqual(['GERER_ACCES', 'TRAITER_ANOMALIE']);
	});

	it('le chef de centre et le super administrateur donnent, retirent et archivent', async () => {
		const { base, chef, resp, droitsDe } = await jeu();
		const id = await creerResponsabilite(base, chef, { ...nouvelleResp, droits: ['GERER_ACCES'] }, aujourdhui);
		expect(await droitsDe(id)).toEqual(['GERER_ACCES']);
		const rapporteur = await resp('Rapporteur de comité');
		await modifierResponsabilite(base, chef, rapporteur.id, { droits: [] }, aujourdhui);
		expect(await droitsDe(rapporteur.id)).toEqual([]);
		await modifierResponsabilite(base, superAdmin, rapporteur.id, { droits: ['ATTRIBUER_RESPONSABILITE'] }, aujourdhui);
		await expect(archiverResponsabilite(base, chef, id, aujourdhui)).resolves.toBeUndefined();
	});
});

describe('droits de pouvoir hors du centre', () => {
	const HORS = new DonneeInvalide('Droit réservé au centre');

	it('ni à la création ni en modification : GERER_ACCES, GERER_LISTES et GERER_COMITES ne se donnent qu’avec la portée « centre », rien n’est écrit', async () => {
		const { base, chef, resp, droitsDe } = await jeu();
		for (const droit of ['GERER_ACCES', 'GERER_LISTES', 'GERER_COMITES'] as const)
			for (const portee of ['equipe', 'comite'] as const) {
				const attributeur = portee === 'comite' ? { type: 'comite_vise' as const } : { type: 'chef_centre' as const };
				await expect(creerResponsabilite(base, superAdmin, { ...nouvelleResp, nom: `Rôle ${droit} ${portee}`, portee, attributeur, droits: [droit] }, aujourdhui)).rejects.toThrow(HORS);
			}
		expect((await base.select().from(responsabilite)).map((r) => r.nom).filter((n) => n.startsWith('Rôle '))).toEqual([]);
		// Un rôle d'équipe qui reçoit le droit, un rôle du centre qui passe à l'équipe en le gardant.
		const chefEquipe = await resp('Chef de garde');
		await expect(modifierResponsabilite(base, chef, chefEquipe.id, { droits: [...(await droitsDe(chefEquipe.id)), 'GERER_ACCES'] as never }, aujourdhui)).rejects.toThrow(HORS);
		const id = await creerResponsabilite(base, chef, { ...nouvelleResp, droits: ['GERER_LISTES'] }, aujourdhui);
		await expect(modifierResponsabilite(base, chef, id, { portee: 'equipe' }, aujourdhui)).rejects.toThrow(HORS);
		expect(await resp('Référent sport')).toMatchObject({ typePerimetre: 'centre' });
		expect(await droitsDe(chefEquipe.id)).not.toContain('GERER_ACCES');
	});

	it('sans le pouvoir, le refus du pouvoir passe d’abord', async () => {
		const { base, referent, resp } = await jeu();
		const membre = await resp('Membre de comité');
		await expect(modifierResponsabilite(base, referent, membre.id, { droits: ['GERER_ACCES'] }, aujourdhui)).rejects.toBeInstanceOf(RefusDroit);
	});

	it('nommer reste possible sur une équipe ou un comité (le rapporteur nomme dans son comité)', async () => {
		const { base, chef } = await jeu();
		await expect(creerResponsabilite(base, chef, { ...nouvelleResp, nom: 'Adjoint de garde', portee: 'equipe', droits: ['ATTRIBUER_RESPONSABILITE'] }, aujourdhui)).resolves.toEqual(expect.any(Number));
		await expect(creerResponsabilite(base, chef, { ...nouvelleResp, nom: 'Secrétaire', portee: 'comite', attributeur: { type: 'comite_vise' }, droits: ['ATTRIBUER_RESPONSABILITE'] }, aujourdhui)).resolves.toEqual(expect.any(Number));
	});

	it('un rôle qui l’a déjà sur une équipe (données anciennes) reste modifiable pour le reste, sans être corrigé en silence', async () => {
		const { base, chef, resp, droitsDe } = await jeu();
		const chefEquipe = await resp('Chef de garde');
		await base.insert(responsabiliteDroit).values({ responsabiliteId: chefEquipe.id, droit: 'GERER_ACCES' });
		await modifierResponsabilite(base, chef, chefEquipe.id, { nom: 'Chef d’agrès' }, aujourdhui);
		expect(await droitsDe(chefEquipe.id)).toContain('GERER_ACCES');
	});
});

describe('listerResponsabilites', () => {
	it('décrit chaque responsabilité, ses titulaires en cours et si l’acteur peut la modifier', async () => {
		const { base, referent, chef, comite_, donner } = await jeu();
		const amicale = await comite_('Amicale');
		await donner('m1@exemple.fr', 'Membre de comité', { type: 'comite', id: amicale.id });
		await donner('m2@exemple.fr', 'Membre de comité', { type: 'comite', id: amicale.id }, '2027-01-01');
		const liste = await listerResponsabilites(base, referent, aujourdhui);
		const parNom = (nom: string) => liste.find((r) => r.nom === nom)!;
		expect(parNom('Membre de comité')).toMatchObject({ nature: 'mission', portee: 'comite', attributeur: { type: 'comite_vise' }, droits: [], systeme: null, archiveeLe: null, titulaires: 1, protegee: false });
		expect(parNom('Référent engins').attributeur).toEqual({ type: 'comite', id: (await comite_(NOM_COMITE_CENTRE)).id });
		expect(parNom('Chef de garde')).toMatchObject({ systeme: 'chef_equipe', protegee: false, droits: [{ droit: 'GERER_FICHES', verrouille: true }, { droit: 'TRAITER_ANOMALIE', verrouille: true }, { droit: 'VALIDER_REMPLACEMENT', verrouille: true }, { droit: 'VOIR_MOTIFS_ABSENCE', verrouille: true }] });
		expect(parNom('Référent technique')).toMatchObject({ attributeur: { type: 'chef_centre' }, titulaires: 1, protegee: true });
		expect(parNom('Rapporteur de comité').protegee).toBe(true);
		expect((await listerResponsabilites(base, chef, aujourdhui)).every((r) => !r.protegee)).toBe(true);
	});
});

describe('creerResponsabilite', () => {
	it('retrouve ses droits même si un nom proche existe déjà', async () => {
		const { base, chef, droitsDe } = await jeu();
		await creerResponsabilite(base, chef, { ...nouvelleResp, nom: 'Sport', droits: ['GERER_STOCK'] }, aujourdhui);
		const id = await creerResponsabilite(base, chef, { ...nouvelleResp, droits: ['GERER_PLANNING'] }, aujourdhui);
		expect(await droitsDe(id)).toEqual(['GERER_PLANNING']);
	});

	it('crée, enregistre les droits et journalise', async () => {
		const { base, referent, droitsDe } = await jeu();
		const id = await creerResponsabilite(base, referent, { ...nouvelleResp, nom: '  Référent sport  ', droits: ['GERER_PLANNING', 'GERER_PLANNING'] }, aujourdhui);
		const [lue] = await base.select().from(responsabilite).where(eq(responsabilite.id, id));
		expect(lue).toMatchObject({ nom: 'Référent sport', nature: 'mission', typePerimetre: 'centre', comiteAttributeurId: null, systeme: null, archiveeLe: null });
		expect(await droitsDe(id)).toEqual(['GERER_PLANNING']);
		const [ligne] = await base.select().from(journal).where(eq(journal.action, 'creer_responsabilite'));
		expect(ligne).toMatchObject({ cibleType: 'responsabilite', cibleId: id });
		expect(JSON.parse(ligne!.details)).toEqual({ nom: 'Référent sport', nature: 'mission', portee: 'centre', attributeur: { type: 'chef_centre' }, droits: ['GERER_PLANNING'] });
	});

	it('enregistre qui attribue', async () => {
		const { base, comite_ } = await jeu();
		const amicale = await comite_('Amicale');
		const parComite = await creerResponsabilite(base, superAdmin, { ...nouvelleResp, nom: 'A', attributeur: { type: 'comite', id: amicale.id } }, aujourdhui);
		const vise = await creerResponsabilite(base, superAdmin, { ...nouvelleResp, nom: 'B', portee: 'comite', attributeur: { type: 'comite_vise' } }, aujourdhui);
		const lignes = await base.select().from(responsabilite);
		expect(lignes.find((r) => r.id === parComite)!.comiteAttributeurId).toBe(amicale.id);
		expect(lignes.find((r) => r.id === vise)).toMatchObject({ typePerimetre: 'comite', comiteAttributeurId: null });
	});

	it('refuse un nom en double, vide ou trop long', async () => {
		const { base } = await jeu();
		await expect(creerResponsabilite(base, superAdmin, { ...nouvelleResp, nom: ' référent ENGINS ' }, aujourdhui)).rejects.toThrow(new DonneeInvalide('Nom déjà utilisé'));
		await expect(creerResponsabilite(base, superAdmin, { ...nouvelleResp, nom: '  ' }, aujourdhui)).rejects.toBeInstanceOf(DonneeInvalide);
		await expect(creerResponsabilite(base, superAdmin, { ...nouvelleResp, nom: 'a'.repeat(61) }, aujourdhui)).rejects.toBeInstanceOf(DonneeInvalide);
		await expect(creerResponsabilite(base, superAdmin, { ...nouvelleResp, nom: 'a'.repeat(60) }, aujourdhui)).resolves.toBeTypeOf('number');
	});

	it('refuse une nature, une portée ou un droit inconnus', async () => {
		const { base } = await jeu();
		await expect(creerResponsabilite(base, superAdmin, { ...nouvelleResp, nature: 'autre' as never }, aujourdhui)).rejects.toBeInstanceOf(DonneeInvalide);
		await expect(creerResponsabilite(base, superAdmin, { ...nouvelleResp, portee: 'salon' as never }, aujourdhui)).rejects.toBeInstanceOf(DonneeInvalide);
		await expect(creerResponsabilite(base, superAdmin, { ...nouvelleResp, droits: ['N_IMPORTE_QUOI' as never] }, aujourdhui)).rejects.toThrow(new DonneeInvalide('Droit inconnu'));
	});

	it('refuse le comité visé hors portée « comité », un comité attributeur inconnu ou dissous', async () => {
		const { base, comite_ } = await jeu();
		await expect(creerResponsabilite(base, superAdmin, { ...nouvelleResp, attributeur: { type: 'comite_vise' } }, aujourdhui)).rejects.toBeInstanceOf(DonneeInvalide);
		await expect(creerResponsabilite(base, superAdmin, { ...nouvelleResp, attributeur: { type: 'comite', id: 999 } }, aujourdhui)).rejects.toThrow(new DonneeInvalide('Comité inconnu'));
		const amicale = await comite_('Amicale');
		await dissoudreComite(base, superAdmin, amicale.id, aujourdhui);
		await expect(creerResponsabilite(base, superAdmin, { ...nouvelleResp, attributeur: { type: 'comite', id: amicale.id } }, aujourdhui)).rejects.toThrow(new DonneeInvalide('Comité dissous'));
	});

	it('refuse le chef de centre comme attributeur d’une portée « comité » (le comité visé l’attribuerait)', async () => {
		const { base } = await jeu();
		await expect(creerResponsabilite(base, superAdmin, { ...nouvelleResp, portee: 'comite' }, aujourdhui)).rejects.toBeInstanceOf(DonneeInvalide);
	});
});

describe('modifierResponsabilite', () => {
	it('modifie les champs et journalise leurs noms, avec les droits avant et après', async () => {
		const { base, referent, resp, comite_, droitsDe } = await jeu();
		const engins = await resp('Référent engins');
		const amicale = await comite_('Amicale');
		await modifierResponsabilite(base, referent, engins.id, { nom: 'Référent véhicules', nature: 'fonction', attributeur: { type: 'comite', id: amicale.id }, droits: ['GERER_FICHES', 'GERER_STOCK'] }, aujourdhui);
		expect(await resp('Référent véhicules')).toMatchObject({ nature: 'fonction', comiteAttributeurId: amicale.id });
		expect(await droitsDe(engins.id)).toEqual(['GERER_FICHES', 'GERER_STOCK']);
		const [ligne] = await base.select().from(journal).where(eq(journal.action, 'modifier_responsabilite'));
		expect(ligne).toMatchObject({ cibleType: 'responsabilite', cibleId: engins.id });
		expect(JSON.parse(ligne!.details)).toEqual({ champs: ['nom', 'nature', 'attributeur', 'droits'], droits: { avant: ['GERER_FICHES', 'TRAITER_ANOMALIE'], apres: ['GERER_FICHES', 'GERER_STOCK'] } });
	});

	it('n’écrit rien si rien ne change', async () => {
		const { base, resp } = await jeu();
		const engins = await resp('Référent engins');
		await modifierResponsabilite(base, superAdmin, engins.id, { nom: 'Référent engins', droits: ['GERER_FICHES', 'TRAITER_ANOMALIE'] }, aujourdhui);
		expect(await base.select().from(journal).where(eq(journal.action, 'modifier_responsabilite'))).toHaveLength(0);
	});

	it('garde son propre nom en changeant la casse, refuse celui d’une autre', async () => {
		const { base, resp } = await jeu();
		const engins = await resp('Référent engins');
		await expect(modifierResponsabilite(base, superAdmin, engins.id, { nom: 'Référent pharmacie' }, aujourdhui)).rejects.toThrow(new DonneeInvalide('Nom déjà utilisé'));
		await expect(modifierResponsabilite(base, superAdmin, engins.id, { nom: 'RÉFÉRENT ENGINS' }, aujourdhui)).resolves.toBeUndefined();
	});

	it('ne retire jamais un droit verrouillé, même pour le super administrateur', async () => {
		const { base, resp, droitsDe } = await jeu();
		const chefEquipe = await resp('Chef de garde');
		await expect(modifierResponsabilite(base, superAdmin, chefEquipe.id, { droits: ['VALIDER_REMPLACEMENT'] }, aujourdhui)).rejects.toThrow(new DonneeInvalide('Droit verrouillé : impossible de le retirer'));
		expect(await droitsDe(chefEquipe.id)).toEqual(['GERER_FICHES', 'TRAITER_ANOMALIE', 'VALIDER_REMPLACEMENT', 'VOIR_MOTIFS_ABSENCE']);
		await modifierResponsabilite(base, superAdmin, chefEquipe.id, { droits: ['VALIDER_REMPLACEMENT', 'VOIR_MOTIFS_ABSENCE', 'TRAITER_ANOMALIE', 'GERER_FICHES', 'GERER_PLANNING'] }, aujourdhui);
		const lignes = await base.select().from(responsabiliteDroit).where(eq(responsabiliteDroit.responsabiliteId, chefEquipe.id));
		expect(lignes.map((l) => [l.droit, l.verrouille]).sort()).toEqual([['GERER_FICHES', 1], ['GERER_PLANNING', 0], ['TRAITER_ANOMALIE', 1], ['VALIDER_REMPLACEMENT', 1], ['VOIR_MOTIFS_ABSENCE', 1]]);
	});

	it('ne change pas la portée tant qu’une attribution est en cours ou à venir', async () => {
		const { base, resp, donner } = await jeu();
		const engins = await resp('Référent engins');
		await donner('e1@exemple.fr', 'Référent engins', { type: 'centre' }, '2027-01-01');
		const refus = new DonneeInvalide('Portée verrouillée : la responsabilité est tenue');
		await expect(modifierResponsabilite(base, superAdmin, engins.id, { portee: 'equipe' }, aujourdhui)).rejects.toThrow(refus);
		const pharmacie = await resp('Référent pharmacie');
		await donner('p1@exemple.fr', 'Référent pharmacie', { type: 'centre' });
		await expect(modifierResponsabilite(base, superAdmin, pharmacie.id, { portee: 'equipe' }, aujourdhui)).rejects.toThrow(refus);
		// Une attribution passée ne bloque pas.
		const [ancienne] = await base.insert(responsabilite).values({ nom: 'Ancienne', nature: 'mission', typePerimetre: 'centre' }).returning();
		const p = await (async () => (await base.select().from(personne).limit(1))[0]!.id)();
		await base.insert(attribution).values({ personneId: p, responsabiliteId: ancienne!.id, perimetreType: 'centre', debut: '2025-01-01', fin: '2025-12-31', saisiePar: 'x', saisieLe: '2025-01-01' });
		await modifierResponsabilite(base, superAdmin, ancienne!.id, { portee: 'equipe' }, aujourdhui);
		expect((await resp('Ancienne')).typePerimetre).toBe('equipe');
	});

	it('vérifie qui attribue avec la portée finale', async () => {
		const { base, resp, comite_ } = await jeu();
		const membre = await resp('Membre de comité');
		// Portée « comité » attribuée par le comité visé : passer au centre sans dire qui attribue est refusé.
		await expect(modifierResponsabilite(base, superAdmin, membre.id, { portee: 'centre' }, aujourdhui)).rejects.toBeInstanceOf(DonneeInvalide);
		await modifierResponsabilite(base, superAdmin, membre.id, { portee: 'centre', attributeur: { type: 'chef_centre' } }, aujourdhui);
		expect(await resp('Membre de comité')).toMatchObject({ typePerimetre: 'centre', comiteAttributeurId: null });
		const amicale = await comite_('Amicale');
		await dissoudreComite(base, superAdmin, amicale.id, aujourdhui);
		await expect(modifierResponsabilite(base, superAdmin, membre.id, { attributeur: { type: 'comite', id: amicale.id } }, aujourdhui)).rejects.toThrow(new DonneeInvalide('Comité dissous'));
		await expect(modifierResponsabilite(base, superAdmin, membre.id, { attributeur: { type: 'comite', id: 999 } }, aujourdhui)).rejects.toThrow(new DonneeInvalide('Comité inconnu'));
	});

	it('ne change pas la portée d’une responsabilité système', async () => {
		const { base, resp } = await jeu();
		const chefEquipe = await resp('Chef de garde');
		await expect(modifierResponsabilite(base, superAdmin, chefEquipe.id, { portee: 'centre', attributeur: { type: 'chef_centre' } }, aujourdhui)).rejects.toBeInstanceOf(DonneeInvalide);
	});

	it('refuse une responsabilité inconnue, archivée ou un droit inconnu', async () => {
		const { base, resp } = await jeu();
		await expect(modifierResponsabilite(base, superAdmin, 999, { nom: 'X' }, aujourdhui)).rejects.toThrow(new DonneeInvalide('Responsabilité inconnue'));
		const engins = await resp('Référent engins');
		await expect(modifierResponsabilite(base, superAdmin, engins.id, { droits: ['GERER_FICHES', 'N_IMPORTE_QUOI' as never] }, aujourdhui)).rejects.toThrow(new DonneeInvalide('Droit inconnu'));
		await archiverResponsabilite(base, superAdmin, engins.id, aujourdhui);
		await expect(modifierResponsabilite(base, superAdmin, engins.id, { nom: 'X' }, aujourdhui)).rejects.toThrow(new DonneeInvalide('Responsabilité archivée'));
	});
});

describe('archiverResponsabilite', () => {
	it('arrête les attributions dès aujourd’hui, supprime celles à venir, journalise', async () => {
		const { base, referent, resp, donner } = await jeu();
		const engins = await resp('Référent engins');
		const titulaire = await donner('t@exemple.fr', 'Référent engins', { type: 'centre' });
		await donner('jour@exemple.fr', 'Référent engins', { type: 'centre' }, aujourdhui);
		await donner('futur@exemple.fr', 'Référent engins', { type: 'centre' }, '2027-01-01');
		const ailleurs = await donner('pharma@exemple.fr', 'Référent pharmacie', { type: 'centre' });
		expect(await aLeDroit(base, titulaire, 'TRAITER_ANOMALIE', { type: 'centre' }, aujourdhui)).toBe(true);

		await archiverResponsabilite(base, referent, engins.id, aujourdhui);

		expect(await aLeDroit(base, titulaire, 'TRAITER_ANOMALIE', { type: 'centre' }, aujourdhui)).toBe(false);
		expect(await aLeDroit(base, ailleurs, 'GERER_STOCK', { type: 'centre' }, aujourdhui)).toBe(true);
		const restantes = await base.select().from(attribution).where(eq(attribution.responsabiliteId, engins.id));
		expect(restantes.map((a) => [a.personneId, a.fin])).toEqual([[(titulaire as { id: number }).id, '2026-10-24']]);
		expect((await resp('Référent engins')).archiveeLe).toBe(aujourdhui);
		const [ligne] = await base.select().from(journal).where(eq(journal.action, 'archiver_responsabilite'));
		expect(ligne).toMatchObject({ cibleType: 'responsabilite', cibleId: engins.id });
		expect(JSON.parse(ligne!.details)).toEqual({ attributionsClose: 3 });
	});

	it('refuse une responsabilité système, inconnue ou déjà archivée', async () => {
		const { base, resp } = await jeu();
		for (const nom of ['Chef de centre', 'Chef de centre adjoint', 'Chef de garde']) {
			await expect(archiverResponsabilite(base, superAdmin, (await resp(nom)).id, aujourdhui)).rejects.toThrow(new DonneeInvalide('Une responsabilité système ne s’archive pas'));
		}
		await expect(archiverResponsabilite(base, superAdmin, 999, aujourdhui)).rejects.toThrow(new DonneeInvalide('Responsabilité inconnue'));
		const engins = await resp('Référent engins');
		await archiverResponsabilite(base, superAdmin, engins.id, aujourdhui);
		await expect(archiverResponsabilite(base, superAdmin, engins.id, aujourdhui)).rejects.toThrow(new DonneeInvalide('Responsabilité déjà archivée'));
	});
});

describe('attribuer après archivage ou dissolution', () => {
	it('refuse une responsabilité archivée et un comité dissous', async () => {
		const { base, resp, comite_, nouvelle } = await jeu();
		const cible = await nouvelle('cible@exemple.fr');
		const engins = await resp('Référent engins');
		await archiverResponsabilite(base, superAdmin, engins.id, aujourdhui);
		await expect(attribuer(base, superAdmin, { personneId: cible, responsabiliteId: engins.id, perimetre: { type: 'centre' }, debut: aujourdhui }, aujourdhui)).rejects.toThrow(new DonneeInvalide('Responsabilité archivée'));
		const amicale = await comite_('Amicale');
		await dissoudreComite(base, superAdmin, amicale.id, aujourdhui);
		const membre = await resp('Membre de comité');
		await expect(attribuer(base, superAdmin, { personneId: cible, responsabiliteId: membre.id, perimetre: { type: 'comite', id: amicale.id }, debut: aujourdhui }, aujourdhui)).rejects.toThrow(new DonneeInvalide('Comité dissous'));
	});
});

describe('modèles et icônes', () => {
	it('crée depuis un modèle : garde le modèle, prend son icône par défaut, journalise', async () => {
		const { base, chef } = await jeu();
		const id = await creerResponsabilite(base, chef, { ...nouvelleResp, nom: 'Référent matériel', droits: ['TRAITER_ANOMALIE', 'GERER_FICHES'], modele: 'referent_materiel' }, aujourdhui);
		const [lue] = await base.select().from(responsabilite).where(eq(responsabilite.id, id));
		expect(lue).toMatchObject({ modele: 'referent_materiel', icone: 'camion' });
		const [ligne] = await base.select().from(journal).where(eq(journal.action, 'creer_responsabilite'));
		expect(JSON.parse(ligne!.details)).toMatchObject({ modele: 'referent_materiel', icone: 'camion' });
		expect((await listerResponsabilites(base, chef, aujourdhui)).find((r) => r.id === id)).toMatchObject({ modele: 'referent_materiel', icone: 'camion' });
	});

	it('garde l’icône choisie ; sans modèle ni icône, les deux sont nuls', async () => {
		const { base, chef } = await jeu();
		const avec = await creerResponsabilite(base, chef, { ...nouvelleResp, nom: 'A', modele: 'vierge', icone: 'ballon' }, aujourdhui);
		const sans = await creerResponsabilite(base, chef, { ...nouvelleResp, nom: 'B' }, aujourdhui);
		const lignes = await base.select().from(responsabilite);
		expect(lignes.find((r) => r.id === avec)).toMatchObject({ modele: 'vierge', icone: 'ballon' });
		expect(lignes.find((r) => r.id === sans)).toMatchObject({ modele: null, icone: null });
	});

	it('refuse un modèle ou une icône inconnus, rien n’est écrit', async () => {
		const { base, chef } = await jeu();
		const avant = (await base.select().from(responsabilite)).length;
		await expect(creerResponsabilite(base, chef, { ...nouvelleResp, modele: 'pompier_volant' }, aujourdhui)).rejects.toThrow(new DonneeInvalide('Modèle inconnu'));
		await expect(creerResponsabilite(base, chef, { ...nouvelleResp, icone: 'licorne' }, aujourdhui)).rejects.toThrow(new DonneeInvalide('Icône inconnue'));
		expect(await base.select().from(responsabilite)).toHaveLength(avant);
	});

	it('modifie l’icône, journalise, refuse une icône inconnue', async () => {
		const { base, chef, resp } = await jeu();
		const engins = await resp('Référent engins');
		await modifierResponsabilite(base, chef, engins.id, { icone: 'camion' }, aujourdhui);
		expect((await resp('Référent engins')).icone).toBe('camion');
		const [ligne] = await base.select().from(journal).where(eq(journal.action, 'modifier_responsabilite'));
		expect(JSON.parse(ligne!.details)).toEqual({ champs: ['icone'] });
		await expect(modifierResponsabilite(base, chef, engins.id, { icone: 'licorne' }, aujourdhui)).rejects.toThrow(new DonneeInvalide('Icône inconnue'));
	});

	it('refuse au référent technique un modèle qui porte un droit de pouvoir (rapporteur), rien d’écrit', async () => {
		const { base, referent } = await jeu();
		const avant = (await base.select().from(responsabilite)).length;
		await expect(
			creerResponsabilite(base, referent, { nom: 'Rapporteur bis', nature: 'mission', portee: 'comite', attributeur: { type: 'comite_vise' }, droits: ['ATTRIBUER_RESPONSABILITE'], modele: 'rapporteur_comite' }, aujourdhui)
		).rejects.toBeInstanceOf(RefusDroit);
		expect(await base.select().from(responsabilite)).toHaveLength(avant);
	});

	it('les responsabilités du jeu de départ n’ont ni icône ni modèle, sauf le référent habillement (son modèle)', async () => {
		const { base, chef } = await jeu();
		const liste = await listerResponsabilites(base, chef, aujourdhui);
		expect(liste.every((r) => r.icone === null)).toBe(true);
		expect(liste.filter((r) => r.modele !== null).map((r) => [r.nom, r.modele])).toEqual([['Référent habillement', 'referent_habillement']]);
	});
});
