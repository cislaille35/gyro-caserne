export const TENUES = {
	normal: 'souriant',
	astreinte: 'en alerte pour l’astreinte',
	garde: 'avec la check-list de garde',
	manoeuvre: 'casqué pour la manœuvre',
	remplacement: 'pour un remplacement',
	anomalie: 'pansé, avec une clé',
	inquiet: 'inquiet',
	amicale: 'en fête',
	ptitdej: 'avec un croissant',
	ete: 'en lunettes de soleil',
	hiver: 'en bonnet et écharpe',
	nuit: 'endormi',
	vacances: 'en vacances',
	pluie: 'sous son parapluie',
	vent: 'penché par le vent',
	intervention: 'en casque F1',
	formation: 'en toque de diplômé',
	saintebarbe: 'médaillé pour la Sainte-Barbe',
	anniversaire: 'avec un gâteau d’anniversaire',
	bienvenue: 'qui salue',
	victoire: 'qui fête une victoire',
	chargement: 'gyrophare allumé',
	horsligne: 'débranché',
	sport: 'en tenue de sport',
	vide: 'avec une loupe',
	calendriers: 'avec ses calendriers',
	bal14: 'en nœud papillon pour le bal',
	journeenationale: 'avec fourragère et drapeau',
	galons: 'avec ses nouveaux galons',
	recrue: 'en casquette de recrue',
	retraite: 'à la pêche pour sa retraite',
	lavage: 'qui lave le camion',
	cafe: 'avec un café',
	galette: 'couronné roi',
	chandeleur: 'qui fait sauter une crêpe',
	poisson: 'avec un poisson dans le dos',
	halloween: 'à côté d’une citrouille',
	noel: 'en bonnet de Noël',
	nouvelan: 'qui fête la nouvelle année',
	orage: 'sous l’orage',
	brouillard: 'dans le brouillard',
	canicule: 'devant un ventilateur',
} as const satisfies Record<string, string>;

export type Tenue = keyof typeof TENUES;

export type Yeux = 'normal' | 'grands' | 'fermes' | 'joyeux' | 'soleil' | 'inquiet' | 'concentre' | 'lecture' | 'haut' | 'bas' | 'cote';
export type Bouche = 'sourire' | 'large' | 'o' | 'triste' | 'vague' | 'droite' | 'grande' | 'petite' | 'aucune';

const dans = (tenue: Tenue, liste: Tenue[]) => liste.includes(tenue);

export function yeuxDe(t: Tenue): Yeux {
	if (dans(t, ['astreinte', 'recrue', 'orage'])) return 'grands';
	if (dans(t, ['nuit', 'canicule'])) return 'fermes';
	if (dans(t, ['amicale', 'vacances', 'victoire', 'anniversaire', 'bienvenue', 'saintebarbe', 'bal14', 'galons', 'retraite', 'galette', 'noel', 'nouvelan'])) return 'joyeux';
	if (t === 'ete') return 'soleil';
	if (t === 'inquiet') return 'inquiet';
	if (dans(t, ['manoeuvre', 'hiver', 'intervention', 'sport', 'brouillard'])) return 'concentre';
	if (dans(t, ['garde', 'formation'])) return 'lecture';
	if (dans(t, ['chargement', 'chandeleur'])) return 'haut';
	if (dans(t, ['anomalie', 'horsligne'])) return 'bas';
	if (dans(t, ['vide', 'halloween'])) return 'cote';
	return 'normal';
}

export function boucheDe(t: Tenue): Bouche {
	if (dans(t, ['astreinte', 'nuit', 'orage', 'chandeleur', 'nouvelan'])) return 'o';
	if (t === 'inquiet') return 'triste';
	if (dans(t, ['anomalie', 'horsligne'])) return 'vague';
	if (dans(t, ['garde', 'formation', 'vide', 'brouillard'])) return 'droite';
	if (dans(t, ['amicale', 'victoire', 'anniversaire', 'bienvenue', 'saintebarbe', 'bal14', 'galons', 'galette', 'halloween'])) return 'grande';
	if (dans(t, ['manoeuvre', 'intervention', 'sport', 'chargement'])) return 'petite';
	if (t === 'hiver') return 'aucune';
	if (dans(t, ['ete', 'vacances', 'retraite', 'noel', 'canicule', 'journeenationale'])) return 'large';
	return 'sourire';
}

export const aReflet = (t: Tenue) =>
	!dans(t, ['manoeuvre', 'hiver', 'nuit', 'vacances', 'anomalie', 'intervention', 'formation', 'sport', 'recrue', 'retraite', 'noel']);

const decalages: Partial<Record<Tenue, string>> = {
	garde: 'translate(4 20)',
	anomalie: 'translate(10 20)',
	ptitdej: 'translate(2 20)',
	ete: 'translate(16 20)',
	vacances: 'translate(0 20)',
	anniversaire: 'translate(2 20)',
	bienvenue: 'translate(8 20)',
	horsligne: 'translate(6 20)',
	sport: 'translate(4 20)',
	vide: 'translate(2 20)',
	remplacement: 'translate(20 24)',
	calendriers: 'translate(4 20)',
	journeenationale: 'translate(2 20)',
	retraite: 'translate(4 20)',
	lavage: 'translate(4 20)',
	cafe: 'translate(4 20)',
	chandeleur: 'translate(2 20)',
	halloween: 'translate(4 20)',
	canicule: 'translate(4 20)',
	poisson: 'translate(30 20)'
};

export const decalageDe = (t: Tenue) => decalages[t] ?? 'translate(20 20)';
