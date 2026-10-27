# Interface

Choix d'ensemble : [décision 0008](../decisions/0008-design-interface.md). Maquettes : [`docs/superpowers/specs/2026-10-26-design-ui/`](../superpowers/specs/2026-10-26-design-ui/).

## Jetons

Dans `apps/web/src/app.css`, en variables CSS. On ne met jamais une couleur en dur dans un écran.

| Jeton | Rôle |
|---|---|
| `--fond`, `--surface`, `--trait`, `--trait-doux` | Fond de page (crème en clair), cartes, bordures, bord des cartes et groupes |
| `--encre`, `--doux` | Texte, texte secondaire |
| `--rouge`, `--sur-rouge`, `--accent` | Rouge pompier (boutons), texte posé dessus, repère de l'entrée active |
| `--focus` | Repère du clavier (contour de 3 px) |
| `--statut-<ok\|info\|alerte\|danger\|neutre>-<fond\|texte\|trait>` | Badges de statut, pastilles |
| `--icone-<icône>-<fond\|texte>` | Tuile de chaque icône de rôle |
| `--police`, `--police-titre` | Barlow, Barlow Condensed (servies par l'appli) |
| `--rayon-petit`, `--rayon-grand` (16 px, cartes), `--cible` | Rayons, taille minimale d'une cible tactile (44 px) |

Chaque jeton a sa valeur claire et sombre ; les contrastes AA sont vérifiés par `src/jetons.test.ts`.
Les couleurs d'équipe viennent du centre (`centres/<id>/centre.ts`), jamais du code.

## Réglage d'affichage

Deux cookies, lus par le serveur (`src/lib/affichage.ts`) et posés sur `<html data-theme data-niveau>` avant l'envoi : pas de flash au chargement. Une valeur inconnue est ignorée.

- `theme` : `auto` (suit le téléphone, par défaut), `clair`, `sombre`.
- `niveau` : `sobre`, `equilibre`, `vivant` (par défaut).

Réglés sur l'appareil, à la page `/affichage`, même sans être connecté.

## Niveaux de vie

| | Sobre | Équilibré | Vivant |
|---|---|---|---|
| Gyro | absent | immobile | animé |
| Textes | neutres | simples | avec humour |

`gyroSelonNiveau` (`src/lib/gyro/niveau.ts`) en décide. « Réduire les animations » du téléphone arrête tout mouvement décoratif (règle globale dans `app.css`) ; l'humour des textes reste.

Au niveau Vivant, Gyro bouge à l'arrivée sur une page puis s'immobilise (`mouvement.ts`, minuteur côté client, jamais relancé seul). Sur l'accueil (`GyroAccueil`), le mouvement dure 10 s ; un appui l'arrête, ou le relance 10 s s'il est immobile. Ailleurs (`GyroDuMoment`, `Vide`), 5 s au plus. Aussi arrêtable par la page « Affichage » (Sobre ou Équilibré) ou « réduire les animations » du téléphone (RGAA 13.8 / WCAG 2.2.2).

La tenue « bal » s'affiche les 13 et 14 juillet (les bals ont lieu le 13 ou le 14).

## Coquille

`src/lib/ui/Coquille.svelte` : lien « Aller au contenu » (premier arrêt du clavier), en-tête, navigation en bas sur téléphone et menu latéral à partir de 1024 px, `<main id="contenu">`. L'entrée active porte `aria-current="page"`. Les entrées sont dans `navigation.ts` : chaque fonction y ajoutera la sienne.

## Pages

- `/agents` (`routes/agents/+layout.svelte`) : pour un agent, l'effectif groupé par équipe, avec « Rôles : … » sous le nom (`vueEffectif`) ; pour un gestionnaire (`estGestionnaire` du socle), le tableau avec recherche et filtres (formulaire `GET`, paramètres `texte`, `equipe`, `statut`). Les pages filles (`/agents/<id>`, `/agents/nouveau`) s'affichent à côté de la liste à partir de 1024 px, seules en dessous.
- `/agents/<id>` : la fiche, trois formulaires (`?/fiche`, `?/equipe` avec `equipeId`, `?/statut` avec `confirmation=oui` pour « parti »). Réservée aux gestionnaires (403 sinon) ; fiche protégée : la raison remplace les formulaires. Carte « Responsabilités » (`attributionsDe`) : listes « En cours », « À venir », « Passées » (repliée), « Terminer » et « Changer la date de fin » par rôle en cours ou à venir si `peutTerminer`, formulaire « Attribuer » si `ceQueJePeuxAttribuer` n'est pas vide et que la personne n'est pas partie ; actions `?/attribuer`, `?/terminer` et `?/finir` (module partagé, voir `/nominations`).
- `/agents/nouveau` : ajout, puis redirection vers la fiche.
- `/agents/fichier` : le fichier de l'effectif, réservé aux gestionnaires (403 sinon ; lien « Fichier de l'effectif » en tête de leur liste). « Télécharger le modèle vierge » et « Exporter l'effectif » : le navigateur demande `GET /agents/fichier/donnees[?modele=1]` (`donneesFichier`), écrit le classeur (`lib/fichier-effectif/classeur.ts`, chargé à la demande, jamais côté serveur) et le télécharge. « Importer un fichier » (`.xlsx`) : le navigateur lit le classeur et envoie les lignes à `POST /agents/fichier/apercu` (`apercuImport` ; 2000 lignes au plus), puis affiche l'aperçu (départs en tête avec leur nombre, arrivées, modifications champ par champ, erreurs ligne par ligne, lignes périmées, colonnes ignorées, résumé) avec « Valider » (s'il y a des opérations) et « Abandonner ». « Valider » envoie les opérations une à une à `POST /agents/fichier/operation` (`appliquerOperation`) avec `appliquerTout` (`lib/fichier-effectif/appliquer.ts`) : une erreur saute la suite de sa ligne seulement, les départs d'absents (ligne 0) sont indépendants, trois connexions perdues de suite arrêtent tout. Pendant l'application : avancement « 12 / 48 » affiché, annoncé (`aria-live="polite"`) toutes les 10 opérations et à la fin, focus sur le titre de la carte ; quitter la page demande confirmation (`beforeNavigate`, `beforeunload`) et arrête l'envoi. Puis le compte rendu (focus sur son titre) : appliquées, erreurs avec leur message, lignes non tentées, rappel « Réexportez avant le prochain import », et ce qui n'a pas été appliqué de l'aperçu. Routes JSON : 403 pour un non-gestionnaire, 415 si le corps n'est pas du JSON, 400 `{ message }` pour une donnée refusée par le socle.
- `/profil` : ce que l'agent modifie lui-même ; pas de fiche pour le super administrateur.
- `/reglages` : réglages du centre, pour qui a `GERER_COMITES` ou `GERER_LISTES` sur le centre (403 sinon ; entrée « Réglages » de la navigation pour eux et le super administrateur). Une `Carte` par liste gérée (« Comités » avec `GERER_COMITES`, « Responsabilités » avec `GERER_LISTES`) : un tableau en lecture seule, puis un bloc repliable par ligne (« Modifier ou dissoudre « … » », « Modifier ou archiver « … » ») hors du tableau pour tenir à 390 px, un bloc « Créer… » et une section repliée « Anciens ». Actions : `?/creerComite`, `?/modifierComite`, `?/dissoudreComite`, `?/creerResponsabilite`, `?/modifierResponsabilite`, `?/archiverResponsabilite` ; dissolution et archivage exigent `confirmation=oui` (« Je confirme »), après un avertissement sur le nombre de titulaires. Droits en deux `fieldset` (« Droits métier », « Droits de pouvoir ») ; sans « gère le pouvoir », les cases de pouvoir sont désactivées avec la raison, et une responsabilité qui porte un droit de pouvoir montre la raison au lieu des formulaires. Une case désactivée n'étant pas envoyée, l'action garde les droits verrouillés (et de pouvoir, sans « gère le pouvoir »). Chaque réponse porte une `cible` (`comite-nouveau`, `comite-<id>`, `resp-nouvelle`, `resp-<id>`) : le message s'affiche à côté du bon formulaire, qui reste ouvert en cas d'erreur.
- `/nominations` : pour qui peut attribuer au moins une responsabilité (`ceQueJePeuxAttribuer` non vide ; 403 sinon, redirection vers la connexion si non connecté ; entrée « Nominations » de la navigation, calculée dans le `load` du layout racine par `peutAttribuerQuelqueChose`). Une `Carte` par rôle attribuable : titulaires en cours et à venir (`titulairesDesMiens`, droits lus une fois) avec « Changer la date de fin » et « Terminer » (`confirmation=oui`), puis le formulaire « Nommer » (agent parmi les non-partis, par nom et équipe seulement ; périmètre ; dates). Actions `?/attribuer`, `?/terminer` et `?/finir`, partagées avec la fiche (`lib/server/actions-attribution.ts` ; erreurs traduites par `lib/server/erreurs-attribution.ts`). Cibles des messages : `attribuer-<responsabilité>`, `terminer-<attribution>` et `finir-<attribution>` ; sur « Nominations », la réponse porte aussi `role` (la responsabilité). « Terminer » et « Changer la date de fin » n'acceptent que les titulaires affichés (du rôle du formulaire, ou de la fiche). « Changer la date de fin » ne fait que raccourcir (le socle refuse sinon, erreur sur le champ). Annonces : chaque zone (`role="status"`, `role="alert"`) existe dès le chargement et le message s'y insère, pour être lu ; « Rôle attribué » dans le formulaire d'attribution ; « Rôle terminé » et « Date de fin enregistrée », le rôle pouvant quitter sa liste, dans une zone hors de la liste, en tête de la carte « Responsabilités » sur la fiche, en tête de la carte du rôle sur « Nominations ». Pendant l'envoi, le bouton du formulaire est désactivé, et réactivé quoi qu'il arrive (`finally`).

Les règles de lecture et d'écriture sont dans le socle (`effectif.ts`, `actions/personnes.ts`, `actions/comites.ts`, `actions/responsabilites.ts`) ; la lecture des formulaires de la fiche et de l'ajout est commune (`lib/server/formulaire-agent.ts`) ; `lib/server/formulaire-reglages.ts` traduit les erreurs du socle pour les réglages.

`lib/droits.ts` : `LIBELLES_DROIT`, le libellé en français de chaque droit (« Gérer le stock »), pour les cases à cocher et le tableau. Un droit ajouté au socle doit y recevoir son libellé (le typage l'exige).

## Composants

Dans `src/lib/ui/` :

- `Bouton` : `principal` ou `secondaire`, 44 px de haut au moins ; `onclick` facultatif pour un bouton hors formulaire.
- `Champ` : libellé toujours visible, message d'erreur relié au champ.
- `Choix` : liste déroulante (`<select>`), mêmes règles que `Champ` (libellé, aide, erreur reliés) ; `valeur` se lie avec `bind:`. La sélection n'est pas imposée au navigateur quand la page devient prête (choix de départ par `selected`) : un choix fait avant est gardé et repris dans `valeur`. Ensuite, une nouvelle `valeur` de la page s'applique, et la remise à zéro du formulaire revient au choix de départ.
- `Carte` : section titrée ; avec `ancre`, le titre prend cet id et `tabindex="-1"`, pour y mettre le focus par programme.
- `PastilleEquipe` : couleur **et** nom de l'équipe.
- `Statut` : badge avec texte (jamais la couleur seule).
- `Tableau` : défile dans sa boîte sur petit écran, avec une légende.
- `Vide` : message « rien à afficher », avec Gyro.
- `Groupe` : bloc repliable (fermé par défaut, `bind:ouvert`) ; le titre (`niveauTitre` 2 ou 3) est un bouton `aria-expanded`, le contenu est `hidden` quand il est fermé (ses champs restent dans le formulaire).
- `Pastille` : petit badge de texte, `ton` `ok`, `info`, `alerte`, `danger` ou `neutre`.
- `BarreActions` : barre collée en bas de l'écran (au-dessus de la navigation au téléphone) ; `message` est lu dans sa zone `role="status"`, toujours présente.
- `Initiales` : rond décoratif avec les initiales d'une personne (le nom doit être écrit à côté).
- `IconeRole` : tuile colorée décorative d'un rôle ; les tracés sont dans `icones-roles.ts` (`ICONES_ROLES`), une couleur par icône.

## Gyro

Dans `src/lib/gyro/` :

- `Gyro.svelte` : le dessin, ses 42 tenues et leurs animations ; `decoratif` le cache aux lecteurs d'écran, sinon il est décrit par le libellé de sa tenue.
- `GyroDuMoment.svelte` : Gyro selon le niveau de vie, dans la tenue du moment.
- `moment.ts` : tenue du moment, à l'heure de Paris. Priorité : fête du jour, nuit (23 h-6 h), p'tit-déj (6 h-10 h), calendriers (novembre et décembre), saison, normal.
- `GyroAccueil.svelte` : sur l'accueil, Gyro est un bouton (le dessin ne contient donc aucun texte : un texte visible contredirait le nom du bouton, WCAG 2.5.3) ; cinq appuis en 2 s (doigt, Entrée ou Espace) allument son gyrophare et affichent « pin-pon ! ».

### Ajouter une tenue

1. Dans `tenues.ts`, ajouter la tenue à `TENUES` avec son libellé (lu par les lecteurs d'écran), et si besoin ses yeux, sa bouche et son décalage.
2. Dans `Gyro.svelte`, ajouter son dessin dans un bloc `{#if tenue === '…'}`, en reprenant la planche `Gyro.dc.html`. Une animation passe par une classe `a-…` via `cl` (rien ne bouge si `anime` est faux).
3. Si elle dépend de la date, l'ajouter à `moment.ts` avec son test.

## Règles

- RGAA, niveau AA des WCAG : contraste ≥ 4,5:1 (3:1 pour les grands textes), cibles ≥ 44 px, texte agrandissable à 200 %, tout au clavier avec repère visible, jamais une information par la seule couleur.
- Chaque écran soigné au téléphone (390 px) et à l'ordinateur (1280 px).
- Ni humour ni animation sur les écrans d'urgence.
- Une animation à la fois, courte, jamais de son.
- Polices servies par l'appli : la CSP (`vite.config.ts`) interdit les polices externes.

## Tests d'accessibilité

`pnpm --filter @gyro-caserne/web test:a11y` (Playwright et axe, dans Chromium) :

- chaque page (`/connexion`, `/affichage` ; connecté comme agent `/`, `/affichage`, `/agents`, `/profil` ; connecté comme super administrateur `/agents`, `/agents/nouveau`, `/profil`, `/reglages` et une fiche, avertissement de départ affiché ; `/reglages` aussi avec tous ses blocs ouverts, sans débord horizontal ; `/agents/fichier` avant et après le dépôt d'un fichier), en thème automatique et sombre, au téléphone et à l'ordinateur : aucune violation WCAG 2.1 A et AA ;
- premier Tab sur « Aller au contenu », puis Entrée amène au contenu ;
- thème sombre envoyé par le serveur ; aucune animation avec « réduire les animations » ; cinq appuis sur Gyro au clavier ;
- agents : un agent ordinaire reçoit 403 sur une fiche ; le super administrateur ajoute un agent fictif, le retrouve dans la liste, le déclare parti avec confirmation, et il disparaît de la vue d'un agent.
- fichier de l'effectif : un agent ordinaire reçoit 403 ; le super administrateur télécharge le modèle vierge (vrai téléchargement, relu par `lireClasseur`), y ajoute 2 agents fictifs (`ecrireClasseur`), les importe (aperçu « 2 arrivées »), valide : focus sur « Application en cours », quitter la page demande confirmation (refusée, il reste), focus sur « Compte rendu » sans erreur, agents présents dans la liste. Puis il exporte, retire une ligne, réimporte : « 1 départ » en tête de l'aperçu, avec le bon nom, aucune modification ; il abandonne. Les envois d'opérations sont retenus (`page.route`) le temps de vérifier l'application en cours.
- réglages : un agent ordinaire reçoit 403 ; le super administrateur crée un comité, puis une responsabilité attribuée par ce comité avec « Gérer le stock », dissout le comité avec confirmation, et la responsabilité est alors attribuée par le chef de centre.

Avant les tests, `e2e/serveur.ts` recrée la base locale avec les personnes fictives (elle est effacée), lance le serveur de développement à l'adresse `BETTER_AUTH_URL` de `centres/exemple/.dev.vars` (fichier créé avec de fausses valeurs et le port 5174 s'il manque, comme en CI) et se connecte comme `test@exemple.fr` puis comme le super administrateur fictif `admin@exemple.fr` (il doit figurer dans `SUPER_ADMINS`, sinon les tests s'arrêtent), en lisant le lien dans la sortie du serveur (`test-results/serveur.log`). Une session gardée par compte : un seul lien par minute et par adresse. Aucune porte dérobée dans l'appli. Si `.dev.vars` contient une `BREVO_CLE=` non vide, les tests s'arrêtent avec une erreur : les tests locaux ne doivent jamais envoyer de vrais e-mails.

En local, si le Chromium de Playwright n'est pas installé : `CHROMIUM=/usr/bin/chromium pnpm --filter @gyro-caserne/web test:a11y`, sans autre serveur de développement lancé sur le même port.
