# Fiche agent

## À quoi ça sert

Décrire chaque agent une seule fois, avec ce que le centre a vraiment besoin de savoir, et le montrer seulement à ceux qui doivent le voir.

## Les champs

| Bloc | Champs | Qui le voit |
|---|---|---|
| Identité | prénom, nom, photo, surnom (facultatif) | tout le centre |
| Contact | e-mail (pour la connexion), téléphone | e-mail : gestionnaires ; téléphone : seulement si l'agent l'accepte |
| Naissance | date de naissance | l'agent et les gestionnaires ; le centre voit seulement « anniversaire aujourd'hui », sans l'âge |
| Parcours | date d'entrée au centre, date d'engagement SPV, grade et date de nomination | tout le centre, sauf les dates d'engagement |
| Opérationnel | équipe (affectation datée), statut opérationnel, aptitudes datées (dont l'aptitude médicale) | tout le centre ; les dates d'expiration : l'agent et les gestionnaires |
| Responsabilités | attributions en cours, à venir et passées, avec dates et auteur | gestionnaires ; tout le centre voit les rôles en cours (nom du rôle et de l'équipe ou du comité) |
| Urgence | une personne à prévenir (facultatif) | gestionnaires seulement |
| Champs du centre | champs libres définis par le centre (taille d'EPI, casier…) | réglable par champ |

Ici, les **gestionnaires** sont ceux qui ont le droit `GERER_ACCES` sur le centre ou sur l'équipe de l'agent.

## Ce que la fiche permet

- **Anniversaires** : un mot sur l'accueil le jour J. L'agent peut le désactiver.
- **Ancienneté** : un rappel des médailles d'honneur à 10, 20, 25 et 30 ans de service, pour préparer les dossiers à temps.
- **Fin d'engagement** : l'engagement SPV dure 5 ans et se renouvelle. L'agent et le chef de centre sont prévenus avant l'échéance.
- **Aptitudes et aptitude médicale** : un rappel avant expiration. Voir Composition des gardes.

## Les règles

- L'agent modifie lui-même sa photo, son surnom, son téléphone et sa visibilité, ainsi que son contact d'urgence. Les gestionnaires modifient tout le reste.
- **RGPD** : la date de naissance et le contact d'urgence sont limités au strict nécessaire et effacés au départ de l'agent. L'historique opérationnel (prises de garde, attributions) est gardé selon les durées de conservation du centre.

## Ce qui existe aujourd'hui (lot 1)

« Agents » (onglet « Caserne »), pour toute personne connectée :

- **Un agent** voit l'effectif groupé par équipe (ordre de rotation), puis « Sans équipe », puis « Extérieurs ». Chaque équipe porte un liseré de sa couleur et un résumé (« 8 agents · chef : A. Martin », ou « sans chef d’équipe » en orange). Par agent : prénom, nom, grade et ses rôles en cours, sans dates ni auteur. Les partis n'y sont pas ; les suspendus y sont, sans indication.
- **Le chef de centre, l'adjoint et le super administrateur** voient la même liste, avec en plus l'e-mail, le statut (sauf « Opérationnel »), la pastille « À compléter » et un dernier groupe « Partis », replié. Recherche (nom, prénom, e-mail) et filtres en pastilles : Tous, À compléter (sans grade ou sans date d'entrée, hors partis et extérieurs), Indisponibles (inapte temporaire ou suspendu ; un stagiaire part en intervention), Partis, chacun avec son nombre. Une équipe sans chef d'équipe porte un lien « Nommer » vers les nominations ; un chef parti ne compte pas. Ouvrir un agent garde la recherche et le filtre de la liste. Sur ordinateur, la fiche s'ouvre à côté de la liste ; sur téléphone, sur sa propre page.
- **La fiche** a trois cartes, chacune avec son bouton « Enregistrer » : identité et contact, parcours, équipe et statut. Le surnom et le contact d'urgence s'y lisent sans s'y modifier.
- **Ajouter un agent** : prénom, nom et e-mail obligatoires, profil « Agent » présélectionné.
- **Équipe** : le changement prend effet le jour même ; « Aucune équipe » retire l'agent de son équipe.
- **Départ** : choisir « Parti » affiche un avertissement (naissance et contact d'urgence effacés) et demande de cocher « Je confirme ».

Un agent ordinaire qui ouvre une fiche reçoit un refus. Un adjoint ne modifie pas la fiche du chef de centre ni celle d'un autre adjoint : la raison s'affiche à la place des formulaires.

Changer l'e-mail d'un agent ferme ses sessions et ses liens de connexion en attente : il se reconnecte avec la nouvelle adresse.

« Mon profil » (sous « Moi »), pour chaque agent : surnom, téléphone et son affichage, contact d'urgence, affichage de l'anniversaire. Le super administrateur, sans fiche, n'a pas cette page.

Carte « Responsabilités » : rôles en cours, à venir et passés (repliés) de l'agent, avec période et auteur. « Attribuer » propose les seuls rôles que vous avez le droit de donner (la première équipe proposée est celle de l'agent), avec une date de début et une fin facultative. « Terminer » (case « Je confirme ») retire le rôle aujourd'hui, ou annule un rôle à venir. « Changer la date de fin » avance la fin d'un rôle en cours ou à venir (on ne peut pas la repousser). Une personne partie n'a plus de rôle, et on ne la nomme pas. Nommer deux fois la même personne au même rôle sur des périodes qui se chevauchent est refusé. Les mêmes nominations se font aussi depuis la page « Nominations » (voir [Accès et attributions](acces-et-attributions.md)).

### Le fichier de l'effectif (lot 4)

Pour charger ou changer l'effectif en masse dans Excel ou LibreOffice. Réservé au chef de centre, à l'adjoint et au super administrateur (lien « Fichier de l'effectif » en tête de la liste). Mode d'emploi : [Comment importer l'effectif ?](../utilisation/importer-l-effectif.md).

- **Modèle vierge** (premier chargement) ou **export** (mises à jour) : une ligne par agent, partis et extérieurs compris, sauf le chef de centre et l'adjoint en fonction. Colonnes : n°, e-mail, prénom, nom, grade, date de grade, équipe, statut, profil, téléphone, naissance, entrée au centre, engagement SPV ; puis une colonne par responsabilité (« Oui » ou vide) et une par comité (« Comité : Amicale », avec « Membre de comité », « Rapporteur de comité »… ou vide). Listes déroulantes, dates en JJ/MM/AAAA.
- **Import** : un aperçu d'abord, rien n'est écrit avant « Valider ». Ligne sans n° : arrivée. Ligne avec n° : modification. Agent absent du fichier : départ (statut « Parti », mêmes effets qu'à l'écran ; jamais de suppression). Case de responsabilité remplie : rôle attribué dès aujourd'hui ; vidée : rôle terminé aujourd'hui.
- **Aperçu** : les départs en tête, avec leur nombre et leurs noms (un fichier tronqué se voit tout de suite), puis arrivées, modifications champ par champ, erreurs ligne par ligne, lignes périmées et colonnes inconnues (ignorées).
- **Erreurs** : e-mail déjà pris (avec le n° de l'agent), valeur hors liste, date invalide, profil manquant, rôle d'équipe sur une autre équipe, deux rôles dans un même comité, adresse d'un super administrateur… Ces lignes ne sont pas appliquées ; le reste l'est.
- **Fichier périmé** : un agent modifié dans l'appli après l'export (fiche, équipe, statut ou rôles, import compris) n'est ni modifié ni mis au départ. On réexporte avant chaque import. Une modification faite à l'écran entre l'aperçu et « Valider » n'est pas détectée.
- Mêmes droits et contrôles qu'à l'écran, ligne par ligne. Le chef de centre et l'adjoint se nomment et se modifient à l'écran seulement. Aucun courriel ne part.

Exemple : à la rentrée, le chef de centre exporte l'effectif, ajoute deux lignes sans n° pour les nouvelles recrues, passe trois agents de Sapeur à Caporal et supprime la ligne d'un agent qui a déménagé. L'aperçu annonce « 1 départ » avec son nom, « 2 arrivées », « 3 modifications » (« Grade : Sapeur → Caporal »). Il valide ; le compte rendu confirme, et il réexportera avant le prochain import.

Pas encore là : photo, aptitudes, champs du centre, rappels.

## Ce que la fonction ne fait pas

- Pas de dossier médical : seule la date de l'aptitude médicale est notée, jamais son contenu.
- Pas de gestion de carrière SDIS (avancement, formations obligatoires) : l'appli se limite à des rappels.
