# Design de l'interface : les fondations

Date : 2026-10-26. Validé en conversation avec le porteur, avant relecture du document.
Maquettes de référence : https://claude.ai/artifact/3byPSrCK7utxSFxLnKVMmq (accueil en trois niveaux, connexion, agents sur ordinateur, planche de Gyro). Leurs sources sont copiées dans [`2026-10-26-design-ui/`](2026-10-26-design-ui/) : `Gyro.dc.html` contient le dessin SVG des 42 tenues, leurs libellés et leurs animations ; `Main.dc.html` la liste des tenues, des animations et des surprises ; `Accueil.dc.html` les trois niveaux de vie.

## Pourquoi

Les premiers écrans de gestion (agents, comités, attributions) arrivent. Avant eux, il faut le socle visuel commun : sinon chaque écran invente ses couleurs, ses boutons et son accessibilité. Le porteur veut une appli de gestion sérieuse, mais **qui vit** : du mouvement, de l'humour, Gyro.

## Décisions du porteur

- **Téléphone et ordinateur comptent autant.** L'appli s'installe sur l'écran d'accueil du téléphone, mais la version ordinateur doit être pensée pour l'ordinateur (place, clavier), pas un téléphone agrandi. Toutes les fonctions marchent partout. On conçoit d'abord pour le téléphone, et un écran n'est fini que soigné aux deux tailles.
- **Accessibilité claire, dès le départ** : viser le RGAA (niveau AA des WCAG). S'inspirer des règles du système de design de l'État (DSFR) sans reprendre son allure.
- **Base visuelle du MVP** `cis-laille` : polices Barlow et Barlow Condensed, rouge pompier, fond gris clair, mode sombre, Gyro.
- **Trois niveaux de vie**, réglables par chaque agent : Sobre, Équilibré, Vivant. **Vivant par défaut.**
- **Gyro** : les 42 tenues, les animations et les surprises de la planche sont gardées (15 tenues du MVP, 27 nouvelles).
- **Pas de mesure d'audience.**

## Les trois niveaux de vie

| | Sobre | Équilibré | Vivant (défaut) |
|---|---|---|---|
| Gyro | absent | présent, tenue du moment, immobile | présent, tenue du moment, animé |
| Animations décoratives | aucune | aucune | oui |
| Textes | neutres | simples | avec humour |

« Réduire les animations » du téléphone ramène Vivant à Équilibré pour le mouvement ; l'humour des textes reste.

## Gyro : le moment et les surprises

- **Tenue du moment**, selon l'heure de Paris : nuit de 23 h à 6 h ; p'tit-déj avant 10 h ; saisons (été de juin à août, hiver de décembre à février) ; fêtes à date fixe (Galette des rois en janvier, Chandeleur le 2 février, 1er avril, bal le 14 juillet, Halloween le 31 octobre, Sainte-Barbe le 4 décembre, Noël du 24 au 26 décembre, Nouvel An le 1er janvier) ; calendriers en novembre et décembre. La journée nationale (date variable, en juin) attend un réglage du centre.
- **Surprise des cinq touches** : sur l'accueil, Gyro est un bouton (« Faire réagir Gyro ») ; cinq appuis rapprochés, au doigt ou au clavier, emballent son gyrophare et font apparaître « pin-pon ! » écrit à côté. Jamais de son.

## Les règles

- **Jamais d'humour ni d'animation dans l'urgence** : alerte, disponibilité immédiate, départ.
- **Une animation à la fois**, courte (moins de 2 s), sauf le décor de l'accueil. Jamais de son.
- **« Réduire les animations » du téléphone respecté** : tout ce qui bouge pour décorer s'arrête ; l'humour reste dans les textes.
- **Gyro n'informe jamais seul** : il accompagne un texte, et chaque tenue a un libellé pour les lecteurs d'écran.
- **Jamais une information portée par la seule couleur** : équipes et statuts ont toujours un texte.
- **Ton** : vouvoiement, complice, jamais moqueur. Référence : « Rien à signaler. Même le gyro est à l'heure. »
- **Anniversaires** : affichés seulement pour les agents qui l'ont accepté (donnée personnelle).

