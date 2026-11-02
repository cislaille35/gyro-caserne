// Les fiches de départ, reprises du MVP : une par type d'engin (noms du réglage d'armement), rangées par zone.
// Le jeu de départ les pose ; la migration 0017 les ajoute aux bases déjà remplies (un test vérifie qu'elles sont identiques).
// Élément : [libellé, quantité attendue ou null s'il est seulement présent ou manquant].

export type FicheDeDepart = { type: string; zones: { nom: string; elements: [string, number | null][] }[] };

export const FICHES_PAR_DEFAUT: FicheDeDepart[] = [
	{
		type: 'VSAV',
		zones: [
			{
				nom: 'Cabine',
				elements: [
					['Niveau de carburant (au moins 3/4)', null],
					['Radio : essai', null],
					['Terminal / GPS', null],
					['Gyrophares et deux-tons', null],
					['Gilets haute visibilité', 3],
					['Lampes portatives chargées', 2],
					['Documents de bord', null]
				]
			},
			{
				nom: 'Cellule sanitaire',
				elements: [
					['Brancard principal et matelas', null],
					['Chaise portoir', null],
					['Matelas immobilisateur à dépression', null],
					['Plan dur et immobilisateur de tête', null],
					['Colliers cervicaux (jeu)', null],
					['Attelles (lot)', null],
					['Aspirateur de mucosités : essai', null],
					['Bouteille d’oxygène fixe : pression', null],
					['Couvertures', 4],
					['Draps à usage unique', null],
					['Gants (boîtes)', 3],
					['Désinfectant et lingettes', null],
					['DSA : voyant vert, électrodes adulte et enfant', null]
				]
			},
			{
				nom: 'Sac de premiers secours',
				elements: [
					['Tensiomètre', null],
					['Oxymètre de pouls', null],
					['Thermomètre', null],
					['Lecteur de glycémie et bandelettes', null],
					['Pansements compressifs', 4],
					['Compresses stériles', null],
					['Garrot tourniquet', 2],
					['Couvertures de survie', 4],
					['Ciseaux', null]
				]
			},
			{
				nom: 'Sac d’oxygénothérapie',
				elements: [
					['Bouteille d’oxygène portable : pression', null],
					['Insufflateurs adulte, enfant et nourrisson', null],
					['Masques haute concentration', null],
					['Canules oropharyngées (jeu)', null]
				]
			}
		]
	},
	{
		type: 'FPT',
		zones: [
			{
				nom: 'Cabine',
				elements: [
					['Niveau de carburant (au moins 3/4)', null],
					['Radio : essai', null],
					['Gyrophares et deux-tons', null],
					['Lampes portatives chargées', 4],
					['Caméra thermique chargée', null]
				]
			},
			{
				nom: 'Appareils respiratoires',
				elements: [
					['ARI : pression et fonctionnement', 4],
					['Masques ARI', 4],
					['Bouteilles de réserve', 4],
					['Balises de détresse', 4]
				]
			},
			{
				nom: 'Hydraulique',
				elements: [
					['Citerne pleine', null],
					['Émulseur : niveau', null],
					['Pompe : essai', null],
					['Tuyaux 45 mm', 6],
					['Tuyaux 70 mm', 4],
					['Lances', 2],
					['Division', null],
					['Clés tricoises', 2]
				]
			},
			{
				nom: 'Coffres',
				elements: [
					['Lot de sauvetage et de protection contre les chutes', null],
					['Échelle à crochets', null],
					['Échelle 3 plans', null],
					['Lot de balisage (cônes)', null],
					['Extincteurs eau, CO2, poudre', 3],
					['Outils de forcement (lot)', null],
					['Tronçonneuse : plein et essai', null]
				]
			}
		]
	},
	{
		type: 'VTU',
		zones: [
			{
				nom: 'Cabine',
				elements: [
					['Niveau de carburant (au moins 3/4)', null],
					['Radio : essai', null],
					['Gyrophares et deux-tons', null],
					['Gilets haute visibilité', 3]
				]
			},
			{
				nom: 'Épuisement',
				elements: [
					['Motopompe : plein et essai', null],
					['Électropompe', null],
					['Aspirateur à eau', null],
					['Raclettes et seaux', null]
				]
			},
			{
				nom: 'Coffres',
				elements: [
					['Bâches (lot)', null],
					['Groupe électrogène : plein et essai', null],
					['Projecteurs d’éclairage', 2],
					['Tronçonneuse : plein et essai', null],
					['Lot de balisage', null],
					['Cordes et sangles', null],
					['Caisse à outils', null]
				]
			}
		]
	}
];
