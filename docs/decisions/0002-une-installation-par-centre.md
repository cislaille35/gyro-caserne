# 0002 — Une installation par centre

- **Contexte** : l'appli doit pouvoir servir à d'autres centres.
- **Options** :
  - une plateforme commune à tous les centres ;
  - une installation par centre.
- **Choix** : une installation par centre, sur son propre compte Cloudflare gratuit, avec sa propre base. Rien de propre à un centre dans le code : tout est dans `centres/<id>/`.
- **Pourquoi** : données isolées, gratuit pour chaque centre, aucun serveur commun à maintenir.
- **Validé par** : le porteur du projet, le 24/10/2026.
