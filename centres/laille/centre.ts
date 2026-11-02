import { defineCentre } from '../../packages/centre/src/index.ts';

export default defineCentre({
	id: 'laille',
	nom: 'CIS Laillé',
	commune: 'Laillé',
	fuseauHoraire: 'Europe/Paris',
	position: { latitude: 48.065, longitude: -1.717 },
	// Pour la vigilance Météo-France
	departement: '35',
	// Couleurs du planning papier
	equipes: [
		{ numero: 1, nom: 'Équipe 1', couleur: '#f2c200' },
		{ numero: 2, nom: 'Équipe 2', couleur: '#e5699a' },
		{ numero: 3, nom: 'Équipe 3', couleur: '#3d7fd6' },
		{ numero: 4, nom: 'Équipe 4', couleur: '#3fa34d' }
	],
	astreinte: {
		debut: { jour: 'vendredi', heure: '18:00' },
		fin: { jour: 'vendredi', heure: '06:00' },
		// En semaine, de 18 h à 6 h ; le week-end et les jours fériés, 24 h sur 24
		semaine: { debut: '18:00', fin: '06:00' },
		// Planning 2026 : le vendredi 16/01/2026, c'est l'équipe 1
		reference: { date: '2026-01-16', equipe: 1 }
	}
});
