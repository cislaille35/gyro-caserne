# Les écrans par profil

Date : 2026-10-27. Validé en conversation avec le porteur, avant relecture du document.
Maquettes de référence (téléphone et ordinateur, cliquables) : https://claude.ai/artifact/GJfxr9EbYLPPxvnBSNR2Rd. Leurs sources sont copiées dans [`2026-10-27-ecrans-par-profil/`](2026-10-27-ecrans-par-profil/).
S'appuie sur les fondations de l'interface : [`2026-10-26-design-ui-design.md`](2026-10-26-design-ui-design.md).
En cas d’écart, ce document prime sur les maquettes (par exemple, les salons n’y sont plus un paquet de droits).

## Pourquoi

Les écrans livrés jusqu'ici (réglages, nominations, agents) sont pratiques pour un administrateur, mais trop complexes pour un chef de centre ou un adjoint. En ouvrant « Réglages », il voit des paramètres à régler un par un, qui s'ouvrent tous et remplissent la page, sans savoir ce qu'il vient de faire : rien ne se replie, pas de couleur, pas de retour en arrière, pas de vrais boutons, beaucoup de texte (porteur). Les écrans du chef d'équipe, de l'agent et des comités n'existent pas encore. On les pense tous avant la production.

## Décisions du porteur

- **Un écran par profil**, pensé pour ce que la personne vient y faire.
- **Des paquets de droits** plutôt que des droits cochés un par un, avec un **bouton pour revenir en arrière** (réinitialiser).
- **Partir d'un modèle** pour créer une responsabilité (validé après recherche).
- **Plus chaleureux et plus fluide** : une icône par rôle (comme le camion du référent engins), des groupes repliables pour tenir sur un téléphone, des composants soignés. Sur ordinateur, suivre les standards des pages web.
- **Rôles rangés par thème** : chef de centre et adjoint, chefs d'équipe, référents, comités.
- **Rôles cumulés** : une même personne peut être chef d'équipe, adjoint, membre d'un comité et référent. Chaque rôle a sa page, qui **respire**, plutôt qu'un seul fil chargé.
- **Un besoin de matériel va au référent concerné** : un besoin sur un engin au référent engins, du matériel de pharmacie au référent pharmacie.
- **L'accueil du chef d'équipe est un tableau de bord** de son astreinte. Il contient : peut-on partir, qui est là sur la garde, les remplacements pourvus et non pourvus, les engins, les anomalies à prendre en charge, les fiches de prise de garde, le besoin de matériel.
- **Ce que fait l'agent**, liste ouverte : consulter l'équipe, les fiches d'inventaire, régler les anomalies, les infos des comités, faire une demande à un référent, demander un remplacement, noter ses vacances, consulter le calendrier d'astreinte et d'activité, lire les murs et répondre au fil, recevoir des notifications, écrire sur les murs où il en a le droit, créer des conversations de groupe, discuter en messagerie.
- **Rangement en quatre onglets** : Accueil, Planning, Caserne, Échanges (voir plus bas).

## Les principes communs

