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
| Responsabilités | attributions en cours et passées | tout le centre |
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

Menu « Agents », pour toute personne connectée :

- **Un agent** voit l'effectif groupé par équipe (ordre de rotation), puis « Sans équipe », puis « Extérieurs » : prénom, nom, grade. Les partis n'y sont pas ; les suspendus y sont, sans indication.
- **Le chef de centre, l'adjoint et le super administrateur** voient la liste complète, partis compris : recherche (nom, prénom, e-mail), filtres par équipe et par statut. Sur ordinateur, la fiche s'ouvre à côté de la liste ; sur téléphone, sur sa propre page.
- **La fiche** a trois cartes, chacune avec son bouton « Enregistrer » : identité et contact, parcours, équipe et statut. Le surnom et le contact d'urgence s'y lisent sans s'y modifier.
- **Ajouter un agent** : prénom, nom et e-mail obligatoires, profil « Agent » présélectionné.
- **Équipe** : le changement prend effet le jour même ; « Aucune équipe » retire l'agent de son équipe.
- **Départ** : choisir « Parti » affiche un avertissement (naissance et contact d'urgence effacés) et demande de cocher « Je confirme ».

Un agent ordinaire qui ouvre une fiche reçoit un refus. Un adjoint ne modifie pas la fiche du chef de centre ni celle d'un autre adjoint : la raison s'affiche à la place des formulaires.

Changer l'e-mail d'un agent ferme ses sessions et ses liens de connexion en attente : il se reconnecte avec la nouvelle adresse.

Menu « Mon profil », pour chaque agent : surnom, téléphone et son affichage, contact d'urgence, affichage de l'anniversaire. Le super administrateur, sans fiche, n'a pas ce menu.

Carte « Responsabilités » : rôles en cours, à venir et passés (repliés) de l'agent, avec période et auteur. « Attribuer » propose les seuls rôles que vous avez le droit de donner (la première équipe proposée est celle de l'agent), avec une date de début et une fin facultative. « Terminer » (case « Je confirme ») retire le rôle aujourd'hui, ou annule un rôle à venir. Nommer deux fois la même personne au même rôle sur des périodes qui se chevauchent est refusé.

Pas encore là : photo, aptitudes, champs du centre, rappels.

## Ce que la fonction ne fait pas

- Pas de dossier médical : seule la date de l'aptitude médicale est notée, jamais son contenu.
- Pas de gestion de carrière SDIS (avancement, formations obligatoires) : l'appli se limite à des rappels.
