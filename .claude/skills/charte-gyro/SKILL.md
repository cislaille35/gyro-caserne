---
name: charte-gyro
description: Charte graphique de Gyro Caserne. À lire avant de créer ou de modifier un écran, un composant ou un style de l'appli (apps/web), même pour un petit ajout : couleurs, cartes, titres, boutons, champs, icônes, mouvement, textes. Dit ce qui fait l'identité de l'appli et ce qui la ferait ressembler à une interface générée.
---

# Charte de Gyro Caserne

Décision : [0026](../../../docs/decisions/0026-refonte-ui-2.md) (direction B). Détail technique : [`docs/technique/interface.md`](../../../docs/technique/interface.md).

Une appli de caserne, sobre et lisible, qui se tient au téléphone d'abord. Son caractère tient en quelques éléments : on n'en ajoute pas d'autres.

Pour écrire un écran : regarder d'abord un écran modèle (en bas), suivre les règles, puis vérifier.

## L'identité

- L'en-tête anthracite, « GYRO CASERNE » en Barlow Condensed, et la fine bande de marquage jaune et rouge dessous.
- Barlow Condensed pour les titres, Barlow pour le texte.
- La plaque d'astreinte (`CarteAstreinte`, l'encart en tête de l'accueil et du planning) : un à-plat de la couleur de l'équipe, le grand compte à rebours.
- La tuile de date (jour, numéro, mois).
- Gyro, seulement sur l'accueil, la connexion, les écrans vides et les réussites.
- Les couleurs d'équipe, qui viennent du centre (`centres/<id>/centre.ts`), avec le texte noir ou blanc choisi par `encreSur`.
- L'écusson du centre, s'il en a déposé un (Réglages) : à la connexion, au-dessus du titre, et en petit dans l'en-tête, devant le nom du centre. Nulle part ailleurs, jamais dans le dépôt ([0027](../../../docs/decisions/0027-ecusson-du-centre.md)). Sans écusson, l'en-tête et la connexion restent tels quels.

## Les règles

Chaque règle vérifiable est gardée par un test (`apps/web/src/formes.test.ts`, `jetons.test.ts`). Un test qui échoue dit pourquoi : on corrige l'écran, pas le test.

**Valeurs.** Couleurs, tailles de texte (`--texte-12` à `--texte-30`), espacements (`--espace-4` à `--espace-48`), rayons, largeurs de page (`--largeur-lecture`, `--largeur-liste`, `--largeur-page`), courbes et durées : toujours un jeton d'`apps/web/src/app.css`, jamais une valeur écrite dans un écran.

**Page.** Chaque écran a sa `.page` en colonne, avec la largeur qui lui va : `--largeur-lecture` pour un formulaire ou une fiche, `--largeur-liste` pour une liste, `--largeur-page` pour un tableau de bord. Une page étroite est centrée (`margin-inline: auto`), sauf dans une colonne flexible (pages filles des réglages).

**Surfaces.**
- Fond gris clair, cartes blanches et plates : ni ombre, ni bord fin, ni dégradé (seule la bande de marquage en est un). Seul trait admis : le séparateur fin entre les lignes d'une carte.
- Une carte par groupe de lignes (`ListeRangees`, `.lignes`) ; des sections qui se suivent forment une seule carte (`.pile`). Jamais une carte par ligne.
- Aucune bande ni trait de couleur sur un côté. Seule exception : la citation d'un message. Une équipe se dit par un carré de couleur et son nom.

**Titres.** Un vrai titre en Barlow Condensed (`.titre-groupe`, `.rubrique`), à l'encre, sans majuscules espacées. Sous un titre, une phrase seulement si elle apprend quelque chose.

**Icônes.** À l'encre, sans tuile colorée, et seulement si elles distinguent quelque chose (type, rôle, comité, ressource). Sinon un visage, une date, ou rien.

**États.** Une information se dit une fois.
- Un état durable : une `Pastille` (`ok`, `info`, `alerte`, `danger`, `neutre`), avec son mot.
- Une chose à traiter : le signe `alerte` de `Rangee` (à droite), avec le fait en sous-ligne.
- Jamais les deux pour la même chose. Le compteur d'un groupe (`compte` de `ListeRangees`) seulement s'il aide à décider (à traiter, non lus).
- `Rangee` : `valeur` pour un texte court à droite, `droite` pour une pastille ou des gestes ; pas les deux.