1. **Une page = une tâche.** Les listes sont courtes : une ligne par élément, un appui ouvre sa page. Rien ne se déplie dans une liste longue.
2. **Les groupes se replient**, avec un résumé visible même replié (« Référents · 4 rôles · 1 sans titulaire »). Sur ordinateur, la place permet de tout afficher.
3. **L'urgent remonte** : ce qui demande une action est en orange (à faire) ou en rouge (bloquant), avec un texte qui dit quoi faire. Ce qui va bien reste discret. Jamais la couleur seule.
4. **Revenir en arrière** : chaque domaine modifié a « Revenir au modèle », et la page a « Tout revenir ». Tant que rien n'est enregistré, la page le dit (« 1 domaine modifié, pas encore enregistré ») dans une barre d'actions qui reste visible en bas.
5. **Chaleureux** : fond crème doux, cartes blanches arrondies, une icône et une couleur par rôle, des initiales en rond pour les personnes, un « Bonjour » et une phrase d'explication en tête de page. Gyro reste sur l'accueil (fondations de l'interface).
6. **Vrais boutons** : de vrais boutons, de taille confortable (au moins 44 px), les actions principales à portée de pouce.

## Les droits en paquets

Les droits restent ceux du socle, et **aucun droit existant ne change** (ni profil, ni rôle du jeu de départ) : l'interface ne fait que les présenter autrement. Elle les range **par domaine**, chacun en niveaux cumulatifs. Pour un profil (Agent, Réserve citoyenne…), le niveau choisi décrit tous ses droits du domaine ; pour une responsabilité, ce qu'elle ajoute au-dessus du profil.

| Domaine | Niveaux (cumulatifs) |
|---|---|
| Planning et gardes | Rien de plus · Voir les absences (`VOIR_MOTIFS_ABSENCE`) · Valider les remplacements (`VALIDER_REMPLACEMENT`) · Gérer le planning (`GERER_PLANNING`) |
| Engins et anomalies | Rien de plus · Gérer (`TRAITER_ANOMALIE`, `GERER_FICHES`) |
| Stock et pharmacie | Rien de plus · Gérer (`GERER_STOCK`) |
| Réservations | Rien · Réserver (`RESERVER`) · Gérer (`GERER_RESERVATIONS`) |
| Messagerie | Rien de plus · Modérer (`MODERER_MESSAGERIE`) |
| Administration de l'appli | Cases séparées, en rouge : gérer les accès (`GERER_ACCES`), gérer les comités (`GERER_COMITES`), gérer les responsabilités (`GERER_LISTES`), nommer (`ATTRIBUER_RESPONSABILITE`). Seuls le chef de centre, l'adjoint et le super administrateur les cochent ou les décochent (règle actuelle des réglages) ; le référent technique et le rapporteur gardent les leurs. |

Ce que tout agent a déjà par son profil (jeu de départ) : voir le planning, l'annuaire, les engins et les anomalies, signaler une anomalie ou un besoin de stock, prendre en charge une anomalie, demander un remplacement, déclarer ses disponibilités, utiliser la messagerie. Au premier niveau de chaque domaine, l'écran le rappelle (« Comme tout agent : il signale une anomalie »).

- **Les salons ne sont pas des paquets** : lire, publier, modérer et épingler se règlent salon par salon (« qui peut lire, publier… ») dans la page du salon ([`salons.md`](../../fonctionnel/salons.md)).
- **Les rôles système** (chef de centre, adjoint, chef d'équipe) ont des droits verrouillés : leur page les montre par domaine, en lecture seule, sans « Revenir au modèle ». Un rôle dont les droits ne tombent sur aucun niveau affiche « Sur mesure » et le détail.
- **Les paquets sont fixés par l'appli**, pas créés par le centre : on évite la prolifération (recherche : des centaines de paquets non documentés ailleurs).
- **Les modèles** : « Nouveau rôle → à partir de : Référent matériel, Référent pharmacie, vierge… ». Un rôle garde le nom de son modèle ; s'il s'en écarte, il porte la pastille **« Personnalisé »**, et « Revenir au modèle » le remet comme son modèle.
- **Le détail droit par droit** reste accessible derrière un lien, pour les cas particuliers.
- Le libellé de `GERER_FICHES` est faux à l'écran (« Gérer les fiches des agents ») : il s'agit des fiches de prise de garde des engins. À corriger.

## La navigation

Quatre onglets, en bas sur téléphone, en menu à gauche sur ordinateur (fondations) :

1. **Accueil** : la page de chaque rôle tenu (voir « Les casquettes »), et « À faire pour vous ».
2. **Planning** : calendrier des astreintes et des activités, vacances et absences, remplacements et échanges, suivi de ses demandes.
3. **Caserne** : l'équipe et les agents, les engins (fiches d'inventaire et de prise de garde, anomalies), les comités, les demandes aux référents (matériel, pharmacie…). Pour les gestionnaires : Agents, Nominations, Réglages.
4. **Échanges** : murs et canaux (lire, répondre au fil, publier là où on a le droit), messagerie à deux ou en groupe.

En haut, partout : la cloche des notifications avec son compteur, et « Moi » (profil, affichage). Les droits n'ajoutent pas d'onglet : ils ajoutent ou retirent des boutons dans les pages (un agent « Signaler », un référent aussi « Régler »).

## Les casquettes

- En haut de l'accueil, une rangée de **casquettes**, une par rôle tenu : « Mon astreinte », « Chef d'équipe », « Pharmacie », « Amicale », « Le centre »… Chacune porte un compteur quand quelque chose l'attend.
- Une casquette ouvre **sa** page, avec ses seuls blocs.
- À l'ouverture : la casquette où une action attend ; sinon la principale (le centre pour le chef de centre et l'adjoint, l'astreinte pour un chef d'équipe ou un agent). Choix de Claude.
- Une personne qui n'a qu'un rôle ne voit pas la rangée.

## Les écrans, profil par profil

### Chef de centre et adjoint (casquette « Le centre »)

