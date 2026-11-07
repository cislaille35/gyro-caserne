# Murs (salons)

## À quoi ça sert

Diffuser l'information du centre et organiser les événements, avec **peu de murs** et l'important qui vient à chacun sur son **accueil**, sans faire le tour des salons. Remplace la vingtaine de canaux Slack (voir la [spec](../superpowers/specs/2026-10-28-murs-design.md) pour ce que devient chaque canal).

## Quatre sortes de murs

| Mur | Qui lit | Qui publie | Qui modère et épingle |
|---|---|---|---|
| **Le centre** | tous les agents | chef de centre, adjoint | chef de centre, adjoint |
| **Vie du centre** | tous les agents | tous les agents | chef de centre, adjoint |
| **Équipe N** (un par équipe, créé tout seul) | les membres de l'équipe | les membres et le chef de garde | le chef de garde |
| **Comité** (un par comité) | les membres du comité | les membres | le rapporteur |

- Le chef de centre, l'adjoint et le super administrateur lisent et modèrent **tous** les murs.
- Les droits se déduisent de l'appartenance du jour (équipe, comité, rôle) : rien à régler mur par mur. Ouvrir un mur à d'autres (un référent qui publie dans « Le centre », par exemple) viendra dans un prochain lot.
- Les **extérieurs** (réserve citoyenne), les agents **partis** ou **suspendus** n'ont accès à aucun mur.
- Le mur d'une **équipe désactivée** passe en **lecture seule**.
- Le mur d'un **comité dissous** devient une **archive en lecture seule**, visible du chef de centre, de l'adjoint et du super administrateur seulement : les anciens membres n'y ont plus accès.
- Pas de sous-salon : chaque publication a son fil de commentaires.

## La page Échanges

En haut, deux onglets : **« Murs »** et **« Messages »** (la [messagerie](messagerie.md), avec le nombre de messages non lus). Les murs sont rangés en sections, dans un ordre fixe (voir la [spec du lot 2](../superpowers/specs/2026-10-29-echanges-chaleureux-design.md)) :

1. **En-tête** : Gyro et le nombre de nouveautés depuis la dernière visite ; le bouton **« Écrire »** ouvre le formulaire de publication.
2. **« Aujourd'hui au centre »** : les anniversaires du jour (« Souhaiter » prépare un message dans Vie du centre) et le prochain événement où la personne est convoquée sans avoir répondu.
3. **« Le centre »** : une grande carte rouge « Officiel », avec les annonces à confirmer et la dernière publication.
4. **« Mes groupes »** : mon équipe, Vie du centre, puis mes comités. Plus de deux comités sans nouveauté : ils sont repliés sous « Autres comités ».
5. **« Supervision »**, repliée : les équipes et comités que le chef, l'adjoint ou le super administrateur voient sans en être membres.

Chaque mur a sa **couleur** et son **icône** : rouge et maison pour Le centre, turquoise et ballon pour Vie du centre, la couleur et le numéro de l'équipe, l'icône du comité (choisie dans Réglages › Comités, sinon tirée de son thème). Son nom est toujours écrit : la couleur ne porte jamais seule l'information. Chaque ligne montre la dernière publication, son heure et le nombre de nouveautés.

**À l'ordinateur**, sur un mur : la liste à gauche, le mur au milieu, et à droite « Aujourd'hui au centre » et **« À venir »** (les 3 prochains événements où la personne est convoquée ; celui qui a commencé y reste, « En cours, depuis 19 h », jusqu'à sa fin). Sur un écran moins large (1024 à 1279 px), cette colonne passe sous le mur, pour qu'on la lise et l'atteigne au clavier dans le même ordre.

## Qui voit

En tête de chaque mur, une bande à sa couleur dit à quoi il sert et **qui le voit** : « Visible par tous les agents du centre (38) », « Visible par les 9 membres de l'équipe 1, le chef et l'adjoint ». Le nombre compte les membres du mur, sans les superviseurs. Le formulaire de publication répète cette phrase sous le choix du mur.

## Une publication

Elle se prépare sur sa propre page (« Écrire », ou « Publier dans … » depuis un mur) : on y choisit le mur, puis le genre. Un texte, jusqu'à 4 photos, et un **type** :

- **Message** (par défaut) ;
- **Annonce** : peut demander une **prise de connaissance**, réservée aux modérateurs du mur ;
- **Événement** : date et heure, lieu, **convoqués** (tout le mur ou des équipes ; sur un mur d'équipe, l'équipe), réponse **Présent / Absent / Incertain** jusqu'au début de l'événement. Un événement n'a pas d'heure de fin : il dure **3 h**. Pendant ce temps, il est marqué « En cours » (écrit, pas seulement en couleur) et les boutons de réponse disparaissent ;
- **Bravo** : une réussite (examen, compétition).

Chaque publication montre le **visage** de son auteur (ses initiales sur la couleur de son équipe, gris s'il n'en a pas ou s'il est parti) et son rôle (« Chef de centre », « Adjoint », « Chef de garde »). Chaque type a sa carte : l'annonce à confirmer, bordée d'ambre, avec « 12 sur 38 ont confirmé » (le nombre est visible de tous, les noms restent réservés à l'auteur et aux modérateurs) ; l'événement, avec une tuile calendrier, les présents et trois boutons qui portent chacun un signe et un mot ; le bravo, doré, avec des confettis et Gyro en tenue de victoire (« J'aime » y devient « Applaudir »).

