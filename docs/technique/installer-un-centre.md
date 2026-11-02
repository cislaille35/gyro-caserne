# Installer l'appli pour un nouveau centre

Chaque centre a sa propre copie de l'appli, sur son propre compte Cloudflare (offre gratuite), avec sa propre base. Voir la décision [0006](../decisions/0006-config-cloudflare-par-centre.md).

## Ce qu'il faut

- Un compte GitHub et un compte Cloudflare au nom du centre (pas d'une personne, pour qu'ils restent au centre).
- Un ordinateur sous Linux, macOS, ou Windows avec WSL.
- Node 24 et pnpm (`corepack enable pnpm`).

## Installer

1. Sur GitHub, créer une copie du dépôt (bouton « Fork »), puis la cloner.
2. Choisir l'identifiant du centre : minuscules, chiffres et tirets (par exemple `bruz`).
3. Copier `centres/exemple` en `centres/<id>`, puis dans ce dossier :
   - `centre.ts` : la description du centre, avec `id: '<id>'` ;
   - `wrangler.jsonc` : `name` devient `gyro-caserne-<id>`.
4. Vérifier : `pnpm install && pnpm check && pnpm test`. Une erreur dans la description est signalée avec la liste des corrections à faire.
5. Enregistrer le dossier dans le fork : `git add centres/<id> && git commit -m "Centre <id>" && git push`.
6. Se connecter à Cloudflare : `pnpm --filter @gyro-caserne/web exec wrangler login`.
7. Créer le sous-domaine `workers.dev` du compte, s'il n'existe pas : ouvrir une fois « Workers & Pages » dans le tableau de bord Cloudflare (ou le choisir dans Workers › « Change subdomain »). Il entre dans l'adresse de l'appli : `gyro-caserne-<id>.<sous-domaine>.workers.dev`. Pour Laillé : `cis-laille`. Compter quelques minutes avant de l'utiliser (le temps de son certificat).
8. Créer les deux bases (voir [0010](../decisions/0010-photos-dans-leur-base.md)) et reporter chaque `database_id` affiché dans `centres/<id>/wrangler.jsonc` :
   - la base principale : `pnpm --filter @gyro-caserne/web exec wrangler d1 create gyro-caserne-<id>`, liaison `BASE`, `database_name` : `gyro-caserne-<id>` ;
   - la base des photos : `pnpm --filter @gyro-caserne/web exec wrangler d1 create gyro-caserne-<id>-photos`, liaison `PHOTOS`, `database_name` : `gyro-caserne-<id>-photos`.
9. Créer les tables en ligne, dans les deux bases : `CENTRE=<id> pnpm --filter @gyro-caserne/web base-en-ligne`. Pour tout ce qui est en ligne (`base-en-ligne`, `jeu-de-depart --en-ligne`, `deployer`), `CENTRE` est obligatoire : sans lui, la commande s'arrête tout de suite avec un message.
10. Charger le jeu de départ en ligne (une seule fois) : `CENTRE=<id> pnpm --filter @gyro-caserne/web jeu-de-depart --en-ligne`. Sans personne fictive.
11. Compiler et déployer : `CENTRE=<id> pnpm deployer`. L'adresse de l'appli s'affiche à la fin (en `….workers.dev`). L'appli ne marche qu'une fois les secrets posés.
12. Poser les secrets, un par un (la valeur est demandée) : `pnpm --filter @gyro-caserne/web exec wrangler secret put <NOM> --config ../../centres/<id>/wrangler.jsonc`. Ils s'appliquent tout de suite, sans redéployer.

    | Secret | Valeur |
    |---|---|
    | `BETTER_AUTH_SECRET` | une longue chaîne aléatoire : `openssl rand -base64 32` |
    | `BETTER_AUTH_URL` | l'adresse de l'appli, affichée à l'étape 11 |
    | `SUPER_ADMINS` | l'adresse du super administrateur (plusieurs : séparées par des virgules) |
    | `BREVO_CLE` | la clé d'API Brevo du centre |
    | `COURRIEL_EXPEDITEUR` | l'adresse d'expédition vérifiée dans Brevo, par exemple la boîte du centre (le nom « Gyro Caserne » est ajouté par l'appli). Voir [0007](../decisions/0007-brevo.md) |
    | `VAPID_PUBLIQUE` et `VAPID_PRIVEE` | les clés des notifications au téléphone, propres au centre : `pnpm --filter @gyro-caserne/web cles-vapid` les affiche (une paire neuve à chaque fois, jamais écrite sur le disque). Sans elles, l'appli marche, sans notifications au téléphone. Les changer plus tard oblige chaque agent à réactiver les notifications sur ses appareils |
    | `VIGILANCE_CLE` | facultatif : la clé de l'API Vigilance de Météo-France. Créer un compte gratuit sur portail-api.meteofrance.fr, s'abonner à l'API « Données Publiques Vigilance », puis générer une clé d'API (« API Key », de longue durée). Avec `departement` dans `centres/<id>/centre.ts`. Sans elle, l'appli marche, sans bandeau de vigilance ni alerte rouge ; la météo du centre (Open-Meteo) ne demande pas de clé |

## Déploiement automatique (facultatif)

Pour que GitHub déploie tout seul :

1. Dans Cloudflare, créer un jeton d'API (« Create Custom Token ») avec les droits Account › Workers Scripts : Edit, Account › D1 : Edit et Account › Account Settings : Read.
2. Dans le fork, onglet Settings › Secrets and variables › Actions :
   - secrets `CLOUDFLARE_API_TOKEN` (le jeton) et `CLOUDFLARE_ACCOUNT_ID` (affiché sur la page d'accueil du compte Cloudflare) ;
   - variable `CENTRE_PRODUCTION` = `<id>` ; et, pour une préprod, `CENTRE_PREPROD` = l'identifiant de son centre de démonstration.
3. Facultatif, pour que le déploiement pose aussi les clés des notifications : secrets `VAPID_PUBLIQUE_PRODUCTION` et `VAPID_PRIVEE_PRODUCTION` (et `…_PREPROD` pour une préprod), avec des paires créées par `pnpm --filter @gyro-caserne/web cles-vapid`. Par exemple, sans afficher la clé privée : `node --experimental-transform-types apps/web/scripts/cles-vapid.ts | while IFS='=' read -r nom valeur; do printf %s "$valeur" | gh secret set "${nom}_PRODUCTION"; done`.
4. Ensuite : chaque mise à jour de `main` déploie la préprod ; un tag `vX.Y.Z` posé sur `main` déploie la production.

`centres/exemple` sert à la fois de modèle et de préprod pour le CIS Laillé : ses `database_id` sont ceux de Laillé. En le copiant (étape 3 de l'installation), remplacer les deux `database_id` par ceux des nouvelles bases (étape 8).

## Mettre à jour

1. Sur GitHub, dans le fork : « Sync fork ». Seul `centres/<id>/` a été modifié, donc il n'y a pas de conflit.
2. En local : `git pull`, puis `pnpm install && pnpm test`. Si un test signale un réglage technique différent de `centres/exemple`, recopier ce réglage dans `centres/<id>/wrangler.jsonc`.
3. Mettre à jour les tables en ligne (les deux bases) : `CENTRE=<id> pnpm --filter @gyro-caserne/web base-en-ligne`. Si la mise à jour ajoute la base des photos (décision 0010), la créer d'abord comme à l'étape 8.
4. `CENTRE=<id> pnpm deployer`.

## Règle

Ne modifier que `centres/<id>/`. Une correction du code commun se propose au dépôt d'origine, pour en faire profiter tous les centres.
