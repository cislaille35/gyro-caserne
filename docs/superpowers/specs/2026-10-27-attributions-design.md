# Gestion de l'effectif, lot 3 : les responsabilités à l'écran

Date : 2026-10-27. Le porteur a demandé d'enchaîner sans questions : les choix ci-dessous sont ceux de Claude, présentés au porteur et validés dans la PR.
Feuille de route : `docs/superpowers/specs/2026-10-26-agents-design.md`. Règles d'attribution : `docs/fonctionnel/acces-et-attributions.md`.

## Pourquoi

Les responsabilités existent (lot 2), les règles d'attribution aussi (socle), mais rien ne permet encore de nommer quelqu'un depuis l'appli. Sans cela, ni chef d'équipe, ni référent, ni membre de comité, donc aucun droit au-delà du profil.

## Ce que livre le lot 3

1. **Sur la fiche d'un agent** (gestionnaires) : une carte « Responsabilités » avec ses rôles **en cours**, **à venir** et **passés** (responsabilité, périmètre, dates, saisi par qui), et deux actions :
   - **Attribuer** : responsabilité (parmi celles que l'acteur peut attribuer), périmètre si la portée l'exige (équipe — celle de l'agent par défaut — ou comité), début (aujourd'hui par défaut), fin facultative ;
   - **Terminer** : l'agent perd le rôle aujourd'hui (même règle que la dissolution : une attribution à venir est annulée), avec confirmation ; ou **changer la date de fin** (seulement raccourcir).
2. **Une page « Nominations »** pour quiconque peut attribuer au moins une responsabilité (par exemple le rapporteur d'un comité) : les rôles qu'il peut donner, leurs titulaires en cours et à venir, et les mêmes actions (choix de l'agent dans une liste).
3. **Dans la vue de tous** (page « Agents »), les rôles en cours de chacun à côté de son nom (la fiche agent les dit « visibles par tout le centre »).

## Les règles (déjà dans le socle, inchangées)

- Qui attribue quoi : le comité désigné (son rapporteur), le comité visé pour une responsabilité propre à un comité, sinon le chef de centre ; le chef de centre est nommé par le super administrateur, l'adjoint par le chef de centre.
- Refus d'une responsabilité archivée, d'un comité dissous, d'un périmètre qui ne correspond pas à la portée, d'une fin avant le début.
- Chaque attribution et chaque fin sont inscrites au journal.

## Choix de Claude

- « Terminer » = perte du rôle aujourd'hui (fin la veille, ou annulation si elle commençait aujourd'hui ou plus tard), comme pour la dissolution et l'archivage.
- On ne peut que raccourcir une attribution (règle du socle).
- Une même personne peut tenir plusieurs rôles ; la même responsabilité sur le même périmètre en double (périodes qui se chevauchent) est refusée.
- Le compte rendu joint attend le stockage de fichiers (plus tard).

## Hors périmètre

- Le fichier XLSX (lot 4). Les notifications de nomination.

## Ce qui reste au constructeur

- Les lectures du socle nécessaires (attributions d'une personne, ce qu'un acteur peut attribuer, titulaires) et leur découpage.
- L'adresse de la page « Nominations » et son entrée de navigation.
- La présentation des listes (téléphone et ordinateur, RGAA AA), dans le style des pages existantes.
- La doc : `docs/fonctionnel/acces-et-attributions.md`, `docs/fonctionnel/fiche-agent.md`, `docs/technique/socle.md`, `docs/technique/interface.md`, aide `docs/utilisation/nommer-a-une-responsabilite.md`.
