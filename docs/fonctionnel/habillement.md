# Habillement

> **Livré** : les demandes de tenue, de la demande à la livraison. Cadrage : [la spec](../superpowers/specs/2026-11-08-habillement-design.md), qui l'emporte en cas d'écart. Remplace le canal Slack « habillement ».

## À quoi ça sert

Un agent demande une pièce de tenue en quelques secondes, en texte libre, et suit sa demande jusqu'à la livraison. Le référent habillement voit ce qu'il a à traiter dans sa casquette.

## Les étapes

1. **Demandée** : l'agent l'envoie (Caserne → Habillement, un seul champ : « Quelle pièce, quelle taille, pourquoi ? »). Il peut en avoir plusieurs en cours.
2. **Prise en compte** par un référent : l'agent voit qui s'en occupe. Elle n'apparaît plus « à prendre en compte » chez les autres référents.
   - **Question posée** : le référent pose une question ; quand l'agent répond, la demande repasse « Prise en compte ». Autant de fois que nécessaire.
3. **Traitée** : **En stock** (sortie du stock du centre), **Commandée au SDIS**, ou **Refusée** avec un mot obligatoire (fin de la demande).
4. **Livrée**, avec l'endroit où la récupérer : « À récupérer au centre », « Dans votre casier » ou un mot libre. Fin de la demande.

Le **fil**, sous la demande : questions, réponses, précisions et changements d'étape, dans l'ordre. L'agent peut ajouter une précision tant que la demande n'est ni livrée, ni refusée, ni annulée, et l'**annuler** (avec confirmation) tant qu'elle n'est ni commandée ni sortie du stock.

## Qui voit, qui agit

- **Demander** : tout agent du centre connecté, sans droit particulier (pas le compte de la réserve citoyenne, pas le super administrateur).
- **Voir une demande** : l'agent qui l'a faite, les référents habillement, le chef de centre et l'adjoint.
- **Agir** (prendre en compte, questionner, traiter, livrer) : qui a le droit **Gérer l'habillement** : le rôle « Référent habillement », et le chef de centre et l'adjoint (droit verrouillé), pour qu'une demande ne reste jamais bloquée. Le droit peut être donné à n'importe quel rôle (Réglages, domaine « Habillement »).
- **Je la reprends** : un autre référent (ou le chef, l'adjoint) reprend d'un geste une demande suivie par un collègue absent ; la reprise est dans le fil, et le collègue en est prévenu.
- Un **référent nommé** tient un rôle qui porte le droit. Un droit donné par un profil permet d'agir, sans recevoir les demandes ni avoir de casquette.

## Notifications (cloche et téléphone)

- **L'agent** : à chaque étape (prise en compte, traitée — avec le mot du référent s'il en a mis un —, refusée, livrée) et à chaque question. Ouvrir sa demande marque ces notifications lues.
- **Les référents** : chaque nouvelle demande (un référent qui demande pour lui-même et seul : le chef et l'adjoint à sa place). Une réponse ou une précision de l'agent va au référent qui suit la demande ; tant que personne ne la suit, à tous les référents. Une annulation prévient celui qui la suivait.
- **Le chef et l'adjoint** : rien, sauf si aucun référent n'est nommé. Ils reçoivent alors les nouvelles demandes, et les réponses sur celles qu'ils suivent eux-mêmes.

## Points d'entrée

- **Caserne → Habillement** : faire une demande, mes demandes (en cours, puis terminées).
- **Accueil, casquette « Référent habillement »** : dans « À décider », les demandes à prendre en compte et celles qu'on suit dont la réponse est arrivée ; un raccourci vers toutes les demandes. Sans référent nommé, la même chose dans « Le centre » du chef et de l'adjoint (« Habillement » dans « Gérer »). Les demandes commandées attendent leur livraison dans « Toutes les demandes », pas dans « À décider ».
- **Comités et référents** : le référent habillement y apparaît avec ses titulaires.

## Ce que la fonction ne fait pas

- Pas d'inventaire : « En stock » est seulement une issue.
- Pas de tailles mémorisées sur la fiche, pas de catalogue, pas de photo, pas de lien avec un outil du SDIS.
- Pas de validation par le chef avant traitement.

## Conservation

Les demandes livrées, refusées ou annulées sont effacées, avec leur fil, 24 mois après leur fin (tâche de nuit), comme les publications.

## Exemple

Alice écrit « Veste textile en L, la mienne est déchirée à la manche ». Chloé, référente habillement, la voit dans sa casquette, la prend en compte et demande « Plutôt en L ou en XL ? ». Alice répond « L ». Chloé la commande au SDIS, puis, à l'arrivée du colis, la livre « Dans votre casier ». Alice a été prévenue à chaque étape.
