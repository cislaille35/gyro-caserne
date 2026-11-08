# Accès et attributions

## À quoi ça sert

Décider qui peut entrer dans l'appli, ce que chacun peut y faire, et garder l'historique de qui a occupé quelle responsabilité.

## Entrer dans l'appli

- **Liste fermée** : seules les adresses e-mail ajoutées une par une peuvent se connecter. Il n'y a ni inscription libre, ni lien public.
- **Connexion par lien magique** reçu par e-mail.
- **Chaque adresse porte un profil** (agent, réserve citoyenne, autre…). Le profil donne les droits de base et le type de personne : agent ou extérieur.
- **Ajouter ou retirer une adresse** demande le droit `GERER_ACCES` sur le **centre** (le chef de centre et son adjoint, par défaut) : n'importe quelle adresse et n'importe quel profil. La liste des agents et les fiches ne s'ouvrent qu'avec ce droit sur le centre. Depuis le 08/11/2026, ce droit ne se donne plus à un rôle d'équipe ou de comité (voir « Droits du centre » plus bas). Le socle sait encore le lire sur une équipe (statut d'un agent de cette équipe), pour un rôle ancien qui l'aurait déjà ; aucun rôle du jeu de départ ni de la préprod ne l'a.
- **Suspension ou départ** : le statut opérationnel passe à « Suspendu » ou « Parti ». Les accès sont coupés, les sessions fermées et les liens de connexion en attente annulés, mais l'historique est gardé. Au départ, la personne quitte aussi son équipe et **tous ses rôles prennent fin le même jour** (un rôle qui n'avait pas commencé est annulé) : un chef de centre qui part n'est plus chef de centre. On ne nomme pas une personne partie.
- **Lever une suspension ou faire revenir un « parti »** : seuls le chef de centre ou son adjoint le peuvent (`GERER_ACCES` sur le centre), même si un chef de garde a changé le statut de l'agent.
- **Statut du chef de centre** : seul le super administrateur le change. Exemple : l'adjoint ne peut pas suspendre le chef de centre. Un chef de centre nommé à l'avance n'est protégé qu'à partir de sa prise de fonction.
- **Statut d'un adjoint** : seuls le chef de centre ou le super administrateur le changent. Exemple : un adjoint ne peut pas suspendre un autre adjoint. Comme pour le chef de centre, un adjoint nommé à l'avance n'est protégé qu'à partir de sa prise de fonction.
- **Chef de centre adjoint** : il a les mêmes droits que le chef de centre. Seuls le chef de centre en fonction ou le super administrateur le nomment ou mettent fin à sa fonction ; un adjoint ne nomme pas d'autre adjoint.

## Attribuer une responsabilité

1. La personne qui a `ATTRIBUER_RESPONSABILITE` dans le comité qui attribue cette responsabilité (le rapporteur ou le référent du comité) choisit l'agent, la responsabilité, le périmètre et les dates.
2. Elle peut joindre le compte rendu en complément d'explication. Ce n'est jamais une condition.
3. L'attribution prend effet à la date de début et s'arrête d'elle-même à la date de fin, s'il y en a une.

Au démarrage, le chef de centre ou le super administrateur nomme les premiers membres de chaque comité.

**À l'écran**, deux chemins pour les mêmes règles :