**Actions.**
- Rouge pour l'action courante de l'écran, une seule par zone : `Bouton` principal pour agir sur place dans un formulaire, `action` d'`EnTetePage` pour un lien vers un écran de saisie (« Écrire », « Réserver »).
- Un lien d'en-tête rare reste à côté du titre mais n'est pas rouge (`discrete: true` : « Préparer l'année »). Les gestes rares dans la page se rangent sous un bouton écrit, `<details class="plus">` (« Plus », « Gérer la zone »), où ils s'empilent en `Bouton` secondaire ou `.lien-secondaire`.
- `grave` (contour rouge) pour ce qui est difficile à défaire, avec un libellé sans ambiguïté (« Dissoudre le comité ») et toujours une confirmation : un dépliage qui dit ce qui sera perdu, avec « Je confirme » (`confirmation=oui`), ou un `Panneau`. Jamais au premier appui, et jamais en vue d'emblée : sous `.plus` ou dans le détail.
- Un libellé d'action : un verbe à l'infinitif et son objet (« Signaler un manque »). Jamais « OK ». « Valider » seul seulement quand l'écran ne laisse aucun doute, la suite étant lue par les lecteurs d'écran (`.masque`).
- Boutons et liens d'action en rectangles arrondis ; la pilule est réservée aux états (pastilles, compteurs, interrupteurs).
- Un choix entre quelques options : un bloc segmenté (`.segments`).

**Contrôles et composants.** Ceux d'`apps/web/src/lib/ui/` d'abord : `Bouton`, `Champ`, `Choix`, `ChoixRadio`, `ChampPhoto`, `ListeRangees`, `Rangee`, `Carte`, `Pastille`, `Visage`, `TuileDate`, `Vide`, `EnTetePage`, `Retour`, `Groupe`, `BarreActions`, `Panneau` (`lib/planning`) ; les classes d'`app.css` : `.lignes`, `.pile`, `.segments`, `.plus`, `.repli`, `.lien-secondaire`, les cases à cocher. Les dates, heures et listes gardent le sélecteur du téléphone, avec le style commun. Jamais un contrôle refait à la main dans un écran.

**Vide.** `Vide` remplace la liste, pas l'en-tête : l'action principale reste en vue. Un titre court et ce à quoi l'écran servira. Gyro y est par défaut ; `gyro={false}` pour un vide secondaire (un onglet, un sous-groupe, une conversation à commencer). Un groupe vide se masque, sauf si l'on peut y ajouter quelque chose : alors une ligne `discret` le dit.

**Navigation.** Un retour `‹ Nom` au-dessus du titre (`Retour`). Un dépliage par le chevron de `.repli`. L'action d'un écran à côté de son titre.

**Ordinateur.** Trois largeurs de page ; une page étroite est centrée. Pas de colonne vide : une colonne seule prend la place. Un écran n'est fini que soigné aux deux tailles.

## Le mouvement

- Retour à l'appui (`scale(0.97)`, 160 ms), chevron de `.repli` qui tourne, contenu qui s'ouvre sans animation, panneaux qui glissent de leur bord (240 ms, `--courbe-tiroir`), fenêtres qui apparaissent : déjà posés par `app.css` et `Panneau`. Ne pas en ajouter d'autres sans raison.
- Rien sur la navigation entre pages, les onglets ni le clavier.
- `transform` et `opacity` seulement. Le survol sous `@media (hover: hover) and (pointer: fine)`.
- « Réduire les animations » coupe tout mouvement. Un décor qui bouge s'arrête seul (10 s au plus).
- Un écran d'urgence (alerte, départ en intervention) n'a ni mouvement ni humour.

## Les textes

- Français simple, phrases courtes. Au plus deux infos reliées par « · », au-delà des virgules.
- Dates et heures par les fonctions communes, jamais à la main : `heure`, `jourEtHeure`, `deNom` (`lib/murs/quand.ts`), `jourLong`, `momentLong`, `duAu` (`lib/planning/dates.ts`), `dateCourte`, `jourCourt` (`lib/engins/textes.ts`) ; les nombres par `pluriel` (`lib/pluriel.ts`). Heures en « 19 h », « 16 h 04 ».
- « Appuyer », pas « toucher », sur un écran qui sert aussi à l'ordinateur.
- Un mot dit une fois : pas de description qui répète le titre, pas d'état dit deux fois (pastille et texte).
- Humour seulement au niveau « Vivant » du réglage Affichage (`sobre`, `equilibre`, `vivant`, voir `docs/technique/interface.md`), varié, jamais dans l'urgence.

## Ce qui ferait « interface générée »

À ne pas réintroduire : fond crème, cartes à ombre douce partout, petits titres en majuscules espacées, tuiles d'icônes pastel, dégradés, halo sous un bouton, bande de couleur sur le côté d'une carte, description sous chaque ligne, boutons de même poids alignés par cinq.

## Les écrans modèles

À imiter avant d'inventer :
- au téléphone : Caserne (`routes/caserne`), Connexion, la liste des messages ;
- à l'ordinateur : l'accueil d'un agent, une conversation, Habillement.

## Avant de dire qu'un écran est fini

1. Les tests rapides (`pnpm --filter @gyro-caserne/web test`) et les types.
2. Une capture au téléphone en clair et à l'ordinateur en sombre, regardée.
3. Accessibilité : clavier, contraste, mode contrasté, jamais une information par la seule couleur (vérifié en CI).