## Ce que livre ce lot

1. **Les jetons** : couleurs (clair et sombre, contrastes AA vérifiés), polices, tailles, espacements, rayons, couleurs des équipes. Le mode sombre suit le téléphone par défaut ; l'agent peut le forcer.
2. **La coquille de l'appli** : en-tête, navigation en bas sur téléphone, menu latéral sur ordinateur, lien « Aller au contenu », repère visible de l'élément actif au clavier. La navigation ne montre que ce qui existe (accueil, affichage) ; chaque fonction y ajoutera son entrée, selon les droits de l'acteur (choix de Claude).
3. **Les composants de base** : bouton, champ avec libellé et message d'erreur, carte, pastille d'équipe (couleur + nom), badge de statut, tableau qui défile dans sa boîte sur petit écran, message « rien à afficher » avec Gyro.
4. **Gyro** en composant : les 42 tenues, leurs animations décoratives, le choix de la tenue selon la date et l'heure (nuit, saisons, fêtes, Sainte-Barbe, 1er avril…), et la surprise des cinq touches. Les tenues liées à des fonctions qui n'existent pas encore (garde, remplacement, anomalie…) sont dessinées mais ne s'affichent qu'avec leur fonction.
5. **Le réglage d'affichage** : niveau de vie (Vivant par défaut) et thème (automatique, clair, sombre), enregistrés **sur l'appareil** (cookie lu par le serveur, donc appliqué dès le premier affichage, avant même la connexion, et aussi pour le super administrateur). Choix de Claude : chacun peut vouloir le sombre sur son téléphone et le clair au bureau.
6. **La connexion et l'accueil** remis à ces fondations. L'accueil ne montre que ce qui existe déjà (bonjour, Gyro, le centre) : pas de fausses données.
7. **Des tests d'accessibilité automatiques** dans la CI, sur chaque page, au format téléphone (390 px) et ordinateur (1280 px), plus la navigation au clavier de la coquille et le respect de « réduire les animations ». Pour les pages réservées, le test se connecte comme un agent : il demande un lien sur l'appli locale et le lit dans les messages du serveur (sans clé Brevo, le courriel y est écrit). **Aucune porte dérobée de test dans le code de l'appli** (choix de Claude).

## Hors périmètre

- Les écrans de gestion (agents, comités, attributions) et l'import des agents par fichier : lots suivants, sur ces fondations.
- Les animations liées à des fonctions à venir (remplacement accepté, check-list complète, anniversaires publiés…) : elles arrivent avec leur fonction.
- La météo (tenues pluie, vent, orage, brouillard, canicule) : dessinée, branchée quand une source météo sera choisie.

## Contraintes

- **Politique de sécurité du contenu (CSP)** : celle déjà en place dans `apps/web/vite.config.ts` est gardée (scripts de l'appli seulement, avec les empreintes gérées par SvelteKit ; styles dans la page permis). Les polices sont donc servies par l'appli, pas par Google Fonts.
- **Cibles tactiles** d'au moins 44 px ; texte agrandissable à 200 % sans perte.
- Rien de propre à un centre dans le code (le nom et les équipes viennent de `centres/<id>/`).
- Dépendances : le moins possible, justifiées (Playwright est déjà prévu par la décision 0003).

## Ce qui reste au constructeur

- Le découpage des composants et des fichiers, les noms des jetons.
- L'outil de test d'accessibilité (par exemple axe avec Playwright) et la façon de lancer le navigateur en CI.
- La façon de servir les polices (fichiers dans l'appli ou paquet), dans le respect de la CSP et de leur licence.
- La reprise du dessin de Gyro depuis le MVP (`cis-laille`, `src/lib/components/Gyro.svelte`) et les maquettes, avec la même allure.
- La règle exacte de choix de la tenue du moment quand plusieurs s'appliquent (par exemple Noël la nuit) : une priorité simple, documentée.
