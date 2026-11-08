// Tracés des icônes de rôle (grille 24 × 24, trait de 1,8).
export const ICONES_ROLES = {
	etoile: 'M12 3l2.6 5.6 6 .6-4.5 4 1.3 6-5.4-3.1-5.4 3.1 1.3-6-4.5-4 6-.6z',
	casque: 'M4 15a8 8 0 0 1 16 0M2 15h20M12 7V4M8 15v2h8v-2',
	camion: 'M3 16V8h11v8M14 11h4l3 3v2h-7M5 18a2 2 0 1 0 4 0 2 2 0 1 0-4 0M15 18a2 2 0 1 0 4 0 2 2 0 1 0-4 0',
	croix: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z',
	cle: 'M14 6a4 4 0 1 0 1.5 3.1L21 15v3h-3v-2h-2v-2l-2.5-2.5',
	ballon: 'M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
	livre: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM8 7h7M8 11h7',
	groupe: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6M3 20a6 6 0 0 1 12 0M17 11a3 3 0 1 0 0-6M16 14a5 5 0 0 1 5 6',
	coeur: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z',
	veste: 'M9 3l3 3 3-3 5 3-2 5h-2v10H8V11H6L4 6z M12 6v15',
	outil: 'M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z'
} as const;

export type IconeRole = keyof typeof ICONES_ROLES;

// Le centre : une maison. Hors de la liste des icônes à choisir.
export const ICONE_MAISON = 'M3 11l9-7 9 7v9H3zM9 20v-6h6v6';

// Tracés d'interface partagés entre écrans (même grille 24 × 24).
export const DESSINS = {
	fichier: 'M6 3h8l4 4v14H6z M14 3v4h4 M9 12h6 M9 16h6',
	profil: 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1',
	sortir: 'M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4 M10 17l5-5-5-5 M15 12H3',
	annonce: 'M3 10v4h3l7 5V5l-7 5z M16.5 8.5a5 5 0 0 1 0 7',
	sondage: 'M5 20V11 M12 20V4 M19 20v-6',
	epinglee: 'M9 3h6l-1 6 4 4H6l4-4z M12 13v8',
	ok: 'M5 12.5l4.5 4.5L19 7',
	echanges: 'M4 5h16v11H8l-4 4z',
	affichage: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l1.5 1.5 M17.5 17.5 19 19 M5 19l1.5-1.5 M17.5 6.5 19 5',
	loupe: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z M20 20l-4-4',
	plus: 'M12 5v14M5 12h14',
	cloche: 'M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z M10 20a2 2 0 0 0 4 0',
	son: 'M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z M15.5 9a4 4 0 0 1 0 6 M18 6.5a7.5 7.5 0 0 1 0 11',
	sonCoupe: 'M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z M16 9.5l5 5 M21 9.5l-5 5',
	photo: 'M4 8h3.5l2-3h5l2 3H20v11H4z M12 16.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6'
} as const;
