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
7. Créer la base : `pnpm --filter @gyro-caserne/web exec wrangler d1 create gyro-caserne-<id>`, puis reporter le `database_id` affiché dans `centres/<id>/wrangler.jsonc` (et `database_name` : `gyro-caserne-<id>`).
8. Créer les tables en ligne : `CENTRE=<id> pnpm --filter @gyro-caserne/web base-en-ligne`.
9. Charger le jeu de départ en ligne (une seule fois) : `CENTRE=<id> pnpm --filter @gyro-caserne/web jeu-de-depart --en-ligne`. Sans personne fictive.
10. Poser les secrets, un par un (la valeur est demandée) : `pnpm --filter @gyro-caserne/web exec wrangler secret put <NOM> --config ../../centres/<id>/wrangler.jsonc`.

    | Secret | Valeur |
    |---|---|
    | `BETTER_AUTH_SECRET` | une longue chaîne aléatoire : `openssl rand -base64 32` |
    | `BETTER_AUTH_URL` | l'adresse de l'appli, par exemple `https://gyro-caserne-<id>.<compte>.workers.dev` |
    | `SUPER_ADMINS` | l'adresse du super administrateur (plusieurs : séparées par des virgules) |
    | `RESEND_CLE` | la clé d'API Resend du centre |
    | `COURRIEL_EXPEDITEUR` | l'expéditeur des liens, par exemple `Gyro Caserne <gyro@domaine-du-centre.fr>` |

11. Compiler et déployer : `CENTRE=<id> pnpm deployer`. L'adresse de l'appli s'affiche à la fin (en `….workers.dev`). Si elle diffère de `BETTER_AUTH_URL`, corriger ce secret.

## Mettre à jour

1. Sur GitHub, dans le fork : « Sync fork ». Seul `centres/<id>/` a été modifié, donc il n'y a pas de conflit.
2. En local : `git pull`, puis `pnpm install && pnpm test`. Si un test signale un réglage technique différent de `centres/exemple`, recopier ce réglage dans `centres/<id>/wrangler.jsonc`.
3. Mettre à jour les tables en ligne : `CENTRE=<id> pnpm --filter @gyro-caserne/web base-en-ligne`.
4. `CENTRE=<id> pnpm deployer`.

## Règle

Ne modifier que `centres/<id>/`. Une correction du code commun se propose au dépôt d'origine, pour en faire profiter tous les centres.
