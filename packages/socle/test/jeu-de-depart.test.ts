import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import centreExemple from '../../../centres/exemple/centre.ts';
import { attribuer } from '../src/actions/attributions.ts';
import { changerStatut } from '../src/actions/personnes.ts';
import { aLeDroit, type Acteur } from '../src/droits.ts';
import { chargerJeuDeDepart } from '../src/jeu-de-depart.ts';
import { comite, equipe, grade, personne, profil, profilDroit, responsabilite, responsabiliteDroit } from '../src/schema.ts';
import { baseDeTest } from './base-de-test.ts';

const aujourdhui = '2026-10-25';
const superAdmin: Acteur = { type: 'super', email: 'admin@exemple.fr' };

describe('chargerJeuDeDepart', () => {
	it('crée les équipes du centre', async () => {
		const base = await baseDeTest();
		await chargerJeuDeDepart(base, centreExemple);
		const equipes = await base.select().from(equipe).orderBy(equipe.ordreRotation);
		expect(equipes.map((e) => [e.nom, e.couleur, e.ordreRotation])).toEqual([
			['Équipe 1', '#d4a017', 1],
			['Équipe 2', '#c2185b', 2],
			['Équipe 3', '#1565c0', 3]
		]);
	});

	it('crée les profils et leurs droits', async () => {
		const base = await baseDeTest();
		await chargerJeuDeDepart(base, centreExemple);
		const profils = await base.select().from(profil).orderBy(profil.id);
		expect(profils.map((p) => [p.nom, p.typePersonne])).toEqual([
			['Agent', 'agent'],
			['Réserve citoyenne', 'exterieur']
		]);
		const droits = await base.select().from(profilDroit);
		expect(droits.every((d) => d.profilId === profils[0]!.id && d.perimetreType === 'centre' && d.perimetreId === null)).toBe(true);
		expect(droits.map((d) => d.droit).sort()).toEqual(
			['VOIR_PLANNING', 'VOIR_ANNUAIRE', 'VOIR_ENGINS', 'VOIR_ANOMALIES', 'SIGNALER_ANOMALIE', 'SIGNALER_BESOIN_STOCK', 'DEMANDER_REMPLACEMENT', 'DECLARER_DISPONIBILITE', 'UTILISER_MESSAGERIE', 'PRENDRE_EN_CHARGE_ANOMALIE'].sort()
		);
	});

	it('crée les comités et les grades', async () => {
		const base = await baseDeTest();
		await chargerJeuDeDepart(base, centreExemple);
		expect((await base.select().from(comite).orderBy(comite.id)).map((c) => [c.nom, c.theme])).toEqual([
			['Comité du centre', 'centre'],
			['Amicale', 'amicale']
		]);
		expect((await base.select().from(grade).orderBy(grade.ordre)).map((g) => [g.code, g.libelle])).toEqual([
			['JSP', 'Jeune sapeur-pompier'],
			['Sap', 'Sapeur'],
			['Cap', 'Caporal'],
			['Cch', 'Caporal-chef'],
			['Sgt', 'Sergent'],
			['Sch', 'Sergent-chef'],
			['Adj', 'Adjudant'],
			['Adc', 'Adjudant-chef'],
			['Ltn', 'Lieutenant'],
			['Cne', 'Capitaine'],
			['Cdt', 'Commandant']
		]);
	});

	it('crée les responsabilités avec leur nature, leur périmètre et leurs droits', async () => {
		const base = await baseDeTest();
		await chargerJeuDeDepart(base, centreExemple);
		const [comiteCentre] = await base.select().from(comite).where(eq(comite.nom, 'Comité du centre'));
		const idCentre = comiteCentre!.id;
		const droitsChefCentre: [string, number][] = [['GERER_LISTES', 1], ['GERER_ACCES', 1], ['GERER_COMITES', 1], ['GERER_PLANNING', 1], ['ATTRIBUER_RESPONSABILITE', 1], ['TRAITER_ANOMALIE', 1], ['GERER_FICHES', 1], ['GERER_STOCK', 1], ['MODERER_MESSAGERIE', 1]];
		const attendu: [string, string, string | null, string, number | null, [string, number][]][] = [
			['Chef de centre', 'fonction', 'chef_centre', 'centre', null, droitsChefCentre],
			['Chef de centre adjoint', 'fonction', 'chef_centre_adjoint', 'centre', null, droitsChefCentre],
			['Chef d’équipe', 'fonction', 'chef_equipe', 'equipe', idCentre, [['VALIDER_REMPLACEMENT', 1], ['VOIR_MOTIFS_ABSENCE', 1]]],
			['Membre de comité', 'mission', null, 'comite', null, []],
			['Rapporteur de comité', 'mission', null, 'comite', null, [['ATTRIBUER_RESPONSABILITE', 0]]],
			['Référent engins', 'mission', null, 'centre', idCentre, [['TRAITER_ANOMALIE', 0], ['GERER_FICHES', 0]]],
			['Référent pharmacie', 'mission', null, 'centre', idCentre, [['GERER_STOCK', 0]]],
			['Référent technique', 'fonction', null, 'centre', null, [['GERER_LISTES', 0], ['GERER_COMITES', 0]]]
		];
		const responsabilites = await base.select().from(responsabilite).orderBy(responsabilite.id);
		expect(responsabilites.map((r) => [r.nom, r.nature, r.systeme, r.typePerimetre, r.comiteAttributeurId])).toEqual(attendu.map(([nom, nature, systeme, perimetre, attributeur]) => [nom, nature, systeme, perimetre, attributeur]));
		for (const r of responsabilites) {
			const lignes = await base.select().from(responsabiliteDroit).where(eq(responsabiliteDroit.responsabiliteId, r.id));
			const voulu = attendu.find((a) => a[0] === r.nom)![5];
			expect(lignes.map((l) => [l.droit, l.verrouille]).sort()).toEqual([...voulu].sort());
		}
	});

	it('ne crée rien en double au second chargement', async () => {
		const base = await baseDeTest();
		await chargerJeuDeDepart(base, centreExemple);
		await chargerJeuDeDepart(base, centreExemple);
		expect(await base.select().from(equipe)).toHaveLength(3);
		expect(await base.select().from(profil)).toHaveLength(2);
		expect(await base.select().from(comite)).toHaveLength(2);
		expect(await base.select().from(responsabilite)).toHaveLength(8);
		expect(await base.select().from(grade)).toHaveLength(11);
	});

	it('le chef de centre peut nommer le rapporteur de l’amicale', async () => {
		const base = await baseDeTest();
		await chargerJeuDeDepart(base, centreExemple);
		const [agent] = await base.select().from(profil).where(eq(profil.nom, 'Agent'));
		const nouvelle = async (email: string) => (await base.insert(personne).values({ email, prenom: 'P', nom: 'N', profilId: agent!.id }).returning())[0]!.id;
		const chef = await nouvelle('chef@exemple.fr');
		const rapporteur = await nouvelle('rapporteur@exemple.fr');
		const [respChef] = await base.select().from(responsabilite).where(eq(responsabilite.systeme, 'chef_centre'));
		const [respRapporteur] = await base.select().from(responsabilite).where(eq(responsabilite.nom, 'Rapporteur de comité'));
		const [amicale] = await base.select().from(comite).where(eq(comite.nom, 'Amicale'));
		await attribuer(base, superAdmin, { personneId: chef, responsabiliteId: respChef!.id, perimetre: { type: 'centre' }, debut: '2026-01-01' }, aujourdhui);

		const acteur: Acteur = { type: 'personne', id: chef };
		const perimetre = { type: 'comite' as const, id: amicale!.id };
		await attribuer(base, acteur, { personneId: rapporteur, responsabiliteId: respRapporteur!.id, perimetre, debut: aujourdhui }, aujourdhui);
		expect(await aLeDroit(base, { type: 'personne', id: rapporteur }, 'ATTRIBUER_RESPONSABILITE', perimetre, aujourdhui)).toBe(true);
	});

	it('le chef de centre nomme son adjoint, qui peut lever une suspension', async () => {
		const base = await baseDeTest();
		await chargerJeuDeDepart(base, centreExemple);
		const [agent] = await base.select().from(profil).where(eq(profil.nom, 'Agent'));
		const nouvelle = async (email: string) => (await base.insert(personne).values({ email, prenom: 'P', nom: 'N', profilId: agent!.id }).returning())[0]!.id;
		const chef = await nouvelle('chef@exemple.fr');
		const adjoint = await nouvelle('adjoint@exemple.fr');
		const suspendu = await nouvelle('suspendu@exemple.fr');
		const [respChef] = await base.select().from(responsabilite).where(eq(responsabilite.systeme, 'chef_centre'));
		const [respAdjoint] = await base.select().from(responsabilite).where(eq(responsabilite.nom, 'Chef de centre adjoint'));
		await attribuer(base, superAdmin, { personneId: chef, responsabiliteId: respChef!.id, perimetre: { type: 'centre' }, debut: '2026-01-01' }, aujourdhui);
		await attribuer(base, { type: 'personne', id: chef }, { personneId: adjoint, responsabiliteId: respAdjoint!.id, perimetre: { type: 'centre' }, debut: '2026-01-01' }, aujourdhui);

		await changerStatut(base, superAdmin, suspendu, 'suspendu', aujourdhui);
		await changerStatut(base, { type: 'personne', id: adjoint }, suspendu, 'operationnel', aujourdhui);
		const [fiche] = await base.select().from(personne).where(eq(personne.id, suspendu));
		expect(fiche!.statut).toBe('operationnel');
	});
});
