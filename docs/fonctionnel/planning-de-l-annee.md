# Planning de l'année

## À quoi ça sert

Le chef de centre prépare l'année dans l'appli (astreintes des équipes, manœuvres, gardes de Noël et du Nouvel An) et la publie. Chaque agent lit son année dans l'onglet « Planning » et l'ajoute une fois à l'agenda de son téléphone. Plus de tableur, de PDF ni de recopie.

## Les réglages du centre (`centres/<id>/centre.ts`)

- **Relève** : jour et heure de prise et de fin d'une semaine d'astreinte (Laillé : du vendredi 18 h au vendredi suivant 6 h).
- **Heures en semaine** (`astreinte.semaine`) : en semaine, l'astreinte ne couvre que ces heures (Laillé : 18 h à 6 h). Le samedi, le dimanche et les jours fériés, elle couvre toute la journée. Sans ce réglage, l'astreinte est continue.
- **Référence** : une date de relève et son équipe ; elle sert à proposer l'ordre du roulement.

## Préparer l'année (droit « Gérer le planning » : chef de centre et adjoint)

Planning → « Préparer l'année ». L'année est civile : une semaine appartient à l'année où elle commence. Un parcours en **cinq étapes**, avec une barre de progression et l'étiquette **Brouillon / Publiée** toujours visible ; chaque étape s'enregistre seule et l'on revient à n'importe laquelle.

1. **Roulement** : l'ordre des équipes, avec « Monter » et « Descendre » (au clavier comme au doigt) ; la première tient la première semaine. Un aperçu montre les six premières semaines.
2. **Fêtes** : l'équipe d'astreinte le 25 décembre à midi et le 31 décembre à 23 h. Avec l'historique (saisi une fois pour les années passées), l'appli signale une équipe hors de son tour (le tour revient à celle qui a tenu la fête il y a le plus longtemps, ou jamais) et **propose l'échange** avec la semaine la plus proche d'une équipe dont c'est le tour. Le chef accepte ou non ; rien n'est bloqué.
3. **Manœuvres** : en rangées ; ajout et modification dans un panneau modal (feuille du bas au téléphone, panneau latéral à l'ordinateur ; Échap le ferme et rend le focus) : date, heure, thème, lieu (« Caserne » par défaut), équipes convoquées (certaines, ou tout le centre), petit-déjeuner oui ou non.
4. **Repères** : les jours fériés sont calculés (liste repliée) ; les vacances scolaires sont saisies par le chef, pour l'affichage.
5. **Vérifier et publier** : l'année en grille de semaines colorées, l'équipe écrite dans chaque case ; toucher une semaine ouvre le choix de son équipe (la suite du roulement ne bouge pas). Un récapitulatif (semaines changées, manœuvres, fêtes, vacances), puis « Publier l'année » : avant, les agents ne voient rien ; après, tout changement est visible tout de suite. Une fois l'année publiée : une semaine **commencée ou passée** ne change plus d'équipe (à l'écran comme par le fichier) ; avant de changer une semaine à venir, le panneau montre les **remplacements conclus ou en cours** de la semaine ; après, les agents des **deux équipes** sont prévenus (« La semaine du vendredi 9 juillet passe de l'Équipe 2 à l'Équipe 3 », dans la cloche et sur le téléphone), et les personnes de ces remplacements aussi.

À partir du **1er octobre**, tant que l'année suivante n'est pas publiée, l'Accueil du chef de centre affiche « Planning 2027 à préparer » en tête de « À décider ».

## Ce que voit l'agent

- **Accueil** : une carte d'astreinte en tête, à la couleur de son équipe (toujours nommée) : « Votre équipe est d'astreinte dans 19 jours — du ven. 20 nov. 18 h au ven. 27 nov. 6 h », ou « Vous êtes d'astreinte jusqu'à vendredi 6 h » et la prochaine plage. Sans équipe (chef de centre) : « Cette semaine : Équipe 2 d'astreinte ». Elle mène au Planning.
- **Planning** : une phrase vivante en tête, la même carte avec « Me faire remplacer » et « Ajouter à mon agenda », puis **À venir** : la prochaine manœuvre (réponse Présent / Absent / Incertain sur place une fois annoncée), la garde de fête de son équipe, ses remplacements en cours.
- Quatre **vues** en puces, la dernière retenue sur l'appareil :
  - **Semaine** : du jour de relève à la veille de la suivante, jour par jour, les plages réelles (« 18 h – 6 h », « 24 h »), l'équipe, « X remplace Y », manœuvres, fériés ; flèches semaine précédente et suivante.
  - **Mois** : par semaine d'astreinte (du vendredi au jeudi), une bande à la couleur de l'équipe, numéro et équipe écrits, au-dessus de ses sept jours (des cases d'au moins 44 px au téléphone) ; marques pour manœuvre, férié, fête (25 et 31 décembre), vacances, dites en toutes lettres sous la grille ; toucher un jour ouvre sa semaine.
  - **Année** : douze mois repliés sauf le mois en cours, chacun résumé (« 1 astreinte · 1 manœuvre · 1 férié ») ; « Seulement mes semaines ».
  - **Équipes** : la même présentation, pour toutes les équipes. Un agent sans équipe la voit d'emblée.
- À l'ordinateur, deux colonnes : la carte et « À venir » à gauche, la vue à droite.
- L'équipe de l'agent est celle de **la date** de chaque semaine : un changement d'équipe en cours d'année est suivi.

## Manœuvres annoncées toutes seules

- **Deux semaines avant**, à 8 h (ou tout de suite, entre 8 h et 21 h, pour une manœuvre ajoutée moins de deux semaines avant), l'appli publie la manœuvre sur « Le centre », signée « Planning du centre » : un événement (date, heure, lieu, thème) avec la réponse Présent / Absent / Incertain. Seuls les **convoqués** sont notifiés.
- **Petit-déjeuner** : un sondage « Petit-déjeuner ? » (Oui / Non) dans la même publication, ouvert jusqu'au **vendredi précédent, 18 h**.
- **Relance** : le mercredi qui précède la manœuvre d'au moins 2 jours, une notification aux convoqués qui n'ont pas répondu.
- **Changement ou annulation** par le chef : la publication est mise à jour ou marquée « Annulée » (on n'y répond plus, le sondage non plus) ; les convoqués sont prévenus. Si la date ne change pas, le sondage garde sa clôture.

## Abonnement d'agenda

Moi → « Ajouter à mon agenda » : un lien personnel à ajouter une fois dans Google Agenda, l'agenda de l'iPhone ou Outlook. Il contient les astreintes aux vraies heures (par exemple du vendredi 18 h au lundi 6 h d'un seul tenant), les manœuvres (une durée de 3 h est affichée) et les gardes de fêtes. L'agenda se met à jour tout seul, à son rythme (souvent quelques heures). « Changer le lien » arrête l'ancien ; au départ de l'agent, son lien cesse de marcher.

## Exemple

En novembre, le chef prépare l'année suivante : il garde l'ordre proposé (Équipe 1, 2, 3, 4), voit que l'équipe 1 tiendrait Noël alors que l'équipe 3 ne l'a pas tenu depuis 2022, échange donc deux semaines de décembre, ajoute dix manœuvres et les vacances, puis publie. Chloé (équipe 3) ouvre l'onglet Planning : « Garde de Noël : votre équipe tient la garde de Noël, le vendredi 25 décembre ».

## Ce que la fonction ne fait pas (encore)

Vacances et planning d'été (lot 2) ; préparer l'année suivante en tenant compte des équipes (lot 3) ; disponibilités, remplacements, échanges ; import du tableur.
