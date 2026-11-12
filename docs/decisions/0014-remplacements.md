# 0014 — Remplacements, échanges et aptitudes

- **Contexte** : se faire remplacer par l'appli, avec l'accord du collègue et une validation seulement quand une aptitude contrôlée manque ([la spec](../superpowers/specs/2026-11-01-remplacements-design.md)).
- **Choix** :
  - **Tranches calculées** : les périodes d'astreinte du planning, coupées à l'heure de fin du soir (6 h). Rien n'est stocké en plus : une demande garde ses tranches (JSON).
  - **Une table de demandes** pour les trois genres (remplacement, échange de périodes, échange de manœuvre), une table des destinataires (qui l'a reçue, qui l'a écartée) et une table d'avis pour la cloche, sur le modèle des réservations.
  - **Une seule acceptation** : l'écriture n'a lieu que si la demande est encore « en attente » ; on relit ensuite qui l'a eue. Les avis sont écrits dans le même batch, sous condition.
  - **Valideurs** : le rôle système Chef de garde de l'équipe d'astreinte du demandeur (le droit `VALIDER_REMPLACEMENT` y est verrouillé) ; à défaut, chef de centre et adjoint. La cloche les compte en SQL (`remplacements/compte.ts`), les écrans en TypeScript (`valideurs`) ; un test vérifie qu'ils s'accordent.
  - **Convocation à exceptions** : `{ equipes, ajoutes, retires }` dans le JSON des convoqués de la manœuvre et de sa publication ; les anciennes formes (`"tous"`, liste d'équipes) restent valables.
  - **Expiration et relance** par la tâche de chaque minute, un passage sur dix.
  - **Stagiaires jamais remplaçants** (12/11/2026, validé par le porteur) : un agent au statut `stagiaire` (dont les JSP) n'est ni disponible, ni destinataire, ni capable d'accepter, ni dans un échange ; il peut toujours demander à être remplacé (`peutRemplacer`, `remplacements/contexte.ts`).
  - **Aptitudes** : liste du centre (`GERER_LISTES`), aptitudes datées des agents (`GERER_ACCES`), une colonne par aptitude dans le fichier de l'effectif.
- **Pourquoi** : peu de données, une seule règle de disponibilité partagée par la demande, l'acceptation et l'écran, gratuit.
- **Décisions à valider** : voir le compte rendu de la PR #30.
- **Validé par** : le porteur du projet, à la fusion de la PR #30 (01/11/2026).
- **Remplacée en partie** par la [révision du 6 novembre 2026 de 0012](0012-notifications-file-d-envoi.md#révision-du-6-novembre-2026--envoi-immédiat-réveil-toutes-les-cinq-minutes) : plus de tâche de chaque minute, un réveil toutes les cinq minutes ; l'expiration et la relance passent un réveil sur deux (toutes les dix minutes).
