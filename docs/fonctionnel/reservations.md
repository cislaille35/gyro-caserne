# Réservations

## À quoi ça sert

Réserver la VL du centre ou le matériel de l'amicale (tables, bancs…) dans l'appli, qui devient la référence : chacun voit ce qui est déjà promis, et les doubles réservations disparaissent.

## Deux sortes de ressources

| | Matériel de l'amicale | VL |
|---|---|---|
| Qui la déclare | Les membres de l'amicale (Réservations → Gérer le matériel) | Existe d'office, renommable |
| Qui la gère | Les membres du comité Amicale | Le référent engins |
| Forme | Un type d'objet avec un **stock** (« Bancs : 12 ») | Une ressource unique |
| Une demande | Une **quantité**, sur des **jours** (du… au…, inclus) | Un **créneau** (début, fin) |
| Validation | **Toujours** par l'amicale | **Acceptée d'office** si le créneau est libre ; sinon **en attente**, le référent engins tranche |
| Qui réserve | Tous les agents | Les agents et la réserve citoyenne |

C'est la ressource qui dit qui la gère (un rôle ou un comité) : le référent engins ne voit pas les demandes de bancs. Le super administrateur gère tout. La VL fait foi dans l'appli ; le lien avec l'application opérationnelle viendra plus tard.

## Les règles

- **Stock** : une demande de matériel est refusée à la saisie si elle dépasse ce qui reste sur l'un des jours demandés. Les demandes en attente comptent déjà. Le message dit combien il en reste (« Bancs : il en reste 3 le 13 nov. »).
- **États** : en attente → acceptée ou refusée (motif facultatif). Le demandeur annule tant que la période n'a pas commencé ; qui gère annule une réservation acceptée, avec un mot au demandeur.
- **Conflit VL** : accepter une demande qui chevauche une réservation acceptée oblige à choisir : « Garder cette demande » annule l'autre, « Garder l'autre » refuse la demande. Le demandeur écarté est prévenu.
- **Retirer du matériel** : plus aucune demande ; ses réservations à venir sont annulées, leurs demandeurs prévenus.
- Une réservation commence dans moins d'un an et dure 14 jours au plus.
- Les réservations finies depuis plus d'un an sont effacées chaque nuit.

## La réserve citoyenne

Un **compte partagé** (profil « Réserve citoyenne »). Il ne voit que les ressources ouvertes à la réserve (la VL). À chaque réservation, il saisit le nom du demandeur (obligatoire) et un téléphone (facultatif), visibles par qui gère. « Mes réservations » de ce compte montre toutes les réservations faites avec lui, et n'importe qui sur ce compte peut les annuler.

## Les écrans

- **Caserne → Réservations** : « Mes réservations », « À valider » et « Gérer le matériel » (pour qui gère), puis la VL et le matériel.
- **Une ressource** : la semaine au téléphone, le mois à l'ordinateur ; ce qui est pris, par qui, son état, et le stock restant par jour.
- **Réserver** : dates ou créneau, quantité, un mot ; la page dit tout de suite si c'est disponible.
- **Mes réservations** : à venir et passées, avec leur état ; « Annuler ».
- **À valider** : les demandes en attente, « Accepter » ou « Refuser » d'un geste, et les réservations acceptées à venir (« Annuler »). Les mêmes demandes sont dans « À décider » de l'Accueil, sur la casquette Amicale ou Référent engins.

## Notifications

- Une demande (ou une demande VL en attente) sonne une fois au téléphone de qui la gère, puis reste comptée dans sa cloche tant que personne n'a tranché.
- Accord, refus, annulation par qui gère : le demandeur est prévenu (cloche et téléphone).
- Une VL acceptée d'office ne sonne chez personne. « Tout couper » coupe aussi ces notifications.

## Ce que la fonction ne fait pas (encore)

Lien avec l'application opérationnelle pour la VL, remise et retour (clés, état, casse), cautions, réservations récurrentes, export de calendrier.

## Exemple

Le compte de la réserve citoyenne réserve la VL samedi de 9 h à 17 h pour « Mme Durand ». Le créneau est libre : la réservation est acceptée tout de suite. Vendredi, Thomas demande la VL samedi matin : sa demande passe en attente, et le référent engins reçoit une notification. Il ouvre « À valider », voit le conflit et choisit.

Thomas demande 4 bancs du 12 au 14 novembre pour l'anniversaire de sa fille. Il en reste 7 : la demande part à l'amicale. Manon, membre de l'amicale, l'accepte depuis sa casquette Amicale ; Thomas est prévenu.
