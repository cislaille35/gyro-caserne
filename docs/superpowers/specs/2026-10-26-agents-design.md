# Gestion de l'effectif : les agents à l'écran (lot 1)

Date : 2026-10-26. Validé en conversation avec le porteur, avant relecture du document.

## Pourquoi

Le socle (personnes, droits, statuts) et les fondations de l'interface sont en place, mais rien ne permet encore de gérer l'effectif depuis l'appli. Sans cela, pas de production. Le chef de centre veut ajouter un arrivant, modifier une fiche, déclarer un départ, vite.

## La gestion de l'effectif en quatre lots

Décidés avec le porteur, livrés dans cet ordre, chacun utilisable seul :

1. **Agents à l'écran** : ce document.
2. **Réglages du centre** : comités, responsabilités et leurs droits (création, modification, archivage).
3. **Responsabilités à l'écran** : attribuer et retirer depuis la fiche d'un agent, avec l'historique.
4. **Fichier de l'effectif (XLSX)** : export et import. Il porte sur tout l'effectif sauf le chef de centre et son adjoint ; réservé au chef de centre, à l'adjoint et au super administrateur (ni le comité ni les chefs d'équipe). Une colonne par donnée (n°, e-mail, prénom, nom, grade, date de grade, équipe, statut, profil, téléphone, naissance, entrée au centre, engagement SPV), une colonne par responsabilité (« Oui » ou vide) et par comité (« Membre », « Rapporteur » ou vide), des listes déroulantes construites depuis les listes du centre, des dates en JJ/MM/AAAA. Une ligne sans n° est une arrivée ; une ligne retirée fait passer l'agent au statut « parti » (jamais de suppression). Une colonne inconnue est signalée et ignorée : on crée d'abord la responsabilité ou le comité dans les réglages. Un aperçu montre tout ce qui va changer et les erreurs ligne par ligne avant validation ; les règles de droits de l'écran s'appliquent ligne par ligne. Un essai jetable vérifie d'abord qu'une bibliothèque XLSX fonctionne sur Cloudflare.

Les règles métier sont écrites une fois (dans le socle) et servent aux écrans comme au fichier.

## Ce que livre le lot 1

### Pour tous les agents : une vue

- La liste de l'effectif **groupée par équipe**, plus un groupe « Sans équipe » et un groupe « Extérieurs » (profils de type extérieur, comme la réserve citoyenne).
- Pour chacun : prénom, nom, grade. Rien d'autre (ni e-mail, ni naissance, ni statut).
- Tous les non-partis y figurent, suspendus compris, sans indication de statut. Pas d'action, pas de fiche détaillée.
- Toute personne connectée la voit (décision du porteur).

### Pour le chef de centre, l'adjoint et le super administrateur : la gestion

« Gestionnaires » ici : ceux qui ont `GERER_ACCES` sur le centre (aujourd'hui le chef de centre et l'adjoint) et le super administrateur.

- **Liste complète** (maquette `Agents.dc.html`) : recherche (nom, prénom, e-mail), filtres par équipe et par statut, partis compris.
- **Fiche d'un agent** : tous les champs de la fiche agent (`docs/fonctionnel/fiche-agent.md`) sauf la photo, les aptitudes et les champs du centre.
- **Ajouter un agent** : e-mail, prénom, nom obligatoires ; le reste facultatif (grade, date de grade, équipe, statut, profil, téléphone, naissance, entrée au centre, engagement SPV). Le profil « Agent » du jeu de départ est présélectionné (choix de Claude).
- **Modifier** la fiche, **changer d'équipe** ou retirer de toute équipe (« Aucune équipe », effet le jour même — choix de Claude), **changer de statut** (suspendre, déclarer parti, faire revenir), avec toutes les règles déjà en place (levée de suspension et retour d'un « parti » réservés au centre, sessions fermées quand l'accès est retiré).
- **Protection de la fiche** (décision du porteur), comme pour le statut : seul le super administrateur modifie la fiche du chef de centre en fonction ; seuls le chef de centre en fonction et le super administrateur modifient celle d'un adjoint en fonction. L'e-mail sert à la connexion : sans cette règle, changer l'e-mail du chef de centre permettrait de se connecter à sa place.
- **Départ et RGPD** (décision du porteur) : au passage à « parti », la date de naissance et le contact d'urgence sont effacés, après un avertissement et une confirmation à l'écran. S'il revient, on les ressaisit.
- Les chefs d'équipe n'ont pas d'écran de gestion dans ce lot (choix de Claude : aucun profil du jeu de départ ne leur donne `GERER_ACCES`).
- Chaque changement est inscrit au journal.

### Pour chaque agent : « Mon profil »

Choix de Claude, validé : l'agent modifie lui-même son surnom, son téléphone et sa visibilité, son contact d'urgence, et l'affichage de son anniversaire (fiche agent, « Les règles »).

## Les règles

- Toute modification passe par une action protégée du socle (vérification des droits, journal, écriture en un seul `batch`), testée.
- Les fondations de l'interface s'appliquent : composants communs, téléphone et ordinateur à égalité, RGAA, ni humour ni animation dans l'urgence.
- Sur ordinateur, la fiche s'ouvre à côté de la liste ; sur téléphone, sur sa propre page (choix de Claude, validé).
- Les données visibles respectent la fiche agent : e-mail et naissance pour les gestionnaires seulement ; téléphone seulement si l'agent l'accepte (sans effet dans ce lot, la vue de tous n'affiche pas de téléphone).

## Hors périmètre du lot 1

- La photo (stockage de fichiers à installer), les aptitudes, les champs propres au centre, les rappels (médailles, fin d'engagement).
- Les lots 2 à 4.

## Ce qui reste au constructeur

- Les actions du socle à ajouter (modification de fiche, modification de son propre profil, lectures pour la vue et pour la gestion) et leur découpage.
- Le changement d'e-mail d'un agent (il sert à la connexion) : ses conséquences sur les sessions, avec une règle simple et testée.
- Les adresses des pages, les composants à ajouter (par exemple un sélecteur), la présentation de la fiche.
- L'entrée de navigation « Agents », visible de tous (vue) avec la gestion pour les gestionnaires.
