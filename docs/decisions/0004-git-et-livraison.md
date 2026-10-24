# 0004 — Git et livraison

- **Contexte** : garder un historique lisible et contrôler ce qui part en production.
- **Options** : pousser directement sur `main`, ou passer par des PR validées.
- **Choix** :
  - `main` protégée, une branche par sujet, une PR validée par le porteur ;
  - fusion en un seul commit par PR (squash) ;
  - chaque fusion sur `main` part en préprod ;
  - la production ne part que d'un tag `vX.Y.Z` sur `main`, posé après accord du porteur.
- **Pourquoi** : une ligne d'historique par sujet, et rien ne part en production sans validation.
- **Validé par** : le porteur du projet, le 24/10/2026.
