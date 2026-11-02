# Anomalies

> **Livré (lot C des engins)** : le suivi des anomalies des engins, voir « Ce que fait le lot C » plus bas. Pas encore : catégories (pharmacie, bâtiment…), priorité, réouverture. Cadrage : [la spec](../superpowers/specs/2026-11-02-engins-design.md), qui l'emporte en cas d'écart.

## À quoi ça sert

Signaler un problème (sur un engin, un contenant comme un sac, un local ou du matériel), le faire réparer et savoir à tout moment ce qui est en cours et ce qui empêche d'utiliser un engin.

## Les notions

- **Objet concerné** : un engin, un contenant (un sac, par exemple), un local ou du matériel.
- **Catégorie** (liste ouverte) : engin, pharmacie, bâtiment, amicale… Elle **décide qui est prévenu**, par exemple le référent pharmacie pour une anomalie de la catégorie pharmacie.
- **Effet sur l'engin**, seulement pour un engin ou un contenant :
  - **bloquant** : l'engin est indisponible jusqu'à sa remise en service ;
  - **avertissement** : l'engin reste utilisable, mais un bandeau prévient tous ceux qui l'ouvrent (« Treuil HS, ne pas utiliser ») ;
  - **aucun**.
- **Priorité de traitement** : faible, normale ou haute. Elle est indépendante de l'effet sur l'engin. L'appli propose « haute » quand c'est bloquant, mais on peut la changer.

## Le déroulé

Les étapes sont fixes. Le centre active ou non les étapes « en attente » et « vérifiée », et peut renommer les libellés.

1. **Signalée** : depuis une prise de garde ou directement, avec une photo et une note.
2. **Prise en charge** : un agent compétent se l'attribue (droit `PRENDRE_EN_CHARGE_ANOMALIE`). Par défaut, tout agent peut le faire ; le centre peut réserver ce droit à une responsabilité, par exemple référent engins.
3. **En attente**, avec un motif visible dans la liste : pièce commandée, au garage, prestataire. La date de départ et la date de retour sont notées.
4. **Réparée** : sur place ou au retour du garage, avec ce qui a été fait.
5. **Vérifiée** par une autre personne, seulement si le centre active cette étape.
6. **Close** (droit `TRAITER_ANOMALIE`, ou la personne qui a réparé). Pour un engin indisponible, l'appli demande : **« Remettre l'engin en service ? »** La réponse est une décision à part, car une autre anomalie peut rester bloquante.

On peut **rouvrir** une anomalie close. L'auteur et la personne qui l'a prise en charge sont prévenus à chaque changement d'étape.

## Les règles

- Un engin est indisponible tant qu'il a **au moins une** anomalie bloquante non close, sauf si on l'a explicitement remis en service.
- **Pas d'indisponibilité automatique** parce qu'une vérification est en retard : ça crée de faux arrêts.
- Une prise de garde ne crée pas d'anomalie en double sur un élément qui en a déjà une ouverte.
- Quand la prise de garde suivante retrouve l'élément en ordre, l'appli propose de clore l'anomalie.

## Ce que la fonction ne fait pas

- Pas de gestion du garage ni des devis : l'anomalie note seulement le départ et le retour.
- Pas de commande de pièces.

## Exemple

À la prise de garde, l'agent trouve le treuil du VTU en panne. Il le signale en avertissement : le VTU reste disponible, avec le bandeau « Treuil HS ». Le référent engins prend l'anomalie en charge et la met en attente, motif « au garage », avec une date de départ. Au retour, il la passe à réparée, puis la clôt. Le bandeau disparaît.

## Ce que fait le lot C

- **Signaler** : à la prise de garde (chaque écart devient une anomalie), ou directement depuis l'engin : **Signaler un problème**, une phrase, valider (note et photo facultatives). L'engin **reste disponible**.
- **Prévenus** : le référent engins, le chef de centre et son adjoint, et le chef de garde de l'équipe d'astreinte (cloche et téléphone). Ensuite, le déclarant et celui qui l'a prise en charge apprennent chaque étape.
- **Suivre** : Caserne → Anomalies (ou Engins → Anomalies, ou la page de l'engin) : les ouvertes d'abord, engin par engin, avec leur étape ; puis les closes récentes. La page d'une anomalie montre les étapes du centre, l'historique (qui, quand, quoi) et les gestes permis : **Je la prends en charge**, **Mettre en attente** (pièce commandée, au garage, chez un prestataire), **Réparée** (ce qui a été fait), **Clore sans réparation** (qui traite).
- **Décider** (référent engins, chefs de garde, chef de centre et adjoint) : **Rendre l'engin indisponible** depuis l'anomalie ; une fois close, **Remettre en service**, décision à part. Jamais d'indisponibilité automatique.
- **Sur l'engin** : un bandeau « Avertissement : 1 anomalie ouverte » (ou « VTU est indisponible ») avec chaque anomalie et son étape ; dans la liste des engins, l'état écrit : Disponible, Avertissement ou Indisponible.
- **À la relève suivante**, la prise montre l'étape de chaque anomalie ouverte ; « Oui, clore le signalement » la clôt (retrouvée), et le déclarant est prévenu.
- **Accueil, « À décider »** pour ceux qui traitent : « 2 anomalies signalées à prendre en charge : VSAV 1, VTU » et « VTU indisponible, anomalie close : remettre en service ? ».
- **Réglage du centre** (dans son fichier de description) : étape « en attente » (oui par défaut), étape « vérifiée » par une autre personne (non par défaut), libellés des étapes.
