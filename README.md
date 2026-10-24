# Gyro Caserne

L'appli de la vie d'un centre d'incendie et de secours : astreintes, remplacements, prise de garde, anomalies, salons et notifications. Elle s'installe sur le téléphone (PWA) et elle est réservée aux agents du centre.

Gyro, le gyrophare rouge, en est la mascotte.

Le MVP [`cis-laille`](https://github.com/cislaille35/cis-laille) sert de référence fonctionnelle : l'appli est réécrite ici de zéro, pour pouvoir servir à n'importe quel centre.

## Un centre, une installation

- Le code est commun à tous les centres. Rien de propre à un centre n'y est écrit.
- Ce qui distingue un centre (nom, commune, équipes, rotation d'astreinte…) est décrit dans `centres/<id>/centre.ts`.
- Chaque centre déploie sa propre copie, sur son propre compte Cloudflare (offre gratuite) avec sa propre base : les données d'un centre ne sont jamais mélangées à celles d'un autre.

Laillé est le premier centre décrit : `centres/laille/centre.ts`.

## Organisation du dépôt

```
apps/web           l'appli (SvelteKit sur Cloudflare Workers)
packages/centre    la description d'un centre et sa validation
centres/laille     la description du CIS de Laillé
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
pnpm dev          # appli en développement, http://localhost:5173
pnpm check        # types
pnpm test         # tests
pnpm build        # compilation
```

Pour construire l'appli d'un autre centre : `CENTRE=<id> pnpm build`, avec `centres/<id>/centre.ts`.

Pour l'essayer dans le moteur Cloudflare local, après `pnpm build` : `pnpm --filter @gyro-caserne/web exec wrangler dev`.

## Ajouter un centre

1. Copier `centres/laille` en `centres/<id>`, et changer le `name` de son `package.json`.
2. Remplir `centre.ts`. Une description incorrecte (date de référence qui ne tombe pas le jour de prise, couleur invalide…) est refusée dès la compilation, avec la liste des erreurs.
3. `CENTRE=<id> pnpm build`.

## Licence

[MIT](LICENSE) : chaque centre peut reprendre le code librement.
