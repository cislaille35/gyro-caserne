# Remplacement court (2 ou 3 h) — design

Cadré avec le porteur le 19/11/2026.

## Pourquoi

Un agent a souvent besoin d'être remplacé 2 ou 3 h pendant son astreinte, pour une raison personnelle. Aujourd'hui, un remplacement porte sur une tranche entière (nuit de 18 h à 6 h, garde de 24 h). Exemple du porteur : astreinte de 18 h 30 à 23 h, besoin d'un remplaçant de 20 h à 22 h.

## Objectifs

- « Remplacement court » : une plage de **2 h ou 3 h** dans l'astreinte du jour de l'agent, avec l'heure de début au quart d'heure, éventuellement déjà commencée.
- Envoyé d'office à tous les disponibles, sans cibler personne. Ceux qui ont les aptitudes contrôlées du demandeur viennent en tête (comme pour une demande ouverte).
- **Conclu dès qu'un agent accepte** ; le premier l'emporte.
- S'il manque au remplaçant une aptitude contrôlée que le demandeur a, le chef de garde reçoit une **urgence** (« Marc remplace Julie de 20 h à 22 h, il lui manque CA1 ») avec « Je laisse » et « Je refuse ».
- Le **demandeur** peut aussi refuser le remplaçant qui a accepté, jusqu'au début de la plage (demande du porteur).
- **Sans refus, le remplacement tient** (décision du porteur). Plus de refus possible une fois la plage commencée.
- Un refus annule le remplacement : le titulaire reste d'astreinte et il est prévenu par une urgence ; le remplaçant aussi. La demande ne repart pas d'elle-même.
- Le planning, la plaque d'astreinte, l'agenda et le chef de garde montrent « Marc de 20 h à 22 h ».

## Non-objectifs

- Pas de durée libre ni de plusieurs plages par demande ; pas d'échange court.
- Rien ne change pour les remplacements longs : le chef valide avant quand une aptitude manque.

## Anti-objectifs

- Réveiller tout le centre pour 2 h : seuls les disponibles sont prévenus, comme aujourd'hui.
- Plus de calcul par page : la demande courte suit les mêmes lectures qu'une demande ouverte (offre gratuite Cloudflare).

## Approches

- **Choisie** : un genre de demande « court » dans `demande_remplacement`, avec une période `{ debut, fin }` à l'intérieur d'une tranche (le modèle garde déjà l'heure à la minute) ; contrôle des aptitudes après l'acceptation, refus possible du chef ou du demandeur jusqu'au début.
- **Écartée** : heure libre au pas de 30 minutes sur toute demande (plus d'écran et de cas, sans gain de calcul).
- **Écartée** : validation du chef avant (trop lente sur un court délai).

## Contraintes

- Livré après la mise en production du lot des notifications (urgences, v1.3.0) : il en réutilise le lieu « urgences ».
- Charte, RGAA, téléphone d'abord ; migration additive seulement ; tests de budget verts.

## Laissé au constructeur

- Le stockage du genre « court » et de l'état « refusée après coup ».
- Le tracé exact de la plage dans le planning et la plaque d'astreinte.
- Les phrases des notifications, dans l'esprit de celles ci-dessus.
