import { sql } from 'drizzle-orm';
import type { Centre } from '@gyro-caserne/centre';
import type { Base } from './base.ts';
import type { Droit } from './listes.ts';
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

const GRADES = ['JSP', 'Sap', 'Cap', 'Cch', 'Sgt', 'Sch', 'Adj', 'Adc', 'Ltn', 'Cne', 'Cdt'];

const NOM_COMITE_CENTRE = 'Comité du centre';

type Droits = { droits: Droit[]; verrouilles: boolean };

const RESPONSABILITES: {
	nom: string;
	systeme?: 'chef_centre' | 'chef_equipe';
	typePerimetre: 'centre' | 'equipe' | 'comite';
	attribueeParComiteCentre: boolean;
	droits: Droits;
}[] = [
	{
		nom: 'Chef de centre',
		systeme: 'chef_centre',
		typePerimetre: 'centre',
		attribueeParComiteCentre: false,
		droits: { verrouilles: true, droits: ['GERER_LISTES', 'GERER_ACCES', 'GERER_COMITES', 'GERER_PLANNING', 'ATTRIBUER_RESPONSABILITE', 'TRAITER_ANOMALIE', 'GERER_FICHES', 'GERER_STOCK', 'MODERER_MESSAGERIE'] }
	},
	{ nom: 'Chef d’équipe', systeme: 'chef_equipe', typePerimetre: 'equipe', attribueeParComiteCentre: true, droits: { verrouilles: true, droits: ['VALIDER_REMPLACEMENT', 'VOIR_MOTIFS_ABSENCE'] } },
	{ nom: 'Membre de comité', typePerimetre: 'comite', attribueeParComiteCentre: false, droits: { verrouilles: false, droits: [] } },
	{ nom: 'Rapporteur de comité', typePerimetre: 'comite', attribueeParComiteCentre: false, droits: { verrouilles: false, droits: ['ATTRIBUER_RESPONSABILITE'] } },
	{ nom: 'Référent engins', typePerimetre: 'centre', attribueeParComiteCentre: true, droits: { verrouilles: false, droits: ['TRAITER_ANOMALIE', 'GERER_FICHES'] } },
	{ nom: 'Référent pharmacie', typePerimetre: 'centre', attribueeParComiteCentre: true, droits: { verrouilles: false, droits: ['GERER_STOCK'] } }
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
				nature: 'fonction' as const,
				typePerimetre: r.typePerimetre,
				systeme: r.systeme ?? null,
				comiteAttributeurId: r.attribueeParComiteCentre ? idComiteCentre : null
			}))
		),
		base.insert(responsabiliteDroit).values(
			RESPONSABILITES.flatMap((r) => r.droits.droits.map((droit) => ({ responsabiliteId: idResponsabilite(r.nom), droit, verrouille: r.droits.verrouilles ? 1 : 0 })))
		),
		...(centre.equipes.length > 0 ? [base.insert(equipe).values(centre.equipes.map((e) => ({ nom: e.nom, couleur: e.couleur, ordreRotation: e.numero })))] : []),
		base.insert(grade).values(GRADES.map((code, i) => ({ code, libelle: code, ordre: i + 1 })))
	]);
}
