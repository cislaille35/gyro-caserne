# 0022 — Une branche pour la refonte de l'interface

- **Contexte** : la refonte touche tous les écrans ; le porteur veut la juger d'un bloc avant qu'elle parte en préprod.
- **Options** : des PR successives vers `main`, ou une branche commune testée à part.
- **Choix** :
  - tous les lots passent par la branche `refonte-ui` : une branche `refonte/<lot>` et une PR par lot, en squash, fusionnée par Claude après review et CI verte ;
  - chaque poussée sur `refonte-ui` donne une version d'essai du Worker de préprod, à l'adresse https://refonte-gyro-caserne-exemple.cis-laille.workers.dev : mêmes bases et mêmes comptes de test, sans tâches planifiées ;
  - aucune migration dans la refonte, et aucun chantier d'écran en parallèle ; les correctifs de `main` sont reportés dans `refonte-ui` ;
  - après le test du porteur, la PR `refonte-ui` → `main` est validée par lui et fusionnée **sans squash**, pour garder un commit par lot. `deployer-refonte.yml` est retiré juste avant.
- **Pourquoi** : un test d'ensemble sans toucher à la préprod, et un lot reste annulable seul après la fusion.
- **Exception** à la décision 0004, limitée à la refonte.
- **Validé par** : le porteur du projet, le 05/11/2026.
- **Terminée** : refonte testée et validée par le porteur le 07/11/2026, fusionnée sur `main` ; `deployer-refonte.yml` retiré. L'adresse d'essai est coupée au déploiement suivant de la préprod : `"preview_urls": false` dans `centres/exemple/wrangler.jsonc` (et dans `centres/laille`), à remettre le jour où une version d'essai redevient utile.
