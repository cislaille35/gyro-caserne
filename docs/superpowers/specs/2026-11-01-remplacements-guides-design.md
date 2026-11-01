# Remplacements guidés, page agenda et corrections du planning — design

Date : 2026-11-01. Lot d'interface validé par le porteur dans la conversation. **Aucune nouvelle règle métier** : les règles des remplacements (`2026-11-01-remplacements-design.md`) restent les mêmes. S'appuie sur la refonte du planning (`2026-11-01-refonte-planning-design.md`).

## Pourquoi

Le porteur ne comprenait pas l'écran « Me faire remplacer » : longue liste de cases à cocher sur trois semaines, case « Tout » aux dates déroutantes, trois modes en puces, bouton « + » muet. La page « Ajouter à mon agenda » ne dit pas à quoi elle sert. Deux défauts du planning : la date de la garde de fête et la page qui remonte en haut.

## 1. Remplacements : parcours guidé en 3 étapes

- **Quand ?** : choisir une de ses semaines d'astreinte (cartes), puis la semaine en **bande de 7 jours** (vendredi → jeudi) avec la plage de chaque jour (18 h – 6 h, 24 h) ; toucher les jours voulus ; raccourcis « Ce soir » (si pertinent), « Le week-end », « Toute la semaine ». Les périodes déjà demandées ou passées sont visibles mais inactives, avec la raison en texte.
- **À qui ?** : « Tout le monde » (avec le nombre de collègues disponibles prévenus) ou « Un collègue précis » : liste avec recherche qui ne montre **que les collègues libres** sur les périodes choisies (visage, nom, aptitudes ; un avertissement si une aptitude contrôlée manque, avec « votre chef d'équipe devra valider »).
- **Vérifier et envoyer** : une phrase récapitulative (« Vous demandez à être remplacé la nuit du lundi 9 novembre (18 h – 6 h). 12 collègues disponibles sont prévenus. Votre chef d'équipe sera informé. »), un mot facultatif, Envoyer.
- Barre de progression « Étape 1 sur 3 », retour possible, tout marche sans JavaScript (chaque étape est une page, l'état est dans l'adresse), et au clavier.
- **Page d'une demande** : une frise d'état (Envoyée → Acceptée par X → Validée par le chef si besoin → Conclue ; ou Refusée / Annulée / Expirée), les actions possibles, et après conclusion le rappel « Mettez à jour votre disponibilité dans l'appli du SDIS ».
- **Échanger avec un collègue** : même parcours (ma période → le collègue → sa période → vérifier). **Échanger ma place à une manœuvre** : lancé depuis la carte de la manœuvre (« Je ne peux pas : échanger ma place »), parcours court.
- **Points d'entrée** : « Me faire remplacer » sur la carte astreinte (Planning et Accueil) et sur chaque jour de la vue Semaine (pré-sélectionne ce jour) ; la page Remplacements garde Pour moi / Mes demandes / Historique, le « + » devient un vrai bouton « Me faire remplacer » (texte visible), et un vide qui explique le déroulé en 3 lignes.

## 2. Page « Ajouter à mon agenda » (Moi → agenda)

- En tête, « À quoi ça sert ? » en 3 lignes : votre planning dans l'agenda de votre téléphone, à côté de vos rendez-vous ; il se met à jour tout seul (astreintes, manœuvres, remplacements) ; une seule fois, plus rien à recopier.
- Bouton principal « Ajouter à mon agenda » (lien `webcal://` qui ouvre l'abonnement), « Copier le lien » en secondaire.
- Mode d'emploi **replié** par application (Google Agenda, iPhone, Outlook) ; celui du téléphone de l'agent ouvert d'office (détection simple de l'appareil, sinon tout replié).
- En bas : rappel « ne le partagez pas » et « Changer le lien » ; « L'agenda peut mettre quelques heures à se mettre à jour ; l'appli est toujours à jour. » Pas d'infobulle.

## 3. Corrections du planning

- (a) La carte « À venir » de la garde du Nouvel An / de Noël dit la bonne date, **avec l'année** quand ce n'est pas l'année en cours, et seulement si l'équipe de l'agent la tient vraiment.
- (b) Les flèches et les jours des vues Mois et Semaine, et « Proposer un échange », ne font plus remonter la page en haut (SvelteKit 3 ignore `data-sveltekit-noscroll` : `data-sveltekit-reset="false"`, comme les liens du panneau).

## Téléphone et ordinateur

Exigence du porteur : aucune désynchronisation. Mêmes fonctions, mêmes points d'entrée, mêmes informations aux deux tailles ; rien qui n'existe qu'à une taille. Un test vérifie que les écrans du lot ne cachent rien selon la largeur ; captures 390 clair et 1280 sombre de chaque écran touché (plus 1280 clair pour le parcours guidé), regardées côte à côte.

## Hors périmètre

Toute nouvelle règle de remplacement ; disponibilités ; planning d'été.
