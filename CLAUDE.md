# Règles de travail — Gyro Caserne

## Principe

Simple et clair, partout : dans nos échanges, le code, la doc et l'appli.
Rien d'inutile, pas de pavé. L'essentiel d'abord.
Soin du détail, sans excès. La critique est notre force : elle va dans les deux sens.

Vocabulaire : un **agent** est un pompier du centre, utilisateur de l'appli. Un **sous-agent** est un assistant IA lancé par Claude.

## Rôles

- **Le porteur du projet** valide tout : cadrage, décisions, PR, mise en production.
- **Claude** propose, critique, challenge et code. Il présente chaque décision, même la sienne, pour validation : rien ne doit échapper au porteur.
- Claude modifie la CI et gère les secrets sans demander, avec compte rendu, sauf s'il y a un coût, un risque de sécurité ou des données réelles en jeu.

## Méthode

1. **Cadrer** tout sujet avec le brainstorming (plugin Superpowers).
   Voie courte, pour une petite correction : le porteur la décide, et elle ne dispense que du brainstorming. Claude peut proposer un brainstorming s'il le juge utile.
2. **TDD** : le test d'abord, puis le code.
3. **Vérifier avant d'affirmer.**
4. **S'arrêter et demander** en cas de doute fonctionnel, de choix difficile à défaire, de coût, de sécurité, de données réelles ou de migration qui supprime ou transforme des données.

## Git et livraison

- `main` est protégée : on n'y pousse jamais directement, tout passe par une PR.
- Une branche par sujet : `fonction/…`, `correctif/…`, `doc/…`, `technique/…`.
- Commits en français, clairs.
- Fin de développement :
  1. **review** par un sous-agent, **une seule par lot**, à la fin. Claude choisit le modèle : rapide pour un petit changement, le plus capable pour une fonction, la sécurité, les données ou la base, et le plus capable en cas de doute. La review vérifie aussi que chaque comportement a son test. Chaque retour est traité en une vague ; la review n'est refaite que si une correction change le fonctionnement ;
  2. **PR** : sa description est le compte rendu (voir plus bas) ;
  3. le porteur valide ou refuse ;
  4. Claude fusionne la PR en **un seul commit** (squash) et le confirme.
- Déploiement (à mettre en place) : chaque fusion sur `main` part en **préprod**. La **production** ne part que d'un **tag** `vX.Y.Z` sur `main`, posé par Claude après accord du porteur.

## Terminé, c'est

- tests écrits d'abord et au vert ;
- CI au vert ;
- review faite ;
- doc à jour (voir plus bas) ;
- compte rendu dans la PR.

## Code

- Français : noms, commentaires, interface.
- Commentaires rares, courts, compréhensibles sans être technicien.
- Code simple : pas d'abstraction ni de généricité « au cas où ». Pareil pour les tests.
- Rien de propre à un centre dans le code : tout va dans `centres/<id>/`.
- Dépendances : le moins possible, versions fixées, chaque ajout justifié dans la PR et reporté dans `docs/technique/`.
- Téléphone et ordinateur comptent autant : on conçoit d'abord pour le téléphone, et un écran n'est fini que soigné aux deux tailles. Toutes les fonctions marchent partout.
- Chaque écran est soigné et son point d'entrée pensé pour être fluide : c'est l'interface qui fait adopter l'appli.
- Accessible dès le départ : RGAA (niveau AA des WCAG), utilisable au clavier, jamais une information portée par la seule couleur, « réduire les animations » respecté. Vérifié par des tests automatiques.
- Ni humour ni animation sur les écrans d'urgence.

## Données et sécurité

- Aucune donnée réelle dans le dépôt : jeux de test fictifs uniquement.
- Aucun secret dans le dépôt.

## Documentation

Mise à jour dans la même PR que le code.

| Dossier | Pour qui | Contenu |
|---|---|---|
| `docs/technique/` | Développeurs | Architecture, schémas, technos et versions, CI |
| `docs/fonctionnel/` | Porteur, chefs | Une page par fonction, avec exemples et cas d'usage |
| `docs/utilisation/` | Agents, bot de l'appli | Une page courte par question (« Comment me faire remplacer ? »), étapes numérotées |
| `docs/decisions/` | Tous | Une page par choix technique ou produit : contexte, options, choix, pourquoi, validé par qui |

Les règles de travail sont dans ce fichier.

## Tâches longues

Une tâche longue dure plus de 5 min. Le porteur sait où elle en est, et un blocage est toujours signalé.

1. **Au lancement** : ce qu'elle fait, durée estimée, heure limite.
2. **Journal** : une ligne horodatée par étape, dans un fichier de suivi hors du dépôt. Si le porteur demande où ça en est, Claude répond avec l'étape en cours.
3. **Garde-fou** : une surveillance automatique alerte Claude si rien n'avance depuis 10 min ou si l'heure limite est passée. Claude prévient alors le porteur : diagnostic et proposition (attendre, relancer, arrêter).
4. **Notification** sur le téléphone du porteur (notifications Claude Code) quand une tâche longue finit ou se bloque.

La machine de développement est petite (2 Go de mémoire) et peut redémarrer. Donc :

- **commit et push à chaque étape verte** : un redémarrage ne coûte que l'étape en cours ;
- **commande lourde** (types, compilation, installation) : toujours en cage mémoire et avec une limite de temps, pour qu'elle échoue seule au lieu de tout bloquer ;
- **PR ouverte en brouillon dès le premier push** : la CI y fait la vérification rapide ; la complète (types, accessibilité) part quand la PR passe « prête » ou à la demande, **une fois par lot** (minutes GitHub comptées). En local, on garde les tests rapides et les types ; les tests dans le navigateur (Playwright) ne tournent qu'en CI, jamais sur la machine de développement.
- **Aller vite** : un plan court (une page de tâches) ; des captures des seuls écrans principaux du lot (téléphone en clair, ordinateur en sombre) ; un seul lot à la fois quand deux lots touchent les mêmes écrans ou la base.

## Compte rendu

Court, sans jargon :
- **Fait** : ce qui a été livré ;
- **Pour les agents** : ce que ça change pour eux ;
- **Décisions à valider** : celles prises en cours de route ;
- **En suspens** : ce qui reste ouvert.

## Voir aussi

- Commandes : `README.md`.
- Référence fonctionnelle : le MVP [`cis-laille`](https://github.com/cislaille35/cis-laille).
