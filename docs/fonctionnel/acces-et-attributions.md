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

## Comités et responsabilités (page « Réglages du centre »)

Avant d'attribuer une responsabilité, elle doit exister. La page « Réglages » crée et fait vivre :

- **les comités** (nom, thème court : « sport », « formation ») : créer, renommer, dissoudre. Le comité du centre ne se renomme pas et ne se dissout pas ;
- **les responsabilités** : nom, nature (fonction ou mission), portée (centre, équipe ou comité), qui l'attribue, droits. Créer, modifier, archiver.

**Qui attribue** une responsabilité : le chef de centre, un comité désigné, ou, pour une portée « comité », le comité visé lui-même (cas du membre et du rapporteur).

**Droits de pouvoir et droits métier** :

| Groupe | Droits |
|---|---|
| Pouvoir | `GERER_ACCES`, `ATTRIBUER_RESPONSABILITE`, `GERER_LISTES`, `GERER_COMITES` |
| Métier | tous les autres (planning, stock, anomalies, salons…) |

**Qui peut quoi** :

- `GERER_COMITES` sur le centre gère les comités ; `GERER_LISTES` sur le centre gère les responsabilités. Chacun ne voit que la liste qu'il gère ; les autres agents n'ont pas la page.
- Le **référent technique** (responsabilité du jeu de départ, attribuée par le chef de centre, avec ces deux droits) met en place ce que le comité ou le chef a décidé. Il ne distribue que des droits métier : il ne coche ni ne décoche un droit de pouvoir, et ne modifie ni n'archive une responsabilité qui en porte un, la sienne comprise. Il peut dissoudre un comité.
- Le **chef de centre**, son **adjoint** et le **super administrateur** font tout, droits de pouvoir compris.

**Règles** :

- Rien n'est supprimé : on dissout un comité, on archive une responsabilité ; ils restent dans « Anciens » et ne sont plus proposés. On ne les réactive pas.
- Noms uniques (comités entre eux, responsabilités entre elles), sans tenir compte des majuscules : « amicale » est refusé si « Amicale » existe, même parmi les anciens. 60 caractères au plus.
- Les responsabilités système (chef de centre, adjoint, chef d'équipe) ne s'archivent pas ; leurs droits verrouillés ne se retirent pas.
- La portée ne change pas tant que quelqu'un tient la responsabilité, aujourd'hui ou plus tard.

**Effets d'une dissolution ou d'un archivage**, le jour même, après une case « Je confirme » :

- les attributions en cours (sur ce comité, ou de cette responsabilité) s'arrêtent la veille : leurs droits disparaissent dès aujourd'hui. Celles qui commencent aujourd'hui ou plus tard sont supprimées ;
- un comité dissous n'attribue plus rien : les responsabilités qu'il attribuait passent au chef de centre ;
- le journal note l'action et le nombre d'attributions closes.

Exemple : le comité « Sport » attribue « Référent sport », avec le droit « Gérer le stock ». Le comité est dissous le 3 mars : son rapporteur perd ses droits dès le 3 mars, et « Référent sport » est désormais attribué par le chef de centre.

## Super administrateur

- C'est le compte technique du centre : il possède les comptes Cloudflare, Brevo et GitHub. Pour Laillé : `cislaille35@gmail.com`.
- Il nomme le chef de centre. À l'installation, il peut aussi reprendre l'organisation réelle du centre : comités, membres, responsabilités.
- **Passation** : on change le mot de passe de la boîte du centre, on remplace les clés (Cloudflare, Brevo, secrets de l'appli) et on ferme ses sessions. La procédure pas à pas sera dans `docs/technique/`.

## Ce qui est tracé

Le journal garde chaque ajout ou retrait d'adresse, chaque changement de profil ou de statut opérationnel, chaque attribution, et chaque création, modification, dissolution ou archivage d'un comité ou d'une responsabilité, avec son auteur et sa date.

## Ce que la fonction ne fait pas

- Pas de vote ni de validation à plusieurs dans l'appli : le comité décide en réunion.
- Pas de compte partagé entre agents. Seule la réserve citoyenne peut avoir une adresse commune : on demande alors le nom de la personne à chaque réservation.

## Exemple

Une recrue arrive dans l'équipe 2. À Laillé, le centre a donné `GERER_ACCES` sur l'équipe au chef d'équipe : celui de l'équipe 2 ajoute donc l'adresse de la recrue, avec le profil agent, dans son équipe. La recrue reçoit son lien de connexion. Trois mois plus tard, le comité du centre la nomme référente pharmacie : son rapporteur enregistre l'attribution, « du 1er février, sans date de fin ».
