# 0027 — L'écusson du centre, déposé par le centre, jamais dans le dépôt

- **Contexte** : le porteur veut montrer l'écusson du centre (celui du SDIS). Il n'a pas encore le droit de l'utiliser, et le dépôt est public.
- **Options** :
  1. un fichier dans `centres/<id>/` : simple, mais l'écusson serait publié dans un dépôt public, sans accord ;
  2. une image déposée dans l'appli par le centre, rangée dans la base des photos.
- **Choix** : option 2. Réglages → « Écusson du centre », pour qui gère les listes du centre (`GERER_LISTES`). Affiché seulement s'il existe, à deux endroits : la connexion et l'en-tête (en petit, devant le nom du centre). Une table d'une ligne `ecusson` (migration additive `0024`) garde l'identifiant de l'image, qui sert de version : `/ecusson?v=<id>`, gardée un an par le navigateur (`public, max-age=31536000, immutable`). L'en-tête lit cette ligne dans le même envoi que la cloche : aucune requête de plus par page.
- **Pourquoi** : aucun emblème officiel dans le dépôt public ; chaque centre décide, avec l'accord de son SDIS ; sans écusson, rien ne change. Les tests et les captures utilisent un dessin neutre généré (un bouclier gris marqué « CIS »).
- **Conséquences** : l'image est publique (connexion) ; seule celle en place est servie, jamais une autre photo. Le ménage de nuit des photos la garde. La connexion fait une petite lecture de plus (une page vue une fois par session).
- **Validé par** : le porteur, 11/11/2026 (cadrage du lot) ; détails à valider dans la PR.
