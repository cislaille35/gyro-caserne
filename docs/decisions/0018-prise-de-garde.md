# 0018 — Prise de garde au téléphone

- **Contexte** : à la relève, l'équipe d'astreinte vérifie tous les engins ; à plusieurs, un seul remplit la fiche ([la spec](../superpowers/specs/2026-11-02-engins-design.md), lot B).
- **Choix** :
  - **Relève** : le moment de prise d'astreinte du réglage du centre (ex. vendredi 18 h). La relève en cours est la dernière commencée ; on peut commencer **2 h avant**. Son équipe vient du planning publié.
  - **Une prise par engin et par relève**, brouillon sur le serveur (`prise_garde`, saisie en JSON) : n'importe quel agent avec `FAIRE_PRISE_DE_GARDE` la reprend ; deux écritures croisées sont gardées par un compteur (le geste est refait une fois sur la saisie relue). Un brouillon d'une relève passée ne se reprend plus : il est effacé (avec ses photos) quand la prise suivante de l'engin commence.
  - **Qui** : `FAIRE_PRISE_DE_GARDE`, donné au profil Agent ; pas limité à l'équipe d'astreinte (un remplaçant ou un renfort fait la prise). La prise enregistre l'équipe d'astreinte de la relève (« Prise faite par l'équipe 2 ») et ses participants ; celui qui valide en fait partie.
  - **Version de fiche** marquée utilisée dès le début de la prise : modifier la fiche pendant une prise crée la version suivante, la prise garde la sienne. L'historique relit la version de son époque.
  - **Anomalie minimale** (`anomalie`) créée à la validation, une par écart (sauf une déjà ouverte sur le même élément de l'engin), avec zone et libellé recopiés et la photo (base PHOTOS, 200 Ko) ; close seulement si l'agent dit « retrouvé » (jamais en silence). Suivi, étapes, indisponibilité et remise en service : lot C.
  - **Retard** : 3 h après la relève, les engins sans prise validée vont dans « À décider » du chef de garde de l'équipe d'astreinte (sinon « Le centre ») ; jamais d'indisponibilité automatique.
- **Pourquoi** : le plus simple qui tient le parcours au téléphone, le travail à plusieurs et l'historique, sans préparer plus que ce que le lot C demande.
- **Validé par** : à valider par le porteur (PR #41).
