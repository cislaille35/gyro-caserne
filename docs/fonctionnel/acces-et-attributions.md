# Accès et attributions

## À quoi ça sert

Décider qui peut entrer dans l'appli, ce que chacun peut y faire, et garder l'historique de qui a occupé quelle responsabilité.

## Entrer dans l'appli

- **Liste fermée** : seules les adresses e-mail ajoutées une par une peuvent se connecter. Il n'y a ni inscription libre, ni lien public.
- **Connexion par lien magique** reçu par e-mail.
- **Chaque adresse porte un profil** (agent, réserve citoyenne, autre…). Le profil donne les droits de base et le type de personne : agent ou extérieur.
- **Ajouter ou retirer une adresse** demande le droit `GERER_ACCES`, sur un périmètre :
  - sur le **centre** (le chef de centre, par défaut) : n'importe quelle adresse et n'importe quel profil ;
  - sur une **équipe**, si le centre donne ce droit au chef d'équipe : uniquement des agents de son équipe.
- **Suspension ou départ** : le statut opérationnel passe à « suspendu » ou « parti ». Les accès sont coupés, les sessions fermées et les liens de connexion en attente annulés, mais l'historique est gardé.
- **Lever une suspension ou faire revenir un « parti »** : seuls le chef de centre ou son adjoint le peuvent (`GERER_ACCES` sur le centre), même si un chef d'équipe a changé le statut de l'agent.
- **Statut du chef de centre** : seul le super administrateur le change. Exemple : l'adjoint ne peut pas suspendre le chef de centre. Un chef de centre nommé à l'avance n'est protégé qu'à partir de sa prise de fonction.
- **Statut d'un adjoint** : seuls le chef de centre ou le super administrateur le changent. Exemple : un adjoint ne peut pas suspendre un autre adjoint. Comme pour le chef de centre, un adjoint nommé à l'avance n'est protégé qu'à partir de sa prise de fonction.
- **Chef de centre adjoint** : il a les mêmes droits que le chef de centre. Seuls le chef de centre en fonction ou le super administrateur le nomment ou mettent fin à sa fonction ; un adjoint ne nomme pas d'autre adjoint.

## Attribuer une responsabilité

1. La personne qui a `ATTRIBUER_RESPONSABILITE` dans le comité qui attribue cette responsabilité (le rapporteur ou le référent du comité) choisit l'agent, la responsabilité, le périmètre et les dates.
2. Elle peut joindre le compte rendu en complément d'explication. Ce n'est jamais une condition.
3. L'attribution prend effet à la date de début et s'arrête d'elle-même à la date de fin, s'il y en a une.

Au démarrage, le chef de centre ou le super administrateur nomme les premiers membres de chaque comité.

## Super administrateur

- C'est le compte technique du centre : il possède les comptes Cloudflare, Resend et GitHub. Pour Laillé : `cislaille35@gmail.com`.
- Il nomme le chef de centre. À l'installation, il peut aussi reprendre l'organisation réelle du centre : comités, membres, responsabilités.
- **Passation** : on change le mot de passe de la boîte du centre, on remplace les clés (Cloudflare, Resend, secrets de l'appli) et on ferme ses sessions. La procédure pas à pas sera dans `docs/technique/`.

## Ce qui est tracé

Le journal garde chaque ajout ou retrait d'adresse, chaque changement de profil ou de statut opérationnel, et chaque attribution, avec son auteur et sa date.

## Ce que la fonction ne fait pas

- Pas de vote ni de validation à plusieurs dans l'appli : le comité décide en réunion.
- Pas de compte partagé entre agents. Seule la réserve citoyenne peut avoir une adresse commune : on demande alors le nom de la personne à chaque réservation.

## Exemple

Une recrue arrive dans l'équipe 2. À Laillé, le centre a donné `GERER_ACCES` sur l'équipe au chef d'équipe : celui de l'équipe 2 ajoute donc l'adresse de la recrue, avec le profil agent, dans son équipe. La recrue reçoit son lien de connexion. Trois mois plus tard, le comité du centre la nomme référente pharmacie : son rapporteur enregistre l'attribution, « du 1er février, sans date de fin ».
