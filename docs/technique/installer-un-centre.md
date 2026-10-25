# Installer l'appli pour un nouveau centre

Chaque centre a sa propre copie de l'appli, sur son propre compte Cloudflare (offre gratuite), avec sa propre base. Voir la décision [0006](../decisions/0006-config-cloudflare-par-centre.md).

## Ce qu'il faut

- Un compte GitHub et un compte Cloudflare au nom du centre (pas d'une personne, pour qu'ils restent au centre).
- Node 24 et pnpm (`corepack enable pnpm`).

## Installer

1. Sur GitHub, créer une copie du dépôt (bouton « Fork »), puis la cloner.
2. Choisir l'identifiant du centre : minuscules, chiffres et tirets (par exemple `bruz`).
3. Copier `centres/exemple` en `centres/<id>`, puis dans ce dossier :
   - `package.json` : `name` devient `@gyro-caserne/centre-<id>` ;
   - `centre.ts` : la description du centre, avec `id: '<id>'` ;
   - `wrangler.jsonc` : `name` devient `gyro-caserne-<id>`.
4. Vérifier : `pnpm install && pnpm check && pnpm test`. Une erreur dans la description est signalée avec la liste des corrections à faire.
5. Se connecter à Cloudflare : `pnpm --filter @gyro-caserne/web exec wrangler login`.
6. Compiler et déployer :
   ```bash
   CENTRE=<id> pnpm build
   CENTRE=<id> pnpm --filter @gyro-caserne/web deployer
   ```
   L'adresse de l'appli s'affiche à la fin (en `….workers.dev`).

## Mettre à jour

1. Sur GitHub, dans le fork : « Sync fork ». Seul `centres/<id>/` a été modifié, donc il n'y a pas de conflit.
2. En local : `git pull`, puis l'étape 6.

## Règle

Ne modifier que `centres/<id>/`. Une correction du code commun se propose au dépôt d'origine, pour en faire profiter tous les centres.
