# Échanges, lot 2 : une page chaleureuse et rangée

Date : 2026-10-29. Demande du porteur ; la plupart des choix sont de Claude, marqués « choix de Claude », à valider.
Maquettes : https://claude.ai/artifact/3aLa9SyFKH3FaFYk25y5Ys (sources dans [`2026-10-29-echanges-chaleureux/`](2026-10-29-echanges-chaleureux/)).
S'appuie sur [`2026-10-28-murs-design.md`](2026-10-28-murs-design.md) (lot 1, fusionné) et [`2026-10-26-design-ui-design.md`](2026-10-26-design-ui-design.md) (niveaux de vie, Gyro, règles).

## Pourquoi

Le porteur, en préprod : « tout est gris, mal regroupé ; on est en Vivant mais pas de logo, pas d'animation, pas de couleur : ça ne me parle pas ». Échanges sert à trois choses : **les infos du centre, les groupes, les messages perso** (porteur). Il demande aussi qu'un **sondage ait une date de début et de fin**, et qu'on **sache où une publication est visible**.

## Ce qu'on reprend ailleurs (recherche web, 2026-10-29)

- Une annonce officielle en tête, les groupes dessous (WhatsApp Communautés).
- Des sections par sorte, et les groupes sans nouveauté repliés (Slack, Discord, Telegram).
- La visibilité est celle du mur : on l'affiche sur le mur et au moment de publier (Staffbase).
- « 12 sur 38 ont confirmé » sous une annonce à lire (Haiilo).
- Les anniversaires du jour en tête (Connecteam).
- Un bravo illustré (Viva Engage).
- Une heure limite pour répondre à un sondage (TeamSnap, WhatsApp).
- Pièges écartés : classements, séries de jours, compteurs de points, notifications pour tout.

## Objectifs

1. **Ranger** la liste en sections claires, dans un ordre fixe.
2. **Donner à chaque mur une identité** : couleur, icône, dernière nouvelle.
3. **Dire qui voit** : sur le mur et au moment de publier.
4. **Réchauffer les publications** : visages, cartes par type, Gyro, selon le niveau de vie.
5. **Dater les sondages** : ouverture et clôture.

Hors objectifs : la messagerie (lot 3, déjà dessinée dans les maquettes 1 et 4), les notifications sur le téléphone, les réactions multiples (emoji), la recherche.
Anti-objectifs : une page qui clignote, une gamification, de la couleur qui porte seule une information.

## La liste (maquette 1)

Dans l'ordre :