Maquette 9. « Cette semaine au centre » (nuits complètes, remplacements à pourvoir, engins hors service), **« À décider »** (équipe sans chef, rôle sans titulaire, fiches à compléter, fin d'engagement proche), **« Gérer »** (Agents, Nominations, Réglages, annonce à tout le centre). Les blocs d'astreinte de chaque équipe sont accessibles depuis la semaine.

### Chef d'équipe (casquette « Chef d'équipe »)

Maquette 7. En tête : « Bonjour Alice, l'Équipe 1 prend l'astreinte dans 2 jours » et une **bande des jours** de l'astreinte (point orange sur les nuits à risque) ; tout l'écran suit le jour choisi. Puis :

- **Actions rapides** : « Besoin de matériel », « Signaler une anomalie » ;
- **Peut-on partir ?** : un anneau par engin (places tenues sur places requises), la cause en clair (« le FPT ne peut pas partir mardi : il manque un conducteur COD1 ») et « Demander un renfort » ; la règle est celle de [`composition-des-gardes.md`](../../fonctionnel/composition-des-gardes.md) ;
- **Qui est là** ce jour-là : le compte et les présents en pastilles avec leur aptitude, puis les absents ;
- **Remplacements** : à pourvoir (avec « Relancer ») et pourvus (qui remplace qui) ;
- **Engins et anomalies** : engin hors service avec sa raison et son retour prévu, anomalies sans responsable avec « Je m'en charge » ;
- **Depuis la dernière astreinte** : ce qui s'est passé, les remarques des fiches de prise de garde.

### Agent (casquette « Mon astreinte »)

Maquette 8. La prochaine astreinte (avec « Je ne peux pas, remplacement »), **« À faire pour vous »** (échange demandé, inventaire à faire), les dernières nouvelles des murs.

### Référents (une casquette par rôle de référent)

Maquette 8, casquette « Pharmacie » : les besoins à traiter (quoi, pour quel engin, après intervention ou inventaire, par qui, quand), les seuils bas et les péremptions. Même schéma pour le référent engins (anomalies, fiches).

**Où arrive un besoin de matériel** : celui qui déclare choisit la nature (engin, pharmacie…). La demande arrive chez les titulaires d'un rôle qui a le niveau « Gérer » sur ce domaine ; s'il n'y en a pas, chez le chef de centre, pour qu'elle ne se perde jamais (choix de Claude).

### Comités (page d'un comité)

Maquette 10. En tête : icône, nom, membres en ronds, rapporteur. Trois onglets : **Mur** (publier, répondre, message épinglé), **Décisions** (réunions et comptes rendus), **Membres** (le rapporteur nomme). La casquette d'un comité ouvre cette page.

### Super administrateur

Choix de Claude : la vue du chef de centre (Agents avec le fichier, Nominations, Réglages), sans casquette d'astreinte. Aucun écran d'installation à part.

## Les écrans de gestion refaits

- **Réglages** (maquettes 1, 2 et 4) : les rôles rangés par thème dans des groupes repliables, avec icône, couleur et résumé (« Aucun titulaire » en orange). La page d'un rôle : modèle, pastille « Personnalisé », domaines repliés avec leur niveau, « Revenir au modèle », barre « Enregistrer / Tout revenir ». Sur ordinateur : liste et réglages côte à côte, les domaines en deux colonnes. L'icône d'un rôle se choisit dans une petite liste fixe ; le thème découle de sa portée (équipe : chefs d'équipe ; centre : référents ; comité : comités), choix de Claude.
- **Nominations** (maquette 3) : une carte par rôle, titulaires en pastilles retirables, « Nommer » ouvre un volet par le bas (agent, dates d'aujourd'hui par défaut).
- **Agents** (maquettes 5 et 6) : liste groupée par équipe (repliable, liseré de la couleur de l'équipe, chef et effectif en résumé), filtres en pastilles (Tous, À compléter, Indisponibles, Partis). La fiche : en-tête avec grade, équipe, statut, rôles avec icône, « Appeler » et « Écrire » ; puis des blocs repliés (Identité et contact, Parcours, Équipe et statut, Rôles, Départ du centre en rouge).

## Ce qui se construit quand

1. **D'abord, avec ce qui existe** : la navigation en quatre onglets et la cloche (vides là où la fonction manque, sans fausses données), les casquettes, les paquets de droits et les modèles, et la refonte de Réglages, Nominations, Agents et fiche.
2. **Ensuite, fonction par fonction** : chaque fonction de la feuille de route (astreinte, disponibilités, remplacements, composition des gardes, engins et anomalies, stock, salons, messagerie, notifications) arrive avec ses blocs dans les pages ci-dessus. Les maquettes 7 à 10 sont la cible.

## Hors périmètre

- Les fonctions elles-mêmes (planning, remplacements, stock…) : leurs propres lots.
- Les paquets créés par un centre.
- Tout changement des droits existants (profils, rôles du jeu de départ).

## Ce qui reste au constructeur

- Où vivent les modèles (jeu de départ du centre ou code) et comment « Revenir au modèle » retrouve le modèle d'un rôle existant.
- La liste des icônes de rôle et leurs couleurs (contrastes AA, clair et sombre), et le fond crème en mode sombre.
- Les composants à ajouter (groupe repliable, sélecteur à niveaux, barre d'actions collante, rangée de casquettes, bande de jours, anneau d'engin) et leur accessibilité (clavier, lecteurs d'écran).
- Le découpage en lots du point 1 de « Ce qui se construit quand ».
- La doc : `docs/technique/interface.md`, `docs/fonctionnel/acces-et-attributions.md`, aides dans `docs/utilisation/`.