- **depuis la fiche de l'agent** (gestionnaires), bloc « Rôles » : « Attribuer », puis « Changer la date de fin » ou « Terminer » sur un rôle ;
- **depuis la page « Nominations »**, pour quiconque peut attribuer au moins une responsabilité (rapporteur d'un comité, chef de centre…) : une carte par rôle qu'il peut donner (icône, nom, périmètre), ses titulaires en pastilles et « À pourvoir » en orange s'il n'y en a pas. « Nommer » ouvre un volet (agent, début aujourd'hui, « Changer les dates » replié) ; « Annuler » ou Échap le ferment et le focus revient sur « Nommer ». Un refus garde le volet ouvert, l'erreur dedans et le focus sur le premier champ fautif ; refermé puis rouvert, le volet repart à neuf ; une pastille ouvre la confirmation du retrait, avec aussi « Changer la date de fin ». Une recherche filtre les cartes par rôle ou par agent. Sans JavaScript, tout marche par l'adresse de la page. Elle s'ouvre depuis l'onglet « Caserne » (avec le nombre de rôles « à pourvoir ») ; les autres n'y ont ni le lien ni la page.

Chacun ne voit et ne propose que les rôles et les périmètres qu'il a le droit d'attribuer. Exemple : le rapporteur de l'« Amicale » nomme les membres de l'Amicale, mais ni un « Référent engins » (attribué par le chef de centre), ni un membre d'un autre comité.

- **Terminer** (case « Je confirme » sur la fiche, « Confirmer le retrait » sur « Nominations ») : le rôle s'arrête la veille, ses droits disparaissent dès aujourd'hui. Un rôle qui commence aujourd'hui ou plus tard est annulé.
- **Changer la date de fin** : on avance la fin d'un rôle en cours ou à venir ; on ne la repousse pas (« Une attribution ne peut qu’être raccourcie »). Mêmes droits que « Terminer ».
- **Personne partie** : on ne la nomme pas (« Cette personne est partie »).
- **Doublon refusé** : même personne, même rôle, même périmètre, périodes qui se chevauchent → « Cette personne tient déjà ce rôle sur cette période ».
- **Tout le centre voit** les rôles en cours de chacun dans la liste des agents (« Rôles : Chef de garde (Équipe 1) »), sans dates ni auteur.

## Comités et responsabilités (page « Réglages du centre »)

Avant d'attribuer une responsabilité, elle doit exister. La page « Réglages » crée et fait vivre :

- **les comités** (nom, thème court : « sport », « formation ») : créer, renommer, dissoudre. Le comité du centre ne se renomme pas et ne se dissout pas ;
- **les responsabilités** (rôles) : nom, nature (fonction ou mission), portée (centre, équipe ou comité), qui l'attribue, icône, droits. Créer à partir d'un modèle, modifier, archiver ;
- **les profils** (Agent, Réserve citoyenne) : leurs droits par domaine, jamais de droit d'administration. Réservé au chef de centre, à l'adjoint et au super administrateur.

La liste range les rôles par thème : « Chef de centre et adjoint », « Chefs de garde » (portée équipe), « Référents » (portée centre), « Comités » (les comités en cours, leurs membres et leur rapporteur, et les rôles de portée comité), « Listes du centre » (Aptitudes, Armement des engins), « Profils », et « Archivés », replié. Un rôle sans titulaire est signalé « À pourvoir ». Le chef de centre, l'adjoint et le super administrateur y voient aussi la place prise par les photos. L'icône d'un rôle est celle choisie, sinon celle de son modèle, sinon celle que donne son nom (engins : camion, pharmacie : croix, habillement : veste, technique : clé), sinon celle de son thème. Si l'on renomme ou change la portée d'un rôle sans icône choisie, l'icône affichée jusque-là est enregistrée, pour qu'elle ne change pas.

**Les droits en paquets.** La page d'un rôle range ses droits par domaine, chacun en niveaux cumulatifs (fixés par l'appli) :

| Domaine | Niveaux |
|---|---|
| Planning et gardes | Rien de plus · Valider les remplacements · Gérer le planning |
| Engins et anomalies | Rien de plus · Gérer (traiter les anomalies, fiches de prise de garde) |
| Stock et pharmacie | Rien de plus · Gérer |
| Habillement | Rien de plus · Gérer |
| Réservations | Rien · Réserver · Gérer |
| Messagerie | Rien de plus · Modérer |

Les droits d'administration (gérer les accès, les comités, les responsabilités, nommer) sont des cases à part. Des droits qui ne tombent sur aucun niveau s'affichent « Sur mesure » : enregistrer sans toucher ce domaine les garde tels quels. Un rôle créé à partir d'un modèle garde ce modèle : s'il s'en écarte, il porte « Personnalisé », et « Revenir au modèle » (un domaine) ou « Tout revenir » (tout le rôle) remet ses domaines au niveau du modèle. Les droits de salon et ceux ajoutés par le détail droit par droit restent : le rôle peut donc garder « Personnalisé ». Ces deux boutons changent l'écran ; rien n'est gardé avant « Enregistrer » (sans JavaScript, ils enregistrent aussitôt). Les cases d'administration ne reviennent au modèle que pour qui les gère. Les rôles du jeu de départ n'ont pas de modèle, sauf le référent habillement (ajouté avec son modèle). Le « Détail droit par droit » reste accessible pour les cas particuliers. Pour un profil, le niveau décrit tous ses droits du domaine ; les droits de base (voir le planning, les engins…) ne s'y règlent pas.

**Droits sans effet.** « Voir les motifs d'absence » et « Voir l'annuaire » n'ouvrent rien dans l'appli : ni Réglages, ni les paquets, ni « Ce que ce rôle permet » ne les montrent ou ne les proposent. Un rôle ou un profil qui les a déjà les garde, sans effet (le chef de garde du jeu de départ porte encore le premier), et ils ne le rendent pas « Personnalisé ».

**Droits du centre.** « Gérer les accès », « Gérer les comités » et « Gérer les responsabilités » valent pour tout le centre : ils ne se donnent qu'à un rôle de portée « Tout le centre ». Sur un rôle d'équipe ou de comité, ces trois cases sont grisées et décochées, avec la raison, et suivent la portée choisie à l'écran (sans JavaScript, seulement après l'enregistrement) ; un droit déjà porté part à l'enregistrement, et « Tout revenir » ne les rend pas. Le serveur refuse le reste, avec la raison (créer, modifier les droits ou changer la portée). « Nommer » se donne à toute portée : le rapporteur nomme dans son comité. Un profil ne donne aucun de ces droits.

