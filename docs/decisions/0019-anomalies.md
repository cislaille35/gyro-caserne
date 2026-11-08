# 0019 — Suivi des anomalies et indisponibilité décidée

- **Contexte** : un écart signalé à la prise, ou un problème vu hors prise, doit être suivi jusqu'à la réparation ; l'indisponibilité d'un engin est une décision du référent engins, du chef de garde ou du chef de centre, jamais automatique ([la spec](../superpowers/specs/2026-11-02-engins-design.md), lot C ; [anomalies.md](../fonctionnel/anomalies.md)).
- **Choix** :
  - **Étapes** : Signalée → Prise en charge → En attente (pièce commandée, au garage, chez un prestataire, avec une précision) → Réparée (→ Vérifiée par une autre personne si le centre le veut) → Close. On peut sauter des étapes (réparé sur place). Le réglage est dans le fichier du centre (`centres/<id>/centre.ts`) : « en attente » oui, « vérifiée » non, libellés renommables. Pas d'écran de réglage.
  - **Qui** : signaler, prendre en charge : tout agent (profil Agent). Faire avancer : celui qui l'a prise en charge, ou qui traite. Clore sans réparation, rendre l'engin indisponible, le remettre en service : qui a `TRAITER_ANOMALIE` (chef de centre, adjoint, référent engins, chefs de garde).
  - **Indisponibilité** : « Rendre l'engin indisponible » depuis une anomalie ouverte ; « Remettre en service » depuis une anomalie close qui l'a bloqué. Remettre en service lève tous les blocages de l'engin (l'appli prévient s'il en reste d'ouverts). Un signalement seul laisse l'engin disponible ; dans la liste, il passe « Avertissement ».
  - **Prévenus** (cloche et téléphone) : au signalement, ceux qui traitent au centre et le chef de garde de l'équipe d'astreinte (une ligne par prise validée, pas une par écart) ; à chaque étape, le déclarant et qui l'a prise en charge, jamais l'auteur du geste.
  - **Pas de réouverture** d'une anomalie close : on en signale une nouvelle.
  - **Précision du 08/11/2026** : « Close » n'est pas une étape à franchir après « Réparée ». L'anomalie se ferme d'elle-même à « Réparée » (à « Vérifiée » si le centre active cette étape) ; seul « Clore sans réparation » est un geste à part. Voir [anomalies.md](../fonctionnel/anomalies.md), « Le déroulé ».
- **Pourquoi** : le plus simple qui tient le déroulé d'`anomalies.md` et la règle du porteur (décision à part, jamais automatique), sans écran de réglage ni catégories avant d'en avoir besoin.
- **Validé par** : le porteur du projet, à la fusion de la PR #42 (02/11/2026).
