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
	outil: 'M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z'
} as const;

export type IconeRole = keyof typeof ICONES_ROLES;

// Le centre : une maison. Hors de la liste des icônes à choisir.
export const ICONE_MAISON = 'M3 11l9-7 9 7v9H3zM9 20v-6h6v6';
