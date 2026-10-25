# Prise de garde et engins

## À quoi ça sert

Vérifier qu'un engin est complet et prêt avant la garde, garder la trace de qui a vérifié quoi, et faire suivre ce qui manque ou ce qui est cassé.

## Les notions

- **Type d'engin** (liste ouverte) : VSAV, FPT, VTU, CCFM… Il porte **la fiche**.
- **Engin** : un véhicule réel (nom, immatriculation, type). Il a une **situation** et un **statut** :
  - situation : au centre, prêté à…, emprunté à…, en réparation, réformé. Les prises en compte et les retours sont datés, avec qui a l'engin et où il se trouve ;
  - statut : disponible ou indisponible. Un point bloquant le rend indisponible.
- **Fiche** : liée à un type d'engin, et **versionnée**. Elle a trois blocs :
  1. **inventaire par zone** (cabine, coffres, toit, extérieur…) : des éléments avec leur quantité attendue et le type de réponse attendu (présent, quantité, date de péremption, pression…) ;
  2. **actions de remise en état** : plein fait, nettoyage intérieur et extérieur, extincteurs plombés…
  3. **remarques** : matériel en trop, cassé, autre.

## Le déroulé

1. L'agent choisit l'engin. L'appli ouvre la fiche de son type, dans sa version en vigueur.
2. **Zone par zone**, il coche « Complet » en un geste. S'il choisit « Incomplet », il coche les éléments manquants ou défectueux, avec le nombre trouvé et une note.
3. Il coche les actions de remise en état faites, et ajoute ses remarques.
4. Il peut signaler un défaut comme **bloquant** : l'engin passe alors indisponible.
5. Il valide. Chaque élément manquant ou défectueux crée une anomalie, sauf si une anomalie est déjà ouverte pour cet élément sur cet engin.
6. Si un élément signalé à une prise précédente est retrouvé, l'appli propose de clore l'anomalie liée.

Il y a une seule prise en cours par engin, et le brouillon est gardé sur le serveur : on peut reprendre sur un autre téléphone.

## Modifier les fiches

- **Qui** : toute personne qui a le droit `GERER_FICHES`, par exemple le référent engins.
- Chaque modification crée **une nouvelle version**. Les prises passées gardent la leur, et la nouvelle s'applique à la prochaine prise.
- Un engin de remplacement du même type reprend la fiche automatiquement. S'il est équipé autrement, le référent ajuste la fiche, ce qui crée une nouvelle version.
- **Pour aller vite**, un import crée toujours un **brouillon** que le référent relit avant de l'enregistrer comme nouvelle version :
  1. **import et export Excel**, dès la première version : une ligne par élément ;
  2. **import depuis un lien Microsoft Forms**, juste après : un complément, car l'adresse utilisée n'est pas une API officielle ;
  3. **depuis une photo**, plus tard et en option : il faut une clé d'IA, payée par le centre.

## Ce que la fonction ne fait pas

- Pas de QR code dans l'appli.
- Pas de suivi des péremptions : voir [Stocks](stocks.md). Pas encore de contrôles périodiques (mensuels, annuels) ni de suivi des EPI : fonctions à venir.

## Exemple

Le VSAV 1 part en réparation. Le centre reçoit en prêt le VSAV 23 d'un autre CIS : « emprunté à CIS Bruz, du 3 au 17 novembre ». À la prise de garde, l'agent choisit le VSAV 23 et l'appli ouvre la fiche VSAV. Il manque un masque FFP2 dans la cellule : il coche « Incomplet », puis l'élément, et une anomalie est créée sur le VSAV 23. Au retour du VSAV 1, le VSAV 23 est marqué « rendu », avec la date.

## Rythme

**Chaque centre choisit son rythme** : à chaque prise d'astreinte, chaque jour, ou selon une autre périodicité, avec la possibilité de le régler par type d'engin. L'appli signale un engin dont la prise est en retard.

## Qui fait la prise

C'est **un réglage du centre** :
- **l'équipe d'astreinte**, c'est-à-dire ses agents et ses remplaçants de la semaine. C'est le choix de Laillé et le réglage par défaut ;
- **ou tout agent** du centre.

La prise enregistre l'agent qui l'a faite et l'équipe d'astreinte du moment.
