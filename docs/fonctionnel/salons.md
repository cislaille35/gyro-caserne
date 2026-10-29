# Murs (salons)

## À quoi ça sert

Diffuser l'information du centre et organiser les événements, avec **peu de murs** et l'important qui vient à chacun sur son **accueil**, sans faire le tour des salons. Remplace la vingtaine de canaux Slack (voir la [spec](../superpowers/specs/2026-10-28-murs-design.md) pour ce que devient chaque canal).

## Quatre sortes de murs

| Mur | Qui lit | Qui publie | Qui modère et épingle |
|---|---|---|---|
| **Le centre** | tous les agents | chef de centre, adjoint | chef de centre, adjoint |
| **Vie du centre** | tous les agents | tous les agents | chef de centre, adjoint |
| **Équipe N** (un par équipe, créé tout seul) | les membres de l'équipe | les membres et le chef d'équipe | le chef d'équipe |
| **Comité** (un par comité) | les membres du comité | les membres | le rapporteur |

- Le chef de centre, l'adjoint et le super administrateur lisent et modèrent **tous** les murs.
- Les droits se déduisent de l'appartenance du jour (équipe, comité, rôle) : rien à régler mur par mur. Ouvrir un mur à d'autres (un référent qui publie dans « Le centre », par exemple) viendra dans un prochain lot.
- Les **extérieurs** (réserve citoyenne), les agents **partis** ou **suspendus** n'ont accès à aucun mur.
- Le mur d'une **équipe désactivée** passe en **lecture seule**.
- Le mur d'un **comité dissous** devient une **archive en lecture seule**, visible du chef de centre, de l'adjoint et du super administrateur seulement : les anciens membres n'y ont plus accès.
- Pas de sous-salon : chaque publication a son fil de commentaires.

## Une publication

Un texte, jusqu'à 4 photos, et un **type** :

- **Message** (par défaut) ;
- **Annonce** : réservée aux modérateurs du mur ; elle peut demander une **prise de connaissance** ;
- **Événement** : date et heure, lieu, **convoqués** (tout le mur ou des équipes ; sur un mur d'équipe, l'équipe), réponse **Présent / Absent / Incertain** jusqu'au début de l'événement ;
- **Bravo** : une réussite (examen, compétition).

En option, un **sondage** : une question, 2 à 6 réponses, une seule par personne. Les résultats s'affichent **une fois qu'on a voté**, pour ne pas orienter le vote ; l'auteur et les modérateurs les voient toujours. Ils ne sont même pas envoyés au téléphone de qui n'a pas voté. On peut changer son vote.

Autour de chaque publication : « J'aime », commentaires (l'auteur ou un modérateur peut les fermer), épingle (modérateurs). L'auteur modifie ou supprime ; un modérateur supprime. La suppression est inscrite au journal, sans le contenu.

## La prise de connaissance

Sur une annonce, l'auteur (modérateur) coche « Demander une prise de connaissance ». Chaque agent du mur voit le bouton **« Pris connaissance »**, sur le mur et dans « À ne pas manquer ». L'auteur et les modérateurs voient, dans le **suivi** de la publication, qui l'a fait et qui pas encore. Pour un événement, le suivi liste présents, absents, incertains et sans réponse.

## « À ne pas manquer » sur l'accueil

En tête de l'accueil, quelle que soit la casquette :

1. les **annonces à prendre en compte**, avec le bouton « Pris connaissance » ;
2. les **événements à venir** où la personne est convoquée, avec les boutons de réponse ; la veille, l'événement est marqué « Demain » ;
3. les **sondages ouverts** auxquels elle n'a pas répondu ;
4. les **publications épinglées** récentes de ses murs ;
5. une ligne par mur avec des nouveautés depuis sa dernière visite (« Amicale : 3 nouveautés »).

La cloche « Notifications » reprend 1 à 3 en liste. Les notifications sur le téléphone viendront dans un lot à part.

## Anniversaires

« Vie du centre » souhaite chaque jour l'anniversaire des agents dont la date de naissance est inscrite, **sans l'âge**. Chacun peut le couper dans « Mon profil » (« Afficher mon anniversaire », coché par défaut).

## Photos

- Réduites dans le navigateur avant l'envoi (côté long 1 600 px), en JPEG ou WebP, **400 Ko au plus** chacune.
- Rangées **dans la base** de l'appli, sans service à part ni coût (environ 180 Mo par an).
- **Privées** : servies seulement à qui peut lire le mur, jamais par une adresse publique.
- Supprimer une publication supprime ses photos.

## Ce que la fonction ne fait pas (pour l'instant)

- Messages privés : voir [Messagerie](messagerie.md).
- Notifications sur le téléphone, mentions (@nom), recherche, fichiers autres que des photos.
- Ouvrir un mur à d'autres personnes (un référent qui publie dans « Le centre », des extérieurs).
- Durée de conservation : les murs gardent tout.

## Exemple

Le chef de centre publie dans « Le centre » l'annonce « Nouvelles consignes ARI » et demande une prise de connaissance. Chaque agent la trouve en tête de son accueil et appuie sur « Pris connaissance ». Une semaine plus tard, le suivi de l'annonce indique : « 31 ont pris connaissance, 4 pas encore », avec leurs noms.
