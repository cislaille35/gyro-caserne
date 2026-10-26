# Gestion de l'effectif, lot 2 : réglages du centre

Date : 2026-10-27. Validé en conversation avec le porteur, avant relecture du document.
Feuille de route des 4 lots : `docs/superpowers/specs/2026-10-26-agents-design.md`.

## Pourquoi

Au centre, quand un comité naît ou qu'un rôle de référent apparaît, les personnes sont désignées (par le comité ou le chef de centre), puis un **référent technique** met tout en place : il crée les canaux et donne les droits. L'appli doit permettre ce même geste : créer et faire vivre les comités et les responsabilités, et leurs droits. C'est aussi un préalable au lot 3 (attribuer les responsabilités) et au lot 4 (fichier : une colonne par responsabilité et par comité).

## Ce que livre le lot 2

Une page « Réglages du centre », avec deux listes.

### Comités

- **Créer** : nom, thème (texte libre court, par exemple « formation », « sport »).
- **Renommer** (et changer le thème).
- **Dissoudre** : les attributions en cours sur ce comité (membres, rapporteur, toute responsabilité dont le périmètre est ce comité) s'arrêtent le jour même ; leurs droits disparaissent avec. L'historique reste. Le comité n'est plus proposé nulle part.
- Les responsabilités que ce comité attribuait sont désormais attribuées par le chef de centre (choix de Claude, validé).

### Responsabilités

- **Créer** : nom ; nature (fonction ou mission) ; portée (tout le centre, une équipe, un comité) ; qui l'attribue (un comité, ou le chef de centre à défaut) ; droits, en deux groupes de cases à cocher : **droits métier** et **droits de pouvoir**.
- **Modifier** : les mêmes éléments. Les droits verrouillés ne se retirent pas.
- **Archiver** : ceux qui la tiennent la perdent le jour même, avec ses droits ; elle n'est plus proposée ; l'historique reste.

### Droits métier et droits de pouvoir

| Groupe | Droits |
|---|---|
| Pouvoir | `GERER_ACCES`, `ATTRIBUER_RESPONSABILITE`, `GERER_LISTES`, `GERER_COMITES` |
| Métier | tous les autres (planning, annuaire, engins, anomalies, stock, disponibilités, remplacements, prise de garde, fiches, salons, réservations, messagerie, modération) |

## Qui peut faire quoi (décision du porteur)

- **Référent technique** : nouvelle responsabilité du jeu de départ (fonction, portée centre, attribuée par le chef de centre), avec `GERER_LISTES` et `GERER_COMITES` sur le centre. Il crée, modifie, dissout et archive comités et responsabilités, mais **ne distribue que des droits métier** : il ne peut ni ajouter ni retirer un droit de pouvoir dans une responsabilité.
- **Chef de centre, adjoint, super administrateur** : tout, droits de pouvoir compris.
- Les autres agents ne voient pas cette page.

## Les règles

- **Rien n'est jamais supprimé** : on dissout un comité, on archive une responsabilité.
- **Les rôles système ne s'archivent pas et leurs droits verrouillés ne se retirent pas** : chef de centre, adjoint, chef d'équipe ; le comité du centre ne se dissout pas (choix de Claude, validé).
- Toute écriture passe par une action du socle (droits, journal, `batch`), testée ; elle servira aussi au fichier du lot 4.
- **La préprod a déjà des données** : les nouveaux éléments (colonnes pour la dissolution et l'archivage, responsabilité « Référent technique ») arrivent par une **nouvelle migration** qui n'efface ni ne transforme aucune donnée existante (jamais en réécrivant la migration `0000`).
- Fondations de l'interface : composants communs, téléphone et ordinateur à égalité, RGAA AA, pas d'humour dans l'urgence (aucun écran d'urgence ici).

## Hors périmètre

- Attribuer une responsabilité à un agent (lot 3) ; le fichier (lot 4).
- Les salons de discussion : quand ils existeront, créer un comité pourra créer son salon.
- Réactiver un comité dissous ou une responsabilité archivée.

## Ce qui reste au constructeur

- Le marquage de la dissolution et de l'archivage (date ou drapeau) et la façon de reconnaître le comité du centre (aujourd'hui par son nom).
- Le découpage des actions du socle et des pages ; l'adresse de la page et son entrée de navigation (pour ceux qui ont `GERER_LISTES` ou `GERER_COMITES` sur le centre).
- L'affichage des droits (libellés lisibles en français pour chaque droit, regroupés).
