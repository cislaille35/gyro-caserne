# Réservations

## À quoi ça sert

Réserver la VL du centre ou le matériel de l'amicale, sans double réservation et avec la bonne personne qui tranche en cas de conflit.

## Les notions

- **Ressource réservable** (liste ouverte) : la VL, une remorque, un barnum de l'amicale… Pour chacune, on indique :
  - **qui la gère** : une responsabilité ou un comité (le responsable VL, le rapporteur de l'amicale…) ;
  - **sa règle** :
    - **directe** : un créneau libre est accepté tout de suite, un créneau pris passe en attente ;
    - **sur demande** : chaque réservation attend la décision du gestionnaire ;
  - **quels profils peuvent la réserver**.
- **Réservation** : une ressource, un créneau, un demandeur, un motif, et un statut **demandée → validée / refusée / annulée**.

## Le déroulé

1. Le demandeur ouvre le **calendrier** de la ressource et choisit un créneau.
2. Selon la règle de la ressource :
   - en **directe**, un créneau libre est validé tout de suite, et un créneau déjà pris passe **en attente** ;
   - **sur demande**, la réservation attend toujours.
3. Le gestionnaire valide ou refuse les réservations en attente. Le demandeur est prévenu.

## La VL et la réserve citoyenne

- Règle **directe**, gérée par le responsable de la VL.
- La réserve citoyenne a son propre **profil** (personne extérieure). Son seul droit est `RESERVER_VL` : elle ne voit que le calendrier de la VL et rien d'autre du centre.
- Son adresse fait partie de la liste fermée. Le coordinateur peut utiliser une **adresse commune** : on demande alors **le nom de la personne** à chaque réservation.
- En cas de conflit, y compris face à une demande d'un agent, **le responsable de la VL tranche**.

## Le matériel de l'amicale

- Règle **sur demande**, validée par le rapporteur de l'amicale.

## Ce que la fonction ne fait pas

- Pas de carnet de bord de la VL (kilométrage, carburant) pour l'instant.
- Pas de lien public : un extérieur doit avoir une adresse autorisée.

## Exemple

Le coordinateur de la réserve citoyenne réserve la VL samedi de 9h à 17h, pour « Mme Durand, collecte de sang ». Le créneau est libre : la réservation est validée tout de suite. Vendredi, un agent demande la VL pour samedi matin : sa demande passe en attente, et le responsable de la VL décide.
