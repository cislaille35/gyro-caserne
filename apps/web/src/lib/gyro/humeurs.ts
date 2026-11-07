// Les phrases d'humeur de Gyro, au niveau Vivant : une par jour, jamais la même sur l'accueil et dans Échanges.
// Jamais à côté d'une alerte, ni sur un écran d'urgence.
export const HUMEURS = [
	'Gyro a fait le plein de café.',
	'Les tuyaux sont roulés, les bottes alignées.',
	'Gyro a lustré les chromes des engins.',
	'Rien ne vous a échappé : Gyro veille.',
	'Gyro a compté les casques : le compte est bon.',
	'Gyro a jeté un œil au ciel pour vous.',
	'La barre de descente brille comme un sou neuf.',
	'Parapluie ou lunettes de soleil ? Gyro hésite encore.',
	'Le gyrophare se repose, profitez-en.',
	'Gyro a rangé la remise, ou presque.'
];

const jourDeLAnnee = (jour: string) => Math.round((Date.parse(`${jour}T00:00:00Z`) - Date.parse(`${jour.slice(0, 4)}-01-01T00:00:00Z`)) / 864e5);

// `jour` : « AAAA-MM-JJ », à l'heure de Paris. Échanges a cinq jours d'avance sur l'accueil.
export function humeurDuJour(jour: string, ecran: 'accueil' | 'echanges'): string {
	return HUMEURS[(jourDeLAnnee(jour) + (ecran === 'echanges' ? 5 : 0)) % HUMEURS.length]!;
}
