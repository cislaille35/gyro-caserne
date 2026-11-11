# Données des agents

## À quoi ça sert

Ne garder d'un agent parti que ce dont le centre a besoin pour son histoire, et rien qui le désigne au-delà de 12 mois. Décision : [0029](../decisions/0029-effacement-des-agents-partis.md).

## Les trois moments

| Moment | Ce qui se passe |
|---|---|
| **Départ** (statut « Parti ») | Date de naissance et contact d'urgence effacés. Connexion fermée, appareils et lien d'agenda retirés. Il quitte son équipe, ses rôles et ses groupes ; ses réservations à venir et ses demandes de remplacement en cours sont annulées. La fiche note la date du départ. Voir [Fiche agent](fiche-agent.md). |
| **12 mois après le dernier départ** (la nuit) | Ses données personnelles sont effacées : son nom devient « Ancien agent ». |
| **Sur demande de l'agent** | Le chef efface tout de suite, sans attendre 12 mois. |

Un agent revenu avant 12 mois n'est jamais effacé. S'il repart, les 12 mois comptent de ce nouveau départ.

## Ce qui est effacé, ce qui reste

- **Effacé** : nom et prénom, adresse e-mail (toutes celles qu'il a eues), téléphone, contact d'urgence, date de naissance, surnom, grade et dates (nomination, entrée au centre, engagement), champs du centre, aptitudes, compte de connexion, appareils et notifications. Il ne peut plus se connecter ni recevoir de courriel.
- **Reste, sous « Ancien agent »** : ses publications et commentaires, ses messages, ses demandes de remplacement et d'habillement, ses prises de garde, ses anomalies, ses réponses et vacances de l'été (pour l'équité des étés suivants), ses équipes et rôles passés. Les liens et les pages marchent comme avant. Chacun de ces éléments part ensuite à sa propre échéance (publications 24 mois, habillement 24 mois après la fin, réservations 12 mois, messages selon le centre).
- Une demande d'habillement encore ouverte reste traitable par le référent : elle s'affiche « Ancien agent », et l'agent parti n'est plus prévenu.
- Les notifications déjà reçues par les autres agents peuvent citer son nom : elles partent d'elles-mêmes au bout de 30 jours. Cela ne compte que pour un effacement sur demande ; à 12 mois, elles sont parties depuis longtemps.

## Qui efface sur demande

Le chef de centre, son adjoint et le super administrateur (`GERER_ACCES` sur le centre), comme pour faire revenir un agent parti. Pas le chef de garde. On ne s'efface pas soi-même, et l'agent doit d'abord être déclaré parti. Mode d'emploi : [Comment effacer les données d'un agent ?](../utilisation/effacer-un-agent.md).

L'effacement est définitif : un agent effacé ne revient pas. S'il revient au centre, on lui crée une nouvelle fiche.

## Après l'effacement

- Il n'est plus dans la liste des agents ni dans le fichier de l'effectif. Une ancienne ligne du fichier à son numéro est inconnue : elle ne le recrée pas.
- Sa fiche s'ouvre encore par un lien (« Ancien agent », « Données effacées le … ») et ne se modifie plus.
- Les copies chiffrées de la base sont gardées 3 mois : son effacement y disparaît au plus tard 3 mois après.

## Exemple

Paul part le 15 mars 2026. La nuit du 15 mars 2027, ses données sont effacées ; ses prises de garde de 2025 restent, signées « Ancien agent ». Julie, partie le 1er juin 2026, revient le 1er septembre : rien n'est effacé. Marc, parti en octobre 2026, demande à ne plus figurer dans l'appli : le chef ouvre sa fiche et efface ses données le jour même.
