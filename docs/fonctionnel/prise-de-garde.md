# Prise de garde et engins

> **Livré (lot A, engins et fiches)** : Caserne → Engins, la page de chaque engin et sa fiche, l'ajout et la modification d'un engin (au centre, prêté au centre par un autre centre, parti), l'éditeur de fiche et le fichier des fiches (Excel).
> **Livré (lot B, prise de garde)** : la prise au téléphone (voir « Ce que fait le lot B » plus bas). **Livré (lot C)** : le suivi des anomalies, l'indisponibilité décidée et la remise en service, voir [anomalies.md](anomalies.md). Cadrage : [la spec](../superpowers/specs/2026-11-02-engins-design.md), qui précise cette page et l'emporte en cas d'écart.

## À quoi ça sert

Vérifier qu'un engin est complet et prêt avant la garde, garder la trace de qui a vérifié quoi, et faire suivre ce qui manque ou ce qui est cassé.

## Les notions

- **Type d'engin** (liste ouverte) : VSAV, FPT, VTU, CCFM… Il porte **la fiche**.
- **Engin** : un véhicule réel (nom, immatriculation facultative, type). Il a une **situation** et un **état** :
  - situation : **au centre**, **prêté au centre** par un autre centre (« Prêté par CIS Exemple-Nord ») ou **parti** (sorti de la liste à la date du jour ; son historique reste, et le remettre au centre l'y fait revenir) ;
  - état : **Disponible**, **Avertissement** (disponible, avec au moins une anomalie ouverte) ou **Indisponible**, par décision (voir [anomalies.md](anomalies.md)).
- **Fiche** : liée à un type d'engin, et **versionnée**. C'est un **inventaire par zone** (cabine, coffres, toit, extérieur…) : des éléments, avec leur quantité attendue s'ils se comptent. Pas encore : actions de remise en état (plein, nettoyage…), réponses autres que présent ou quantité (péremption, pression), remarques libres.

## Le déroulé

1. L'agent choisit l'engin. L'appli ouvre la fiche de son type, dans sa version en vigueur.
2. **Zone par zone**, il lit la liste et touche « Tout est complet ». Pour un élément manquant, abîmé ou à remplacer, il touche « Écart » sur sa ligne (nombre manquant, note et photo facultatives).
3. Il valide. Chaque écart crée une anomalie, sauf si une anomalie est déjà ouverte pour cet élément sur cet engin. L'engin reste disponible : l'indisponibilité est une décision à part.
4. Si un élément signalé à une prise précédente est retrouvé, l'appli propose de clore l'anomalie liée.

Il y a une seule prise par engin et par relève, et le brouillon est gardé sur le serveur : on peut reprendre sur un autre téléphone. Le détail est plus bas, « Ce que fait le lot B ».

## Modifier les fiches

- **Qui** : toute personne qui a le droit `GERER_FICHES` : le chef de centre, son adjoint, les chefs de garde et le référent engins. Les mêmes ajoutent et modifient les engins (« Ajouter un engin » en haut de Caserne → Engins).
- **Comment** : Caserne → Engins → Fiches de prise de garde. Zone par zone : ajouter, renommer, déplacer, retirer une zone ou un élément ; un élément peut changer de zone. Un élément qui se compte garde sa **quantité attendue** ; les autres sont seulement présents ou manquants. Un nouveau type d'engin (CCF…) arrive avec une fiche vide.
- Les prises passées gardent la version de leur époque. Tant qu'une version n'a servi à aucune prise, on la corrige sur place ; dès qu'elle a servi, la modification suivante crée la version d'après. Chaque élément garde sa référence d'une version à l'autre : une anomalie le suit.
- Un engin de remplacement du même type reprend la fiche automatiquement. S'il est équipé autrement, le référent ajuste la fiche, ce qui crée une nouvelle version.
- **Pour aller vite**, Caserne → Engins → **Fichier des fiches** (Excel ou LibreOffice) : « Exporter les fiches », les modifier, puis importer le fichier. Une feuille par type d'engin, une ligne par élément (Réf., Zone, Élément, Quantité) ; une ligne sans Réf. est un nouvel élément, une ligne retirée retire l'élément. L'aperçu dit, fiche par fiche, ce qui est ajouté, retiré, modifié, et si la fiche deviendra une nouvelle version ; rien n'est écrit avant « Valider », et rien du tout s'il reste une erreur.
- Pas encore : l'import depuis un lien Microsoft Forms (l'adresse utilisée n'est pas une API officielle) ni depuis une photo (il faudrait une clé d'IA, payée par le centre).

## Ce que la fonction ne fait pas

- Pas de QR code dans l'appli.
- Pas de suivi des péremptions : voir [Stocks](stocks.md). Pas encore de contrôles périodiques (mensuels, annuels) ni de suivi des EPI : fonctions à venir.

## Exemple

