# Anomalies

## À quoi ça sert

Signaler un problème (sur un engin, un lot, un local ou du matériel), le faire réparer et savoir à tout moment ce qui est en cours et ce qui empêche d'utiliser un engin.

## Les notions

- **Objet concerné** : un engin, un lot (un sac, par exemple), un local ou du matériel.
- **Catégorie** (liste ouverte) : engin, pharmacie, bâtiment, amicale… Elle **décide qui est prévenu**, par exemple le référent pharmacie pour une anomalie de la catégorie pharmacie.
- **Effet sur l'engin**, seulement pour un engin ou un lot :
  - **bloquant** : l'engin est indisponible jusqu'à sa remise en service ;
  - **avertissement** : l'engin reste utilisable, mais un bandeau prévient tous ceux qui l'ouvrent (« Treuil HS, ne pas utiliser ») ;
  - **aucun**.
- **Priorité de traitement** : faible, normale ou haute. Elle est indépendante de l'effet sur l'engin. L'appli propose « haute » quand c'est bloquant, mais on peut la changer.

## Le déroulé par défaut

Chaque centre peut le modifier.

1. **Signalée** : depuis une prise de garde ou directement, avec une photo et une note.
2. **Prise en charge** : un agent compétent se l'attribue. Par défaut, tout agent peut le faire ; le centre peut réserver cette étape à une responsabilité (par exemple, référent engins).
3. **En attente**, avec un motif visible dans la liste : pièce commandée, au garage, prestataire. La date de départ et la date de retour sont notées.
4. **Réparée** : sur place ou au retour du garage, avec ce qui a été fait.
5. **Vérifiée** par une autre personne, seulement si le centre active cette étape.
6. **Close**. Pour un engin indisponible, l'appli demande : **« Remettre l'engin en service ? »** La réponse est une décision à part, car une autre anomalie peut rester bloquante.

On peut **rouvrir** une anomalie close. L'auteur et la personne qui l'a prise en charge sont prévenus à chaque changement d'étape.

## Les règles

- Un engin est indisponible tant qu'il a **au moins une** anomalie bloquante non close, sauf si on l'a explicitement remis en service.
- **Pas d'indisponibilité automatique** parce qu'une vérification est en retard : ça crée de faux arrêts.
- Une prise de garde ne crée pas d'anomalie en double sur un élément qui en a déjà une ouverte.
- Quand la prise de garde suivante retrouve l'élément en ordre, l'appli propose de clore l'anomalie.

## Ce que la fonction ne fait pas

- Pas de gestion du garage ni des devis : l'anomalie note seulement le départ et le retour.
- Pas de commande de pièces : c'est le rôle de la fonction Stocks, à venir.

## Exemple

À la prise de garde, l'agent trouve le treuil du VTU en panne. Il le signale en avertissement : le VTU reste disponible, avec le bandeau « Treuil HS ». Le référent engins prend l'anomalie en charge et la met en attente, motif « au garage », avec une date de départ. Au retour, il la passe à réparée, puis la clôt. Le bandeau disparaît.
