# Refonte du planning et astreinte sur l'Accueil — design

Date : 2026-11-01. Demandé par le porteur ; proposition de Claude acceptée sans maquettes (« pas besoin de maquette… mettre à jour l'accueil avec la partie astreinte, je te laisse vérifier »). Lot d'interface : pas de nouvelle règle métier.

À construire **après la fusion du lot Remplacements** (PR #30), qui touche les mêmes écrans (« Me faire remplacer », périodes remplacées) : partir de `main` à jour.

## Pourquoi

Le planning est le seul écran resté hors du canevas harmonisé : côté agent, une longue liste de 52 semaines ; côté chef, une page de formulaires avec 52 listes déroulantes. Il doit être chaleureux, lisible d'un coup d'œil, et offrir plusieurs vues. L'astreinte, première information d'un agent, doit aussi être sur l'Accueil.

## Canevas commun

Celui des écrans harmonisés et des Échanges : `EnTetePage`, `Rangee`, `Vide`, `Visage`, puces de filtre (`FiltresEchanges`), rubriques repliables (comme les groupes des Échanges), jetons `app.css`, couleurs d'équipe toujours doublées d'un texte (« Équipe 3 », « Mon astreinte »). Téléphone d'abord, soigné à 1280, clair et sombre, AA, « réduire les animations » respecté.

## Onglet Planning (agent)

1. **En-tête** « Planning » + une phrase vivante (« Votre équipe est d'astreinte dans 19 jours », « Vous êtes d'astreinte ce soir à 18 h », « Le planning 2027 n'est pas encore publié »).
2. **Carte « Ma prochaine astreinte »** (ou « En cours ») à la couleur de l'équipe : compte à rebours, du… au… avec heures, équipe ; boutons « Me faire remplacer » (lot Remplacements) et « Ajouter à mon agenda ». Pendant l'astreinte : « En cours jusqu'à vendredi 6 h » et la prochaine plage (« ce soir 18 h – 6 h »).
3. **À venir** (rangées) : prochaine manœuvre avec réponse Présent / Absent / Incertain sur place ; garde de fête si elle le concerne ; ses remplacements en cours (demandés, acceptés, à valider).
4. **Vues** en puces : **Semaine · Mois · Année · Équipes** (la dernière vue choisie est retenue sur l'appareil) :
   - **Semaine** : du vendredi au vendredi, jour par jour, les plages réelles (18 h – 6 h, 24 h), l'équipe d'astreinte, les remplacements (« X remplace Y »), manœuvres, fériés ; flèches semaine précédente / suivante.
   - **Mois** : calendrier mensuel ; chaque semaine en bande à la couleur de son équipe **avec son numéro écrit** ; marques texte + icône pour manœuvre, férié, vacances ; toucher un jour ouvre son détail ; flèches mois précédent / suivant.
   - **Année** : 12 mois **repliés** sauf le mois en cours ; chaque mois résume (« 1 astreinte · 1 manœuvre · 1 férié ») ; se déplie d'un geste ; interrupteur « Seulement mes semaines ».
   - **Équipes** : quelle équipe quand, même présentation repliée par mois.
5. **Ordinateur** : deux colonnes — carte et « À venir » à gauche, la vue choisie à droite (le mois et l'année en grille).
6. Navigation entre années (‹ 2025 · 2027 ›) gardée, discrète.

## Préparer l'année (chef, droit `GERER_PLANNING`)

Un **parcours en 5 étapes** avec barre de progression et l'étiquette **Brouillon / Publiée** visible partout ; chaque étape s'enregistre seule, on peut revenir à toute étape :

1. **Roulement** : les 4 équipes à ordonner (boutons monter / descendre, accessibles au clavier ; pas de glisser-déposer obligatoire), équipe de la première semaine ; **aperçu immédiat** des premières semaines.
2. **Fêtes** : qui tient Noël et le Nouvel An avec ce roulement, l'historique du tour, l'alerte « hors de son tour » ; un bouton qui **propose l'échange de semaines** corrigeant le tour (le chef accepte ou non).
3. **Manœuvres** : en rangées (date, thème, équipes) ; ajout et modification dans un **panneau** (feuille du bas au téléphone, panneau latéral à l'ordinateur).
4. **Repères** : fériés calculés (liste repliée), vacances scolaires en rangées + ajout.
5. **Vérifier et publier** : l'année en **grille de semaines colorées** (texte de l'équipe dans chaque case) ; **toucher une semaine** ouvre un choix d'équipe (remplace les 52 listes déroulantes) ; récapitulatif (manœuvres, fêtes, vacances) ; « Publier l'année ».

## Accueil

- Une **carte astreinte** en tête de l'Accueil pour tout agent qui a une équipe : la même information que la carte du Planning, en plus compacte (« Équipe 3 d'astreinte dans 19 jours — du ven. 20 nov. 18 h au ven. 27 nov. 6 h », ou « Vous êtes d'astreinte ce soir 18 h – 6 h »), qui mène au Planning. Sans équipe (chef de centre…) : « Cette semaine : Équipe 2 d'astreinte ».
- La **prochaine manœuvre** apparaît dans « À ne pas manquer » si l'agent n'a pas répondu (déjà le cas via la publication du mur : vérifier, ne pas doubler).
- Pour le chef : rangée « Planning 2027 à préparer » dans « À décider » à partir du 1er octobre tant que l'année suivante n'est pas publiée (choix de Claude).
- Le budget de requêtes de l'Accueil reste tenu.

## Hors périmètre

Nouvelles règles de planning, planning d'été (lot suivant), disponibilités.

## Vérification

Tests de rendu et de comportement des vues, des étapes et de la carte d'accueil ; e2e mis à jour ; captures 390 / 1280, clair / sombre, regardées.