**Les modèles** (« Nouveau rôle ») sont fixés par l'appli : Référent matériel (Engins : Gérer), Référent pharmacie (Stock : Gérer), Référent habillement (Habillement : Gérer), Référent technique (gérer les responsabilités et les comités), Membre de comité, Rapporteur de comité (nommer, dans son comité), Vierge (aucun droit). Le rôle créé en reprend les droits ; le formulaire est prérempli avec le nom, la nature, la portée et l'icône du modèle, qui se changent, comme qui attribue. Un modèle qui porte un droit d'administration (Référent technique, Rapporteur de comité) porte « Réservé au chef de centre, à son adjoint et au super administrateur » pour les autres, sans pouvoir être choisi.

Exemple : le chef de centre crée « Référent pharmacie 2 » depuis le modèle « Référent pharmacie ». Il met « Stock et pharmacie » à « Rien de plus » : le rôle devient « Personnalisé ». Il se ravise : « Revenir au modèle » remet « Gérer », la pastille disparaît, il enregistre.

**Le rapporteur** d'un comité est qui y tient un rôle de portée comité donnant le droit de nommer.

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

- Rien n'est supprimé : on dissout un comité, on archive une responsabilité ; ils restent dans « Archivés » et ne sont plus proposés. On ne les réactive pas.
- Noms uniques (comités entre eux, responsabilités entre elles), sans tenir compte des majuscules : « amicale » est refusé si « Amicale » existe, même parmi les anciens. 60 caractères au plus.
- Les responsabilités système (chef de centre, adjoint, chef de garde) ne s'archivent pas et leur page est en lecture seule ; leurs droits verrouillés ne se retirent pas.
- La portée ne change pas tant que quelqu'un tient la responsabilité, aujourd'hui ou plus tard.

**Effets d'une dissolution ou d'un archivage**, le jour même, après une case « Je confirme » :

- les attributions en cours (sur ce comité, ou de cette responsabilité) s'arrêtent la veille : leurs droits disparaissent dès aujourd'hui. Celles qui commencent aujourd'hui ou plus tard sont supprimées ;
- un comité dissous n'attribue plus rien : les responsabilités de centre ou d'équipe qu'il attribuait passent au chef de centre. Tant qu'il attribue une responsabilité de portée « comité » en cours, il ne se dissout pas : on change d'abord qui l'attribue (message « Changez d'abord qui attribue « … » ») ;
- le journal note l'action et le nombre d'attributions closes.

Exemple : le comité « Sport » attribue « Référent sport », avec le droit « Gérer le stock ». Le comité est dissous le 3 mars : son rapporteur perd ses droits dès le 3 mars, et « Référent sport » est désormais attribué par le chef de centre. Si « Sport » attribuait une responsabilité de portée « comité », il faudrait d'abord confier cette attribution à un autre comité.

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

Une recrue arrive dans l'équipe 2. Le chef de centre l'ajoute (Caserne → Agents → « Ajouter ») avec le profil Agent, dans l'équipe 2. La recrue reçoit son lien de connexion. Trois mois plus tard, le comité du centre la nomme référente pharmacie : son rapporteur enregistre l'attribution, « du 1er février, sans date de fin ».
