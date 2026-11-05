import { formatDeDate } from '@gyro-caserne/socle/dates';


// Date du jour à Paris, au format AAAA-MM-JJ.
export function aujourdhuiParis(date = new Date()): string {
	return formatDeDate({ timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }, 'fr-CA').format(date);
}

// Date et heure de Paris, au format AAAA-MM-JJTHH:MM:SS.
export function maintenantParis(date = new Date()): string {
	return `${aujourdhuiParis(date)}T${formatDeDate({ timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(date)}`;
}

// La même heure, sept jours plus tard, au format AAAA-MM-JJTHH:MM (clôture d'un sondage par défaut).
export function septJoursPlusTard(dateHeure: string): string {
	return new Date(Date.parse(`${dateHeure.slice(0, 16)}:00Z`) + 7 * 864e5).toISOString().slice(0, 16);
}

// Clôture préremplie d'un sondage : 7 jours après l'ouverture, ou le début de l'événement,
// sans dépasser 365 jours après l'ouverture (même heure), la limite du socle.
export function clotureParDefaut(ouverture: string, debutEvenement?: string): string {
	const plafond = new Date(Date.parse(`${ouverture.slice(0, 16)}:00Z`) + 365 * 864e5).toISOString().slice(0, 16);
	const voulue = debutEvenement ? debutEvenement.slice(0, 16) : septJoursPlusTard(ouverture);
	return voulue < plafond ? voulue : plafond;
}