1. **En-tête** : titre, Gyro et une phrase selon le niveau de vie (Vivant : « 5 nouveautés depuis votre dernière visite. Le café est encore chaud. » ; Équilibré : « 5 nouveautés depuis votre dernière visite. » ; Sobre : pas de Gyro, la phrase d'Équilibré). Un bouton **« Écrire »** ouvre le formulaire avec le choix du mur (voir « Publier »).
2. **« Aujourd'hui au centre »**, si au moins une ligne existe : les anniversaires du jour (règle du lot 1) et le prochain événement où la personne est convoquée et n'a pas répondu. « Souhaiter » ouvre le formulaire de Vie du centre, prérempli de « Joyeux anniversaire <prénom> ! » (choix de Claude).
3. **« Le centre »** : une grande carte rouge avec le badge « Officiel », le nombre d'annonces à confirmer et un aperçu de la dernière publication.
4. **« Mes groupes »** : mon équipe d'abord, puis Vie du centre, puis mes comités. Les comités sans nouveauté sont repliés sous « Autres comités (n, rien de neuf) » dès qu'il y en a plus de deux (choix de Claude). Les équipes et comités supervisés par le chef, l'adjoint ou le super admin sans en être membres vont dans une section **« Supervision »**, repliée (choix de Claude).
5. **« Messages »** : arrive avec le lot 3. D'ici là, la section n'existe pas. Les filtres « Tout / Murs / Messages » aussi.

Chaque ligne de mur montre :
- son pastillage (couleur et icône) ;
- son nom et sa sorte (« mon équipe, d'astreinte », « tout le monde », « comité ») ;
- la dernière publication, l'auteur en tête, tronquée à une ligne ;
- l'heure ;
- le nombre de nouveautés.

« Lecture seule » reste affiché comme aujourd'hui.

## L'identité des murs

| Mur | Couleur | Icône |
|---|---|---|
| Le centre | rouge pompier, carte pleine | maison |
| Vie du centre | turquoise (`--icone-ballon-*`) | ballon |
| Équipe N | la couleur de l'équipe (déjà en base) | son numéro |
| Comité | celle de son icône | icône choisie, sinon tirée du thème |

- **Comité** : nouvelle colonne `comite.icone`, facultative, parmi `NOMS_ICONES` ; elle se choisit dans Réglages › Comités. Sans icône choisie : `coeur` pour le thème « amicale », `etoile` pour « centre », `groupe` sinon (choix de Claude). Les teintes sont les jetons `--icone-<nom>-*` déjà en place (contrastes AA vérifiés).
- Le nom est toujours écrit en clair : la couleur ne porte jamais seule l'information.
- En mode sombre, les mêmes jetons sombres que les icônes de rôle.

## Qui voit (maquettes 2 et 3)

- En tête du mur, une bande de sa couleur avec l'icône, le nom, une phrase qui dit à quoi il sert, et **« Visible par … (N) »** :
  - Le centre et Vie du centre : « tous les agents du centre (N) » ;
  - Équipe : « les N membres de l'équipe 1, le chef et l'adjoint » ;
  - Comité : « les N membres de l'Amicale, le chef et l'adjoint ».

  N compte les membres naturels (règle `estMembre` du lot 1).
- Le **formulaire de publication** répète cette phrase sous le choix du mur, et le bouton dit « Publier dans <mur> ».
- Les phrases « à quoi il sert » sont fixées par sorte (choix de Claude) : Le centre « Les infos officielles du chef et de l'adjoint » ; Vie du centre « Pour tout le monde : sorties, sport, photos » ; équipe « Votre équipe d'astreinte » ; comité « Le comité <nom> ».

## Les publications (maquette 2)

- **Visage** de l'auteur : ses initiales sur la couleur de son équipe, ou sur du gris s'il n'a pas d'équipe. Aucune photo d'agent ne peut encore être déposée (`personne.photo` n'est rempli par rien) : la photo viendra avec « Mon profil ». Les initiales sont posées sur la couleur avec un contraste AA (texte foncé sur une couleur claire, et inversement). Son rôle principal (« Chef de centre », « Adjoint », « Chef d'équipe ») apparaît sous son nom, s'il en a un (choix de Claude).
- **Annonce à confirmer** : bordure et bandeau ambre « Annonce à lire et confirmer » (« Épinglée · … » si elle est épinglée), barre de progression et « 12 sur 38 ont confirmé ». Le compte est **visible de tous** (choix de Claude), les noms restent réservés à l'auteur et aux modérateurs, comme au lot 1. Le total compte les membres naturels du mur **au moment de la lecture**, comme le suivi du lot 1 : les superviseurs non membres n'y sont pas. Bouton pleine largeur « J'ai pris connaissance ».
- **Événement** :
  - une tuile calendrier (jour, date, mois) avec le titre, l'heure, le lieu et les convoqués ;
  - les visages des présents (3 au plus, puis le nombre) et le compte « 14 présents · 3 absents · 2 incertains » ;
  - trois boutons de réponse, chacun avec sa couleur, un signe (✓, ✕, ?) et son mot.
- **Bravo** : une carte festive dorée, des confettis dessinés (immobiles) et Gyro en tenue `victoire`. « J'aime » y devient **« Applaudir »** (même donnée).
- **Message** : une carte blanche, ses photos en grand.
- **Sondage** : dans un encart, avec son état (« Ouvert », « Ouvre le … », « Fermé ») et ses dates (« Du 29 oct. au lundi 2 nov., 20 h »).

### Selon le niveau de vie

| | Sobre | Équilibré | Vivant |
|---|---|---|---|
| Couleurs des murs, visages, cartes par type | oui | oui | oui |
| Gyro (en-tête, bravo) | non | oui, immobile | oui ; il s'anime une fois à l'arrivée (moins de 2 s) |
| Confettis du bravo | non | oui, immobiles | oui, immobiles |
| Phrase d'en-tête | neutre | simple | avec humour |

La couleur et la mise en forme ne sont pas de la décoration : elles restent au niveau Sobre (choix de Claude). « Réduire les animations » arrête Gyro, comme partout.

## Les sondages datés (maquette 3)

- Deux dates par sondage : **ouverture** (préremplie avec maintenant) et **clôture** (obligatoire, préremplie à 7 jours, ou au début de l'événement s'il s'agit d'un événement). La clôture tombe après l'ouverture et dans moins d'un an (choix de Claude).
- Avant l'ouverture, le sondage s'affiche « Ouvre le … » et refuse les votes. Après la clôture, il s'affiche « Fermé », refuse les votes et montre les **résultats à tous**. Pendant qu'il est ouvert, on garde la règle du lot 1 : on voit les résultats une fois qu'on a voté.
- Dans « À ne pas manquer », un sondage n'apparaît qu'une fois ouvert, et sort de la liste à sa clôture.
- Les dates ne se modifient pas après la publication, comme le reste hors du texte (choix de Claude ; prolonger ou fermer plus tôt pourra venir plus tard).
- Sur un événement, les réponses présent / absent / incertain s'arrêtent au début de l'événement, comme au lot 1 ; la clôture du sondage, par défaut à la même heure, peut être plus tôt mais pas après le début.
- Migration **additive** : colonnes `publication.sondage_ouverture` et `publication.sondage_cloture`, facultatives. Les sondages déjà publiés n'ont pas de dates et restent ouverts, comme aujourd'hui. Aucune donnée n'est transformée.

## Publier (maquette 3)

- Le formulaire s'ouvre depuis un mur (le mur est alors choisi d'avance) ou depuis « Écrire ». On y choisit le mur parmi ceux où la personne peut publier, puis le genre en 4 tuiles (Message, Événement, Bravo, Annonce). La tuile Annonce est proposée à tous ; la prise de connaissance reste réservée aux modérateurs, comme au lot 1.
- Sous le choix du mur : la phrase « Visible par … ».
- Au téléphone, le formulaire tient sur une page à part, et non plus en bas du mur (choix de Claude : il a pris de la place avec le choix du mur et du genre).

## La page d'un comité

Elle n'a pas encore d'onglet « Mur » (maquette 10, non construite). Quand il viendra, il reprendra les mêmes composants. Rien à faire dans ce lot.

## À l'ordinateur (maquette 5)

- À partir de 1280 px, trois colonnes : la liste des murs en sections, le mur ouvert, puis « Aujourd'hui au centre » et « À venir » (les 3 prochains événements où la personne est convoquée).
- Entre 1024 et 1279 px, deux colonnes comme aujourd'hui : la colonne de droite passe au-dessus du mur.

## Contraintes

- Le budget de requêtes reste à 45 au plus par page (test de budget). Les aperçus et les dernières publications arrivent groupés en une requête.
- RGAA AA : cibles de 44 px, contrastes vérifiés en clair et en sombre, « Réduire les animations » respecté, ni information ni état porté par la seule couleur (les boutons de réponse ont un signe, un mot et `aria-pressed`).
- Aucune dépendance ajoutée. Aucune donnée réelle dans les maquettes ni dans les tests.
- Rien de propre à un centre : les phrases sont génériques, les noms et couleurs viennent de la base.

## Ce qui reste au constructeur

- Le découpage en composants (pastille de mur, visage, tuile calendrier, encart de sondage), les noms des jetons et la façon de grouper les requêtes des aperçus.
- La phrase d'humour de l'en-tête en Vivant : quelques variantes au ton du design UI, jamais moqueuses.
- Les tests, dont l'accessibilité automatique sur chaque nouvel écran aux deux tailles.
- La doc : `docs/fonctionnel/salons.md` (ou sa version « murs »), `docs/utilisation/` (« Comment créer un sondage ? »), `docs/technique/` (migration).
