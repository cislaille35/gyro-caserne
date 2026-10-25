# Gyro Caserne

L'appli de la vie d'un centre d'incendie et de secours : astreintes, remplacements, prise de garde, anomalies, salons et notifications. Elle s'installe sur le téléphone (PWA) et elle est réservée aux agents du centre.

Gyro, le gyrophare rouge, en est la mascotte.

Le MVP [`cis-laille`](https://github.com/cislaille35/cis-laille) sert de référence fonctionnelle : l'appli est réécrite ici de zéro, pour pouvoir servir à n'importe quel centre.

## Un centre, une installation

- Le code est commun à tous les centres. Rien de propre à un centre n'y est écrit.
- Ce qui distingue un centre est dans `centres/<id>/` : sa description (`centre.ts` : nom, équipes, rotation d'astreinte…) et sa config Cloudflare (`wrangler.jsonc`).
- Chaque centre déploie sa propre copie, sur son propre compte Cloudflare (offre gratuite) avec sa propre base : les données d'un centre ne sont jamais mélangées à celles d'un autre.

Laillé est le premier centre décrit : `centres/laille/centre.ts`. `centres/exemple` est un centre fictif : il sert de modèle et de centre par défaut en développement.

## Organisation du dépôt

```
apps/web           l'appli (SvelteKit sur Cloudflare Workers)
packages/centre    la description d'un centre et sa validation
packages/socle     personnes, profils, droits : base et actions protégées
centres/laille     la description du CIS de Laillé
centres/exemple    un centre fictif, modèle pour en décrire un nouveau
```

## Documentation

- [Technique](docs/technique/README.md) : architecture, technos, versions.
- [Fonctionnelle](docs/fonctionnel/README.md) : ce que fait chaque fonction.
- [Aide aux agents](docs/utilisation/README.md) : comment utiliser l'appli.
- [Décisions](docs/decisions/) : les choix faits, et pourquoi.
- [Règles de travail](CLAUDE.md).

## Développement

Il faut Node 24 (voir `.nvmrc`) et pnpm, activé par `corepack enable pnpm`.

```bash
pnpm install
cp apps/web/.dev.vars.exemple centres/exemple/.dev.vars   # secrets de développement, à compléter
pnpm --filter @gyro-caserne/web base-locale               # crée la base locale (migrations)
pnpm --filter @gyro-caserne/web jeu-de-depart              # jeu de départ fictif dans la base locale
pnpm dev          # appli en développement, http://localhost:5173
pnpm check        # types
pnpm test         # tests
pnpm build        # compilation
```

Sans `CENTRE`, l'appli est construite pour le centre fictif `exemple`. Pour un vrai centre : `CENTRE=<id> pnpm build`, avec `centres/<id>/centre.ts`.

Pour l'essayer dans le moteur Cloudflare local : `pnpm --filter @gyro-caserne/web preview` (avec `CENTRE=<id>` pour un autre centre).

## Ajouter un centre

Voir [Installer l'appli pour un nouveau centre](docs/technique/installer-un-centre.md) : une copie du dépôt (fork) par centre, où seul `centres/<id>/` change.

Une description incorrecte (date de référence qui ne tombe pas le jour de prise, couleur invalide…) est refusée par `pnpm check`, `pnpm test` et la compilation, avec la liste des erreurs.

## Licence

[MIT](LICENSE) : chaque centre peut reprendre le code librement.
