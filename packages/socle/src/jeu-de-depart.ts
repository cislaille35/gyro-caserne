import { sql } from 'drizzle-orm';
import type { Centre } from '@gyro-caserne/centre';
import type { Base } from './base.ts';
import type { Droit, ResponsabiliteSysteme } from './listes.ts';
import { comite, equipe, grade, profil, profilDroit, responsabilite, responsabiliteDroit } from './schema.ts';

const DROITS_AGENT: Droit[] = [
	'VOIR_PLANNING',
	'VOIR_ANNUAIRE',
	'VOIR_ENGINS',
	'VOIR_ANOMALIES',
	'SIGNALER_ANOMALIE',
	'SIGNALER_BESOIN_STOCK',
	'DEMANDER_REMPLACEMENT',
	'DECLARER_DISPONIBILITE',
	'UTILISER_MESSAGERIE',
	'PRENDRE_EN_CHARGE_ANOMALIE'
];

const GRADES = [
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
] as const;

const NOM_COMITE_CENTRE = 'Comité du centre';

const DROITS_CHEF_CENTRE: Droit[] = ['GERER_LISTES', 'GERER_ACCES', 'GERER_COMITES', 'GERER_PLANNING', 'ATTRIBUER_RESPONSABILITE', 'TRAITER_ANOMALIE', 'GERER_FICHES', 'GERER_STOCK', 'MODERER_MESSAGERIE'];

const RESPONSABILITES: {
	nom: string;
	nature: 'fonction' | 'mission';
	systeme?: ResponsabiliteSysteme;
	typePerimetre: 'centre' | 'equipe' | 'comite';
	parComiteCentre: boolean;
	verrouilles: boolean;
	droits: Droit[];
}[] = [
	{
		nom: 'Chef de centre',
		nature: 'fonction',
		systeme: 'chef_centre',
		typePerimetre: 'centre',
		parComiteCentre: false,
		verrouilles: true,
		droits: DROITS_CHEF_CENTRE
	},
	// Nommé par le chef de centre ; mêmes droits.
	{ nom: 'Chef de centre adjoint', nature: 'fonction', systeme: 'chef_centre_adjoint', typePerimetre: 'centre', parComiteCentre: false, verrouilles: true, droits: DROITS_CHEF_CENTRE },
	{ nom: 'Chef d’équipe', nature: 'fonction', systeme: 'chef_equipe', typePerimetre: 'equipe', parComiteCentre: true, verrouilles: true, droits: ['VALIDER_REMPLACEMENT', 'VOIR_MOTIFS_ABSENCE'] },
	{ nom: 'Membre de comité', nature: 'mission', typePerimetre: 'comite', parComiteCentre: false, verrouilles: false, droits: [] },
	{ nom: 'Rapporteur de comité', nature: 'mission', typePerimetre: 'comite', parComiteCentre: false, verrouilles: false, droits: ['ATTRIBUER_RESPONSABILITE'] },
	{ nom: 'Référent engins', nature: 'mission', typePerimetre: 'centre', parComiteCentre: true, verrouilles: false, droits: ['TRAITER_ANOMALIE', 'GERER_FICHES'] },
	{ nom: 'Référent pharmacie', nature: 'mission', typePerimetre: 'centre', parComiteCentre: true, verrouilles: false, droits: ['GERER_STOCK'] },
	// Attribué par le chef de centre. La migration 0001 l'ajoute aux bases déjà remplies.
	{ nom: 'Référent technique', nature: 'fonction', typePerimetre: 'centre', parComiteCentre: false, verrouilles: false, droits: ['GERER_LISTES', 'GERER_COMITES'] }
];

// Ne fait rien si un profil existe déjà ; sinon écrit tout d'un bloc.
export async function chargerJeuDeDepart(base: Base, centre: Centre): Promise<void> {
	const [existant] = await base.select({ id: profil.id }).from(profil).limit(1);
	if (existant) return;

	// Les identifiants ne sont pas connus d'avance : on les retrouve par le nom.
	const idComiteCentre = sql`(SELECT ${comite.id} FROM ${comite} WHERE ${comite.nom} = ${NOM_COMITE_CENTRE})`;
	const idProfil = (nom: string) => sql<number>`(SELECT ${profil.id} FROM ${profil} WHERE ${profil.nom} = ${nom})`;
	const idResponsabilite = (nom: string) => sql<number>`(SELECT ${responsabilite.id} FROM ${responsabilite} WHERE ${responsabilite.nom} = ${nom})`;

	await base.batch([
		base.insert(profil).values([
			{ nom: 'Agent', typePersonne: 'agent' },
			{ nom: 'Réserve citoyenne', typePersonne: 'exterieur' }
		]),
		base.insert(profilDroit).values(DROITS_AGENT.map((droit) => ({ profilId: idProfil('Agent'), droit, perimetreType: 'centre' as const, perimetreId: null }))),
		base.insert(comite).values([
			{ nom: NOM_COMITE_CENTRE, theme: 'centre' },
			{ nom: 'Amicale', theme: 'amicale' }
		]),
		base.insert(responsabilite).values(
			RESPONSABILITES.map((r) => ({
				nom: r.nom,
				nature: r.nature,
				typePerimetre: r.typePerimetre,
				systeme: r.systeme ?? null,
				comiteAttributeurId: r.parComiteCentre ? idComiteCentre : null
			}))
		),
		base.insert(responsabiliteDroit).values(
			RESPONSABILITES.flatMap((r) => r.droits.map((droit) => ({ responsabiliteId: idResponsabilite(r.nom), droit, verrouille: r.verrouilles ? 1 : 0 })))
		),
		...(centre.equipes.length > 0 ? [base.insert(equipe).values(centre.equipes.map((e) => ({ nom: e.nom, couleur: e.couleur, ordreRotation: e.numero })))] : []),
		base.insert(grade).values(GRADES.map(([code, libelle], i) => ({ code, libelle, ordre: i + 1 })))
	]);
}
