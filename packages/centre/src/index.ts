// Tout ce qui distingue un centre d'un autre. Le code de l'appli ne contient rien de propre à un centre :
// il lit cette description, écrite dans centres/<id>/centre.ts.

export type JourSemaine = 'lundi' | 'mardi' | 'mercredi' | 'jeudi' | 'vendredi' | 'samedi' | 'dimanche';

export interface Equipe {
	/** Numéro dans la rotation, à partir de 1 */
	numero: number;
	nom: string;
	/** Couleur du planning papier, en hexadécimal (#rrggbb) */
	couleur: string;
}

export interface Centre {
	/** Identifiant court, en minuscules : c'est le nom du dossier centres/<id> */
	id: string;
	/** Nom affiché, par exemple « CIS Laillé » */
	nom: string;
	commune: string;
	fuseauHoraire: string;
	/** Position du centre, pour la météo */
	position: { latitude: number; longitude: number };
	/** Numéro du département en métropole (35, 2A…), pour la vigilance Météo-France ; sans lui, pas de vigilance */
	departement?: string;
	/** Dans l'ordre de la rotation */
	equipes: Equipe[];
	astreinte: {
		/** Prise d'astreinte, par exemple vendredi 17:30 */
		debut: { jour: JourSemaine; heure: string };
		/** Fin d'astreinte, la semaine suivante, par exemple vendredi 06:00 */
		fin: { jour: JourSemaine; heure: string };
		/** Une date de prise d'astreinte connue (AAAA-MM-JJ) et l'équipe qui l'a prise */
		reference: { date: string; equipe: number };
		/** En semaine, hors week-end et jours fériés, l'astreinte ne couvre que ces heures (par exemple 18:00 à 06:00) ; sans ce réglage, elle est continue */
		semaine?: { debut: string; fin: string };
	};
	/** Durée de conservation des messages de la messagerie, en mois (12 si omise) ; ensuite, ils sont effacés */
	conservationMessagesMois?: number;
}

/** Un centre déclaré par defineCentre : les valeurs par défaut sont posées. */
export type CentreDeclare = Centre & { conservationMessagesMois: number };

const JOURS: JourSemaine[] = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

const FUSEAUX = new Set(Intl.supportedValuesOf('timeZone'));

/** Liste les erreurs d'une description de centre (vide si elle est correcte). */
export function erreursCentre(centre: Centre): string[] {
	const erreurs: string[] = [];
	const heure = /^([01]\d|2[0-3]):[0-5]\d$/;

	if (!/^[a-z0-9-]+$/.test(centre.id)) erreurs.push(`id « ${centre.id} » : minuscules, chiffres et tirets seulement`);
	if (!centre.nom.trim()) erreurs.push('nom vide');
	if (!FUSEAUX.has(centre.fuseauHoraire)) erreurs.push(`fuseau horaire « ${centre.fuseauHoraire} » inconnu`);
	const { latitude, longitude } = centre.position;
	if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) erreurs.push('position hors des limites');

	const departement = centre.departement;
	if (departement !== undefined && !/^(0[1-9]|1\d|2[1-9AB]|[3-8]\d|9[0-5])$/.test(departement))
		erreurs.push(`département « ${departement} » : numéro de métropole attendu, par exemple 35 ou 2A`);

	if (centre.equipes.length < 2) erreurs.push('il faut au moins deux équipes pour une rotation');
	centre.equipes.forEach((e, i) => {
		if (e.numero !== i + 1) erreurs.push(`équipe « ${e.nom} » : numéro ${e.numero} au lieu de ${i + 1}`);
		if (!/^#[0-9a-f]{6}$/i.test(e.couleur)) erreurs.push(`équipe « ${e.nom} » : couleur « ${e.couleur} » invalide`);
	});

	const { debut, fin, reference } = centre.astreinte;
	for (const [nom, moment] of [['début', debut], ['fin', fin]] as const) {
		if (!JOURS.includes(moment.jour)) erreurs.push(`astreinte, ${nom} : jour « ${moment.jour} » inconnu`);
		if (!heure.test(moment.heure)) erreurs.push(`astreinte, ${nom} : heure « ${moment.heure} » au format HH:MM attendue`);
	}
	for (const h of centre.astreinte.semaine ? [centre.astreinte.semaine.debut, centre.astreinte.semaine.fin] : []) {
		if (!heure.test(h)) erreurs.push(`astreinte en semaine : heure « ${h} » au format HH:MM attendue`);
	}
	const date = new Date(`${reference.date}T12:00:00Z`);
	// Une date impossible (31 avril) serait reportée au jour suivant : on vérifie qu'elle se relit à l'identique
	if (
		!/^\d{4}-\d{2}-\d{2}$/.test(reference.date) ||
		Number.isNaN(date.getTime()) ||
		date.toISOString().slice(0, 10) !== reference.date
	) {
		erreurs.push(`astreinte, référence : date « ${reference.date} » invalide`);
	} else if (JOURS[(date.getUTCDay() + 6) % 7] !== debut.jour) {
		erreurs.push(`astreinte, référence : le ${reference.date} n'est pas un ${debut.jour}`);
	}
	if (!centre.equipes.some((e) => e.numero === reference.equipe)) {
		erreurs.push(`astreinte, référence : équipe ${reference.equipe} inconnue`);
	}
	const mois = centre.conservationMessagesMois;
	if (mois !== undefined && !(Number.isInteger(mois) && mois >= 1)) erreurs.push(`conservation des messages : ${mois} mois, un nombre entier de 1 au moins attendu`);
	return erreurs;
}

/** Déclare un centre : refuse une description incorrecte dès la compilation de l'appli. */
export function defineCentre(centre: Centre): CentreDeclare {
	const erreurs = erreursCentre(centre);
	if (erreurs.length) throw new Error(`Centre « ${centre.id} » mal décrit :\n- ${erreurs.join('\n- ')}`);
	return { ...centre, conservationMessagesMois: centre.conservationMessagesMois ?? 12 };
}
