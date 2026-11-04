import { defineCentre } from '../../packages/centre/src/index.ts';

// Centre fictif : à copier pour décrire un nouveau centre
export default defineCentre({
	id: 'exemple',
	nom: 'CIS Exemple',
	commune: 'Exemple-sur-Vilaine',
	fuseauHoraire: 'Europe/Paris',
	position: { latitude: 48.1, longitude: -1.7 },
	// Pour la vigilance Météo-France
	departement: '35',
	departementNom: 'Ille-et-Vilaine',
	equipes: [
		{ numero: 1, nom: 'Équipe 1', couleur: '#d4a017' },
		{ numero: 2, nom: 'Équipe 2', couleur: '#c2185b' },
		{ numero: 3, nom: 'Équipe 3', couleur: '#1565c0' },
		{ numero: 4, nom: 'Équipe 4', couleur: '#2e7d32' }
	],
	astreinte: {
		// Relève le vendredi à 18 h ; fin le vendredi suivant à 6 h
		debut: { jour: 'vendredi', heure: '18:00' },
		fin: { jour: 'vendredi', heure: '06:00' },
		// Le vendredi 2 janvier 2026, c'est l'équipe 1
		reference: { date: '2026-01-02', equipe: 1 },
		// En semaine, de 18 h à 6 h ; le week-end et les jours fériés, 24 h sur 24. Sans cette ligne, l'astreinte est continue.
		semaine: { debut: '18:00', fin: '06:00' }
	}
	// Messages gardés 12 mois, puis effacés ; pour une autre durée : conservationMessagesMois: 24
	// Suivi des anomalies : étape « en attente » oui, « vérifiée » non, libellés d'origine ; pour changer :
	// anomalies: { verifiee: true, libelles: { reparee: 'Remise en état' } }
});
