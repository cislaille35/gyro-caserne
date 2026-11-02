# 0017 — Engins et fiches de prise de garde

- **Contexte** : à la relève, l'équipe d'astreinte vérifie tous les engins sur une fiche par type ; le MVP n'avait ni engin prêté, ni versions, ni fichier ([la spec](../superpowers/specs/2026-11-02-engins-design.md), lot A).
- **Choix** :
  - **La fiche appartient au type d'engin** (VSAV, FPT, VTU au départ, liste ouverte) : un engin prêté du même type reprend la fiche.
  - **Versions sans friction** : une version pas encore utilisée par une prise se corrige sur place ; une version utilisée reste telle quelle, la modification suivante crée la version d'après. Pas de bouton « publier ».
  - **Référence stable** (`ref`) par zone et par élément, d'une version à l'autre, unique dans une version : les anomalies (lot C, par type et `ref`) et le fichier s'y accrochent.
  - **Écritures sûres** : une garde fait échouer l'écriture si la fiche a changé ou servi depuis la lecture.
  - **Qui gère** : `GERER_FICHES` sur le centre, ou être chef de garde (un droit donné sur un comité ne suffit pas). Le chef de garde reçoit le paquet « Engins : Gérer » (`TRAITER_ANOMALIE`, `GERER_FICHES`), verrouillé comme ses autres droits, à côté du chef de centre, de l'adjoint et du référent engins.
  - **Engin** : situation au centre, prêté au centre (avec le centre qui prête) ou parti (sorti de la liste, historique gardé) ; état disponible ou indisponible, décidé au lot C.
  - **Fichier des fiches** : une feuille par type, écrit et lu dans le navigateur comme les autres fichiers, aperçu au serveur, application d'un seul batch.
- **Pourquoi** : le plus simple qui garde l'historique et prépare la prise de garde et les anomalies sans refaire les tables ; aucune dépendance ajoutée.
- **Validé par** : à valider par le porteur (PR #40).