Le VSAV 1 part en réparation. Le centre reçoit en prêt le VSAV 23 d'un autre CIS : il l'ajoute, « Prêté par CIS Bruz ». À la prise de garde, l'agent choisit le VSAV 23 et l'appli ouvre la fiche VSAV. Il manque un masque FFP2 dans la cellule : il touche « Écart » sur sa ligne, et à la validation une anomalie est créée sur le VSAV 23. Au retour du VSAV 1, le VSAV 23 passe « parti » : il sort de la liste à la date du jour, son historique reste.

## Rythme

Une prise par engin **à chaque relève**, c'est-à-dire à chaque prise d'astreinte du centre (à Laillé, le vendredi à 18 h). L'appli signale un engin dont la prise est en retard.

## Qui fait la prise

**Tout agent** qui a le droit « Faire la prise de garde » (profil Agent). Le lien de l'Accueil, lui, n'apparaît qu'aux agents d'astreinte dans la semaine de la relève.

La prise est au nom de ses participants (celui qui valide en fait partie) et de l'équipe d'astreinte du moment.

## Ce que fait le lot B (prise de garde)

- **Depuis l'accueil** : sur la carte d'astreinte, « Faire la prise de garde », de 2 h avant à 24 h après **la relève du centre**, pour les agents qui ont une astreinte dans la semaine de cette relève. Une plage d'été qui commence le dimanche n'y change rien : le lien suit la relève du vendredi.
- **Caserne → Engins → Prise de garde** : la relève en cours (« Relève du ven. 30 oct., équipe 2 ») et chaque engin : « Prise faite par l'équipe 2, ven. 18 h 40 », « Prise en cours (Alice Martin) » ou « Prise à faire », et ses écarts encore ouverts. La liste des engins dit la même chose sous chaque engin.
- **La prise d'un engin** : en tête, la plaque de l'engin (son nom en grand sur un à-plat rouge, la relève, « 1 / 4 zones vues ») ; dessous, une fois la prise commencée, les participants avec « Modifier » et qui l'a commencée. La fiche se lit avant de commencer, sans rien créer. Toutes les zones sont au sélecteur, en tuiles (en haut au téléphone, à gauche à l'ordinateur ; elles passent à la ligne quels que soient leur nombre et leurs noms), le contenu de la zone dessous. Une zone vue est verte, avec la coche et « Tout est complet » (ou « Complet sauf 1 écart ») écrits ; la zone affichée est en encre pleine. Le titre de la zone dit son nombre d'éléments, la liste tient dans une carte. Par ligne, un lien « Écart » et la quantité attendue. **« Tout est complet » vient après la liste** : on ne valide pas une check-list sans l'avoir sous les yeux (décision du porteur : pas de bouton fixé en bas). L'appli passe alors à la zone suivante à voir, son titre en haut de l'écran, et propose « Annuler » ; une zone complète se revoit aussi depuis le sélecteur. Un écart : manquant avec le nombre manquant s'il se compte, abîmé, à remplacer ; note et photo facultatives. « Oui, clore le signalement » si un élément signalé est retrouvé. Les participants : sous la plaque, « Participants : vous + 2 » et « Modifier », qui ouvre un panneau (l'équipe d'astreinte d'abord, une recherche pour un remplaçant ou un renfort).
- **Écarts déjà signalés** : le sélecteur compte ceux de chaque zone (« 7 à voir · 1 signalé ») ; ceux sans élément de la fiche (signalés hors prise) sont listés au-dessus des zones.
- **Commencer** : le premier geste sur la fiche (« Tout est complet », un écart ou un signalement retrouvé) commence la prise, ou reprend celle qu'un collègue vient de commencer. Le bouton « Commencer la prise » ne reste que pour une fiche sans zone, où aucun autre geste n'existe.
- **Valider** : un bandeau toujours là, en bas du contenu. Tant qu'il reste des zones : « Encore 2 zones à voir avant de valider. » et « Valider la prise » grisé (atteignable au clavier, lu avec cette raison). Toutes vues : le bloc « Valider », avec le résumé et le nom des participants, et le bouton actif ; le focus y va.
- **Brouillon partagé** : une prise par engin et par relève, gardée sur le serveur ; un collègue la reprend sur son téléphone. On peut l'abandonner (brouillon et photos effacés).
- **À la validation** : chaque écart devient une anomalie (sauf si le même élément est déjà signalé et ouvert) ; les éléments retrouvés sont clos. L'engin reste disponible : l'indisponibilité est une décision (lot C).
- **Relève** : le moment de prise d'astreinte du centre ; on peut commencer deux heures avant. **Retard** : trois heures après la relève, les engins sans prise validée apparaissent dans « À décider » du chef de garde de l'équipe d'astreinte (« Prise de garde en retard : VSAV 1, FPT »), sinon dans « Le centre ».
- **Historique** : sur la page de l'engin, les dernières prises ; chacune se relit telle qu'elle a été faite, avec la fiche de son époque.
- **Qui** : tout agent (droit « Faire la prise de garde », profil Agent) ; les autres lisent les zones et les écarts, sans aucun geste.
