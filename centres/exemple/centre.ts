import { defineCentre } from '@gyro-caserne/centre';

// Centre fictif : à copier pour décrire un nouveau centre
export default defineCentre({
	id: 'exemple',
	nom: 'CIS Exemple',
	commune: 'Exemple-sur-Vilaine',
	fuseauHoraire: 'Europe/Paris',
	position: { latitude: 48.1, longitude: -1.7 },
	equipes: [
		{ numero: 1, nom: 'Équipe 1', couleur: '#d4a017' },
		{ numero: 2, nom: 'Équipe 2', couleur: '#c2185b' },
		{ numero: 3, nom: 'Équipe 3', couleur: '#1565c0' }
	],
	astreinte: {
		debut: { jour: 'lundi', heure: '08:00' },
		fin: { jour: 'lundi', heure: '08:00' },
		// Le lundi 5 janvier 2026, c'est l'équipe 1
		reference: { date: '2026-01-05', equipe: 1 }
	}
});
