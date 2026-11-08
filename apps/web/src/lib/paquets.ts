import { estSansEffet, MODELES, type Droit } from '@gyro-caserne/socle';

export type DomaineId = 'planning' | 'engins' | 'stock' | 'habillement' | 'reservations' | 'messagerie';
export type Niveau = { libelle: string; droits: Droit[]; phrase: string };
export type Domaine = { id: DomaineId; nom: string; niveaux: Niveau[] };

// Les paquets sont fixés par l'appli. Niveaux cumulatifs : chacun contient les droits des précédents.
export const DOMAINES: Domaine[] = [
	{
		id: 'planning',
		nom: 'Planning et gardes',
		niveaux: [
			{ libelle: 'Rien de plus', droits: [], phrase: 'Comme tout agent : il voit le planning et demande un remplacement.' },
			{ libelle: 'Valider les remplacements', droits: ['VALIDER_REMPLACEMENT'], phrase: 'Valide aussi les remplacements.' },
			{ libelle: 'Gérer le planning', droits: ['VALIDER_REMPLACEMENT', 'GERER_PLANNING'], phrase: 'Valide les remplacements et gère le planning.' }
		]
	},
	{
		id: 'engins',
		nom: 'Engins et anomalies',
		niveaux: [
			{ libelle: 'Rien de plus', droits: [], phrase: 'Comme tout agent : il signale une anomalie et la prend en charge.' },
			{ libelle: 'Gérer', droits: ['TRAITER_ANOMALIE', 'GERER_FICHES'], phrase: 'Traite les anomalies et tient les fiches de prise de garde.' }
		]
	},
	{
		id: 'stock',
		nom: 'Stock et pharmacie',
		niveaux: [
			{ libelle: 'Rien de plus', droits: [], phrase: 'Comme tout agent : il signale un besoin de stock.' },
			{ libelle: 'Gérer', droits: ['GERER_STOCK'], phrase: 'Tient le stock et la pharmacie.' }
		]
	},
	{
		id: 'habillement',
		nom: 'Habillement',
		niveaux: [
			{ libelle: 'Rien de plus', droits: [], phrase: 'Comme tout agent : il demande une tenue.' },
			{ libelle: 'Gérer', droits: ['GERER_HABILLEMENT'], phrase: 'Traite les demandes de tenue.' }
		]
	},
	{
		id: 'reservations',
		nom: 'Réservations',
		niveaux: [
			{ libelle: 'Rien', droits: [], phrase: 'Ne réserve rien.' },
			{ libelle: 'Réserver', droits: ['RESERVER'], phrase: 'Réserve un véhicule ou du matériel.' },
			{ libelle: 'Gérer', droits: ['RESERVER', 'GERER_RESERVATIONS'], phrase: 'Réserve et gère toutes les réservations.' }
		]
	},
	{
		id: 'messagerie',
		nom: 'Messagerie',
		niveaux: [
			{ libelle: 'Rien de plus', droits: [], phrase: 'Comme tout agent : il utilise la messagerie.' },
			{ libelle: 'Modérer', droits: ['MODERER_MESSAGERIE'], phrase: 'Modère aussi la messagerie.' }
		]
	}
];

// Cases à part : seuls le chef de centre, l'adjoint et le super administrateur les changent.
export const ADMINISTRATION: { droit: Droit; libelle: string }[] = [
	{ droit: 'GERER_ACCES', libelle: 'Gérer les accès' },
	{ droit: 'GERER_COMITES', libelle: 'Gérer les comités' },
	{ droit: 'GERER_LISTES', libelle: 'Gérer les responsabilités' },
	{ droit: 'ATTRIBUER_RESPONSABILITE', libelle: 'Nommer' }
];

const droitsDuDomaine = (d: Domaine) => new Set(d.niveaux.flatMap((n) => n.droits));
const memes = (a: Droit[], b: Droit[]) => a.length === b.length && a.every((d) => b.includes(d));

// Le niveau de chaque domaine ; « sur_mesure » si ses droits ne tombent sur aucun niveau.
export function niveauxDe(droits: Droit[]): Record<DomaineId, number | 'sur_mesure'> {
	const resultat = {} as Record<DomaineId, number | 'sur_mesure'>;
	for (const d of DOMAINES) {
		const siens = droits.filter((x) => droitsDuDomaine(d).has(x));
		const i = d.niveaux.findIndex((n) => memes(n.droits, [...new Set(siens)]));
		resultat[d.id] = i === -1 ? 'sur_mesure' : i;
	}
	return resultat;
}

// Remplace les droits des seuls domaines choisis ; tout le reste est gardé.
export function appliquerNiveaux(droits: Droit[], choix: Partial<Record<DomaineId, number>>): Droit[] {
	let resultat = [...droits];
	for (const d of DOMAINES) {
		const niveau = choix[d.id];
		if (niveau === undefined || !d.niveaux[niveau]) continue;
		const domaine = droitsDuDomaine(d);
		resultat = [...resultat.filter((x) => !domaine.has(x)), ...d.niveaux[niveau].droits];
	}
	return resultat;
}

// Les droits sans effet d'une ligne ancienne ne comptent pas.
export function estPersonnalise(droits: Droit[], modele: string | null): boolean {
	const m = MODELES.find((x) => x.id === modele);
	return m !== undefined && !memes([...new Set(droits.filter((d) => !estSansEffet(d)))], m.droits);
}
