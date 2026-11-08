# 0026 — Deuxième passe de la refonte : direction B

- **Contexte** : l'audit du 08/11/2026 trouve une interface propre, mais qui ressemble à beaucoup d'interfaces générées par IA, avec plusieurs versions du même composant. Cadrage : [`design.md`](../superpowers/specs/2026-11-08-refonte-ui-2/design.md).
- **Options** : A, garder l'habillage actuel ; B, neutre (fond gris clair, cartes plates, vrais titres, icônes sans tuile, ni halo ni dégradé) ; C, tableau de garde (comme B, listes sans carte sous un filet fort).
- **Choix** :
  - la direction **B**, qui remplace le complément de la décision 0008 pour le fond, les cartes et les tuiles ; le reste de l'identité ne change pas ;
  - le dispositif de la décision 0022 pour le temps de la refonte : une branche `refonte/<lot>` et une PR par lot vers `fonction/refonte-ui`, en squash, fusionnée par Claude après review et CI verte ; le porteur juge l'ensemble et valide la PR vers `main`, fusionnée sans squash ;
  - une version d'essai à https://refonte-gyro-caserne-exemple.cis-laille.workers.dev, à chaque poussée sur la branche (`deployer-refonte.yml`) : mêmes bases que la préprod, liens de connexion vers elle, sans tâches planifiées. `preview_urls: true` pour le centre `exemple` seul, appliqué par le déploiement de préprod qui suit la fusion de ce réglage sur `main` ;
  - sur `main`, plus de chantier d'écran ni de migration jusqu'à la fin ; les correctifs urgents passent et sont reportés dans la branche.
- **Pourquoi** : B retire le plus visible de l'effet « généré » à moindre risque, et le porteur a préféré cette direction après les avoir comparées sur l'accueil, le Planning et Échanges. Le dispositif permet un test d'ensemble sur téléphone sans toucher à la préprod.
- **Exception** à la décision 0004, limitée à cette refonte. À la fin : retirer `deployer-refonte.yml`, remettre `preview_urls: false`, noter ici « terminée ».
- **Validé par** : le porteur du projet, le 08/11/2026.
