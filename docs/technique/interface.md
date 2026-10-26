# Interface

Choix d'ensemble : [décision 0008](../decisions/0008-design-interface.md). Maquettes : [`docs/superpowers/specs/2026-10-26-design-ui/`](../superpowers/specs/2026-10-26-design-ui/).

## Jetons

Dans `apps/web/src/app.css`, en variables CSS. On ne met jamais une couleur en dur dans un écran.

| Jeton | Rôle |
|---|---|
| `--fond`, `--surface`, `--trait` | Fond de page, cartes, bordures |
| `--encre`, `--doux` | Texte, texte secondaire |
| `--rouge`, `--sur-rouge`, `--accent` | Rouge pompier (boutons), texte posé dessus, repère de l'entrée active |
| `--focus` | Repère du clavier (contour de 3 px) |
| `--statut-<ok\|info\|alerte\|neutre>-<fond\|texte\|trait>` | Badges de statut |
| `--police`, `--police-titre` | Barlow, Barlow Condensed (servies par l'appli) |
| `--rayon-petit`, `--rayon-grand`, `--cible` | Rayons, taille minimale d'une cible tactile (44 px) |

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

## Coquille

`src/lib/ui/Coquille.svelte` : lien « Aller au contenu » (premier arrêt du clavier), en-tête, navigation en bas sur téléphone et menu latéral à partir de 1024 px, `<main id="contenu">`. L'entrée active porte `aria-current="page"`. Les entrées sont dans `navigation.ts` : chaque fonction y ajoutera la sienne.

## Composants

Dans `src/lib/ui/` :

- `Bouton` : `principal` ou `secondaire`, 44 px de haut au moins.
- `Champ` : libellé toujours visible, message d'erreur relié au champ.
- `Carte` : section titrée.
- `PastilleEquipe` : couleur **et** nom de l'équipe.
- `Statut` : badge avec texte (jamais la couleur seule).
- `Tableau` : défile dans sa boîte sur petit écran, avec une légende.
- `Vide` : message « rien à afficher », avec Gyro.

## Gyro

Dans `src/lib/gyro/` :

- `Gyro.svelte` : le dessin, ses 42 tenues et leurs animations ; `decoratif` le cache aux lecteurs d'écran, sinon il est décrit par le libellé de sa tenue.
- `GyroDuMoment.svelte` : Gyro selon le niveau de vie, dans la tenue du moment.
- `moment.ts` : tenue du moment, à l'heure de Paris. Priorité : fête du jour, nuit (23 h-6 h), p'tit-déj (6 h-10 h), calendriers (novembre et décembre), saison, normal.
- `GyroAccueil.svelte` : sur l'accueil, Gyro est un bouton ; cinq appuis en 2 s (doigt, Entrée ou Espace) allument son gyrophare et affichent « pin-pon ! ».

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

- chaque page (`/connexion`, `/affichage`, et connecté `/`, `/affichage`), en thème automatique et sombre, au téléphone et à l'ordinateur : aucune violation WCAG 2.1 A et AA ;
- premier Tab sur « Aller au contenu », puis Entrée amène au contenu ;
- thème sombre envoyé par le serveur ; aucune animation avec « réduire les animations » ; cinq appuis sur Gyro au clavier.

Avant les tests, `e2e/serveur.ts` recrée la base locale avec les personnes fictives (elle est effacée), lance le serveur de développement à l'adresse `BETTER_AUTH_URL` de `centres/exemple/.dev.vars` (fichier créé avec de fausses valeurs et le port 5174 s'il manque, comme en CI) et se connecte comme `test@exemple.fr` en lisant le lien dans la sortie du serveur (`test-results/serveur.log`). Aucune porte dérobée dans l'appli.

En local, si le Chromium de Playwright n'est pas installé : `CHROMIUM=/usr/bin/chromium pnpm --filter @gyro-caserne/web test:a11y`, sans autre serveur de développement lancé sur le même port.
