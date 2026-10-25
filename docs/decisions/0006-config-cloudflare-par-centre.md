# 0006 — Config Cloudflare par centre, un fork par centre

- **Contexte** : chaque centre a sa propre installation (voir 0002). La config Cloudflare (nom de l'appli, base D1, stockage R2, adresse) lui est propre, et un centre installe l'appli seul en suivant la doc, puis récupère nos mises à jour.
- **Options** :
  - une config Cloudflare commune avec une section par centre : chaque centre écrirait dans le code commun ;
  - la config générée à la compilation : du code en plus, pour rien ;
  - un fichier `centres/<id>/wrangler.jsonc` par centre.
- **Choix** :
  - chaque centre a sa copie du dépôt sur GitHub (un fork) et n'y modifie que `centres/<id>/` : `centre.ts` et `wrangler.jsonc` ;
  - il récupère nos mises à jour avec « Sync fork », sans conflit ;
  - la compilation et le déploiement lisent la config du centre choisi par `CENTRE` ;
  - sur le compte du CIS Laillé : `gyro-caserne-exemple` (préprod et démonstration, données fictives) et `gyro-caserne-laille` (production). Deux adresses, deux bases, rien de mélangé.
- **Pourquoi** : le code commun ne connaît aucun centre, et un centre se met à jour en un clic. La démo ne risque jamais de toucher les vraies données.
- **Validé par** : le porteur du projet, le 25/10/2026.