En option, un **sondage** : une question, 2 à 6 réponses, une seule par personne, une date d'**ouverture** (maintenant, par défaut) et de **clôture** (préremplie dans 7 jours ; pour un événement, à son début, sans dépasser un an après l'ouverture). La clôture tombe après l'ouverture, moins d'un an après, et pour un événement au plus tard à son début. Avant l'ouverture, il s'affiche « Ouvre le … » et refuse les votes. Pendant qu'il est ouvert, les résultats s'affichent **une fois qu'on a voté**, pour ne pas orienter le vote ; l'auteur et les modérateurs les voient toujours, et ils ne sont même pas envoyés au téléphone de qui n'a pas voté. On peut changer son vote. Fermé, il refuse les votes et montre les résultats **à tous**. Les dates ne se changent pas après la publication. Un sondage publié avant les dates reste ouvert. Voir [Comment créer un sondage ?](../utilisation/comment-creer-un-sondage.md).

Autour de chaque publication : « J'aime », commentaires (l'auteur ou un modérateur peut les fermer), épingle (modérateurs, dix publications épinglées au plus par mur). L'auteur modifie ou supprime ; un modérateur supprime. La suppression est inscrite au journal, sans le contenu.

### Selon la présence de Gyro

Couleurs, visages et cartes restent à tous les niveaux. Gyro (en-tête, bravo) n'apparaît pas en Sobre, reste immobile en Équilibré et s'anime une fois à l'arrivée en Vivant ; « Réduire les animations » l'arrête. La phrase d'en-tête prend une pointe d'humour en Vivant.

## La prise de connaissance

Sur une annonce, l'auteur (modérateur) coche « Demander une prise de connaissance ». Chaque agent du mur voit le bouton **« Pris connaissance »**, sur le mur et dans « À ne pas manquer ». L'auteur et les modérateurs voient, dans le **suivi** de la publication, qui l'a fait et qui pas encore. Pour un événement, le suivi liste présents, absents, incertains et sans réponse.

## « À ne pas manquer » sur l'accueil

Sur l'accueil, quelle que soit la casquette :

1. les **demandes de remplacement** reçues qui attendent une réponse (« Accepter ou refuser ») ;
2. les **événements à venir ou en cours** où la personne est convoquée, avec les boutons de réponse ; la veille, l'événement est marqué « Demain ». Commencé, il reste jusqu'à sa fin (3 h après le début), marqué « En cours », sans boutons : il n'attend plus rien de la personne ;
3. les **annonces à prendre en compte** (90 derniers jours), avec le bouton « Pris connaissance » ;
4. les **sondages ouverts** auxquels elle n'a pas répondu (pas avant leur ouverture, plus après leur clôture) ;
5. les **publications épinglées** récentes (30 jours) de ses murs ;
6. une ligne par mur avec des nouveautés depuis sa dernière visite (« Amicale : 3 nouveautés »).

Sous « Bonjour », une phrase compte ce qui attend un geste (« 2 publications vous attendent ») : annonces, événements sans réponse, sondages. La cloche ne les reprend pas ; elle signale les nouvelles publications et les commentaires (voir [Notifications](notifications.md)).

## Anniversaires

« Vie du centre » souhaite chaque jour l'anniversaire des agents dont la date de naissance est inscrite, **sans l'âge**. Chacun peut le couper dans « Mon profil » (« Afficher mon anniversaire », coché par défaut).

## Photos

- Réduites dans le navigateur avant l'envoi (côté long 1 600 px, moins pour une photo très détaillée), en JPEG ou WebP, **200 Ko au plus** chacune.
- Rangées dans **une base à part**, réservée aux photos, sans coût : elle tient 500 Mo, environ 2 500 photos. La page Réglages montre la place prise (« Photos : 120 Mo sur 500 Mo ») au chef de centre, à l'adjoint et au super administrateur, avec une alerte à partir de 80 %. Voir [0010](../decisions/0010-photos-dans-leur-base.md).
- **Privées** : servies seulement à qui peut lire le mur, jamais par une adresse publique.
- Supprimer une publication supprime ses photos.

## Conservation

- Les publications sont **effacées après 24 mois** (réglage du centre, `conservationPublicationsMois`), chaque nuit : avec leurs photos, commentaires, « J'aime », réponses aux événements, votes, prises de connaissance et les lignes de la cloche qui y mènent. Les **épinglées** restent ; un événement reste 24 mois après sa date.
- Une publication **épinglée** est gardée tant qu'elle l'est ; désépinglée, elle part la nuit suivante si elle a passé l'âge. Un événement daté après la limite est gardé jusqu'à ce que sa date la passe.
- Une manœuvre du planning reste au planning ; seule son annonce sur « Le centre » part. Le journal des gestes (qui a publié, supprimé…) reste.
- Pourquoi : voir [0023](../decisions/0023-conservation-des-publications.md).

Exemple : le 7 novembre 2026, la nuit efface ce qui a été publié avant le 7 novembre 2024, sauf les consignes épinglées sur « Le centre ».

## Ce que la fonction ne fait pas (pour l'instant)

- Messages privés : voir [Messagerie](messagerie.md).
- Mentions (@nom), recherche, fichiers autres que des photos.
- Ouvrir un mur à d'autres personnes (un référent qui publie dans « Le centre », des extérieurs).

## Exemple

Le chef de centre publie dans « Le centre » l'annonce « Nouvelles consignes ARI » et demande une prise de connaissance. Chaque agent la trouve en tête de son accueil et appuie sur « Pris connaissance ». Une semaine plus tard, le suivi de l'annonce indique : « 31 ont pris connaissance, 4 pas encore », avec leurs noms.
