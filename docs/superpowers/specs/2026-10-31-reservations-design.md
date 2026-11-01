# Réservations — design

Date : 2026-10-31. Validé dans la conversation par le porteur (« c'est bon, avance »), y compris les propositions de Claude reprises ici. Les points marqués « choix de Claude » sont venus après.

S'appuie sur le lot **Notifications** (`2026-10-31-notifications-design.md`) : à construire après lui.

## Pourquoi

Le matériel de l'amicale (tables, bancs…) et la VL se demandent aujourd'hui de vive voix, sur Slack ou dans l'application opérationnelle. Personne ne voit ce qui est déjà promis, et les doubles réservations arrivent. L'appli devient la référence.

## Deux sortes de ressources (porteur)

| | Matériel de l'amicale | VL |
|---|---|---|
| Qui la déclare | L'amicale : ses membres créent, modifient, retirent les types d'objets | Existe d'office (une ressource « VL », renommable) |
| Qui la gère | Les membres du comité Amicale | Le référent engins |
| Forme | Un type d'objet avec un **stock** (« Bancs : 12 ») | Une ressource unique |
| Une demande | Une **quantité**, sur des **jours** (du… au…) | Un **créneau horaire** (début, fin) |
| Validation | **Toujours** par l'amicale (accepter / refuser) | **Acceptée d'office** si le créneau est libre ; si un créneau chevauche une réservation existante, elle passe **en attente** et le référent engins tranche |
| Qui peut réserver | Tous les agents | Tous les agents et la réserve citoyenne (qui saisit le nom du demandeur à chaque réservation) |

Pour la VL, l'appli fait foi pour l'instant ; le lien avec l'application opérationnelle sera traité plus tard (porteur).

## Règles

- **Stock** : une demande de matériel est refusée à la saisie si elle dépasse ce qui reste sur l'un des jours demandés, en comptant les réservations **acceptées et en attente** (choix de Claude : une demande en attente bloque déjà sa part, sinon l'amicale accepterait deux demandes incompatibles). Le message dit combien il en reste.
- **États** d'une réservation : en attente → acceptée ou refusée ; le demandeur peut **annuler** tant que la période n'a pas commencé ; un gestionnaire peut annuler une réservation acceptée (avec un mot au demandeur). Refus : motif facultatif.
- **Conflit VL** : accepter une demande en attente qui chevauche une réservation acceptée oblige à choisir laquelle garder (l'autre est refusée ou annulée, le demandeur prévenu).
- Une ressource retirée par l'amicale n'accepte plus de demande ; ses réservations à venir restent visibles et sont annulées avec notification (choix de Claude).
- **Qui gère** (choix de Claude) : c'est **la ressource** qui le dit (« gérée par » un rôle ou un comité), comme le prévoyait le modèle métier : la VL par le titulaire de « Référent engins », le matériel par les membres du comité Amicale. Ainsi le référent engins ne voit pas les demandes de bancs, et aucune attribution existante ne change. Le super administrateur peut tout gérer.
- **Qui réserve** (choix de Claude) : le droit existant `RESERVER` est ajouté au profil Agent (jeu de départ **et** bases existantes, par migration additive). Chaque ressource dit si elle est **ouverte à la réserve citoyenne** (VL : oui ; matériel : non). Pas de droit limité à une ressource dans les écrans de profil.
- **Réserve citoyenne** (porteur) : **un compte partagé** (pour ne pas multiplier les comptes externes). À chaque réservation, il saisit le nom du demandeur (obligatoire) et un téléphone (facultatif, choix de Claude), visibles par le gestionnaire. « Mes réservations » de ce compte montre toutes les réservations faites avec lui ; n'importe qui sur ce compte peut les annuler ; les notifications vont au compte.

## Notifications (porteur, via le lot Notifications)

- Une demande (ou une demande VL en attente) sonne une fois au téléphone de ceux qui la gèrent, puis **reste comptée dans leur cloche tant que personne n'a tranché** (comme une tâche, sur le modèle des signalements ; choix de Claude).
- Accord, refus, annulation par un gestionnaire : sonnent chez le demandeur.
- Une VL acceptée d'office ne sonne chez personne (choix de Claude : rien à faire).
- Ces notifications vont dans la cloche et se coupent par l'interrupteur général (pas de coupure par ressource dans ce lot).

## Écrans (porteur)

- **Caserne → Réservations** : la liste des ressources (VL en tête, puis le matériel), avec « Mes réservations » en haut.
- **Une ressource** : son calendrier (vue semaine au téléphone, mois à l'ordinateur ; choix de Claude), ce qui est pris et par qui, le stock restant par jour pour le matériel ; bouton « Réserver ».
- **Réserver** : formulaire court (dates ou créneau, quantité, mot facultatif) ; on voit tout de suite si c'est disponible.
- **Mes réservations** : à venir et passées, avec leur état, « Annuler ».
- **À valider** (gestionnaires) : les demandes en attente, accepter / refuser d'un geste ; aussi dans « À décider » de l'Accueil, ajouté aux casquettes Amicale et référent engins (choix de Claude).
- **Gérer le matériel** (amicale) : ajouter un type d'objet (nom, stock, icône), modifier le stock, retirer.
- Style : celui des écrans harmonisés (briques `Rangee`, `EnTetePage`, `Vide`…), téléphone d'abord, soigné à 1280, clair et sombre, AA.

## Hors périmètre

Lien avec l'application opérationnelle pour la VL, remise et retour des clés ou du matériel (état, casse), cautions, réservations récurrentes, autres ressources que le matériel de l'amicale et la VL (le modèle doit pourtant permettre d'en ajouter sans tout refaire), export de calendrier.

## Contraintes

- Migrations additives. Budget de requêtes tenu (`routes/budget.test.ts`).
- Jours et heures en heure de Paris, comme le reste.
- Ménage : réservations passées de plus d'un an effacées par la tâche de nuit (choix de Claude, à régler par le centre plus tard).

## Laissé au constructeur

Forme des tables, calcul du stock restant, vue calendrier exacte, textes.
