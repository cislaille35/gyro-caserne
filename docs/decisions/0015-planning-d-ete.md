# 0015 — Planning d'été, fichier du planning et chef de garde

- **Contexte** : les chefs refaisaient l'été à la main pour armer le FPT, et voulaient préparer l'année d'un coup dans un tableur ([la spec](../superpowers/specs/2026-11-01-planning-ete-design.md)).
- **Choix** :
  - **Plages calculées, écarts stockés** : les plages de l'été sont les tranches d'astreinte (comme les remplacements). On n'enregistre que les écarts à l'équipe de base, par plage (`plage_ete` : `ajoutes`, `retires`, en JSON), comme la convocation à exceptions des manœuvres. Publié, l'été fait foi : `heuresDe` (planning/plages.ts) donne les heures de chacun au planning, à l'Accueil, à l'agenda et aux remplacements.
  - **FPT armé** : un appariement exact personnes–postes (chaînes de réaffectation), six postes, une personne par poste ; chaque niveau d'aptitude couvre les postes en dessous.
  - **Proposition** simple et explicable : plage par plage, vacances retirées, puis un renfort à la fois parmi les moins sollicités, tant qu'il comble une place.
  - **Règles d'armement** : une ligne JSON (`reglage_armement`) ; sans elle, les règles par défaut et les aptitudes du même nom.
  - **Fichier du planning** : écrit et lu dans le navigateur (comme celui de l'effectif), aperçu calculé au serveur, appliqué d'un seul batch (tout ou rien).
  - **Chef de garde** : seul le libellé change (migration 0014) ; l'identifiant interne reste `chef_equipe`.
- **Pourquoi** : peu de données, une seule règle d'astreinte partagée par tous les écrans, aucune dépendance ajoutée, gratuit.
- **Décisions à valider** : voir le compte rendu de la PR #37.
- **Validé par** : le porteur du projet, à la fusion de la PR #37 (02/11/2026).
