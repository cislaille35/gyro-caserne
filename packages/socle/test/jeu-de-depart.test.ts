import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import centreExemple from '../../../centres/exemple/centre.ts';
import { attribuer } from '../src/actions/attributions.ts';
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

	it('crée les profils, comités, responsabilités et grades', async () => {
		const base = await baseDeTest();
		await chargerJeuDeDepart(base, centreExemple);
		expect((await base.select().from(profil)).map((p) => [p.nom, p.typePersonne])).toEqual([
			['Agent', 'agent'],
			['Réserve citoyenne', 'exterieur']
		]);
		expect(await base.select().from(profilDroit)).toHaveLength(10);
		expect((await base.select().from(comite)).map((c) => [c.nom, c.theme])).toEqual([
			['Comité du centre', 'centre'],
			['Amicale', 'amicale']
		]);
		expect((await base.select().from(grade).orderBy(grade.ordre)).map((g) => g.code)).toEqual(['JSP', 'Sap', 'Cap', 'Cch', 'Sgt', 'Sch', 'Adj', 'Adc', 'Ltn', 'Cne', 'Cdt']);
		const [chef] = await base.select().from(responsabilite).where(eq(responsabilite.systeme, 'chef_centre'));
		const droitsChef = await base.select().from(responsabiliteDroit).where(eq(responsabiliteDroit.responsabiliteId, chef!.id));
		expect(droitsChef).toHaveLength(9);
		expect(droitsChef.every((d) => d.verrouille === 1)).toBe(true);
		const [comiteCentre] = await base.select().from(comite).where(eq(comite.nom, 'Comité du centre'));
		const [chefEquipe] = await base.select().from(responsabilite).where(eq(responsabilite.systeme, 'chef_equipe'));
		expect(chefEquipe).toMatchObject({ typePerimetre: 'equipe', comiteAttributeurId: comiteCentre!.id });
		expect(await base.select().from(responsabilite)).toHaveLength(6);
	});

	it('ne crée rien en double au second chargement', async () => {
		const base = await baseDeTest();
		await chargerJeuDeDepart(base, centreExemple);
		await chargerJeuDeDepart(base, centreExemple);
		expect(await base.select().from(equipe)).toHaveLength(3);
		expect(await base.select().from(profil)).toHaveLength(2);
		expect(await base.select().from(comite)).toHaveLength(2);
		expect(await base.select().from(responsabilite)).toHaveLength(6);
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
});
