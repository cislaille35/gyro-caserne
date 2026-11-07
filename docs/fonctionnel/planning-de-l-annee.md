# Planning de l'année

## À quoi ça sert

Le chef de centre prépare l'année dans l'appli (astreintes des équipes, manœuvres, gardes de Noël et du Nouvel An) et la publie. Chaque agent lit son année dans l'onglet « Planning » et l'ajoute une fois à l'agenda de son téléphone. Plus de tableur, de PDF ni de recopie.

## Les réglages du centre (`centres/<id>/centre.ts`)

- **Relève** : jour et heure de prise et de fin d'une semaine d'astreinte (Laillé : du vendredi 18 h au vendredi suivant 6 h).
- **Heures en semaine** (`astreinte.semaine`) : en semaine, l'astreinte ne couvre que ces heures (Laillé : 18 h à 6 h). Le samedi, le dimanche et les jours fériés, elle couvre toute la journée. Sans ce réglage, l'astreinte est continue.
- **Référence** : une date de relève et son équipe ; elle sert à proposer l'ordre du roulement.

## Préparer l'année (droit « Gérer le planning » : chef de centre et adjoint)

Planning → « Préparer l'année ». L'année est civile : une semaine appartient à l'année où elle commence. En tête, deux accès : « Exporter l'année ou importer un fichier » (voir plus bas) et « Été 2027 » ([Planning d'été](planning-d-ete.md)). Puis un parcours en **cinq étapes**, avec une barre de progression et l'étiquette **Brouillon / Publiée** toujours visible ; chaque étape s'enregistre seule et l'on revient à n'importe laquelle.

1. **Roulement** : l'ordre des équipes, avec « Monter » et « Descendre » (au clavier comme au doigt) ; la première tient la première semaine. Un aperçu montre les six premières semaines.
2. **Fêtes** : l'équipe d'astreinte le 25 décembre à midi et le 31 décembre à 23 h. Avec l'historique (saisi une fois pour les années passées), l'appli signale une équipe hors de son tour (le tour revient à celle qui a tenu la fête il y a le plus longtemps, ou jamais) et **propose l'échange** avec la semaine la plus proche d'une équipe dont c'est le tour. Le chef accepte ou non ; rien n'est bloqué.
3. **Manœuvres** : en rangées ; ajout et modification dans un panneau modal (feuille du bas au téléphone, panneau latéral à l'ordinateur ; Échap le ferme et rend le focus) : date, heure, thème, lieu (« Caserne » par défaut), équipes convoquées (certaines, ou tout le centre), petit-déjeuner oui ou non.
4. **Repères** : les jours fériés sont calculés (liste repliée) ; les vacances scolaires sont saisies par le chef, pour l'affichage.
5. **Vérifier et publier** : l'année en grille de semaines colorées, l'équipe écrite dans chaque case ; toucher une semaine ouvre le choix de son équipe (la suite du roulement ne bouge pas). Un récapitulatif (semaines changées, manœuvres, fêtes, vacances), puis « Publier l'année » : avant, les agents ne voient rien ; après, tout changement est visible tout de suite. Une fois l'année publiée : une semaine **commencée ou passée** ne change plus d'équipe (à l'écran comme par le fichier) ; avant de changer une semaine à venir, le panneau montre les **remplacements conclus ou en cours** de la semaine ; après, les agents des **deux équipes** sont prévenus (« La semaine du vendredi 9 juillet passe de l'Équipe 2 à l'Équipe 3 », dans la cloche et sur le téléphone), et les personnes de ces remplacements aussi.

### Partir d'une proposition

Pour une année sans roulement, le bouton **« Partir d'une proposition »** ouvre un panneau : rien n'est écrit avant « Accepter et écrire le brouillon », qui écrit le **brouillon** d'un seul bloc ; le chef retouche chaque étape, puis publie comme d'habitude. Une année qui a déjà un roulement refuse la proposition : rien n'est écrasé.

- **État des équipes**, en tête : pour chaque équipe, son effectif au 1er janvier et si elle peut armer le FPT seule (« Équipe 3 : 6 agents, il manque 1 CE »). L'appli signale seulement : aucun agent n'est déplacé. Liens vers Agents et Nominations.
- **Roulement** : il continue celui de l'année précédente, sans rupture à la relève de janvier (une équipe archivée sort, une nouvelle entre à la fin ; jamais la même équipe de part et d'autre de la relève). Si l'année précédente n'a pas de planning : le roulement de base du centre.
- **Fêtes** : l'appli échange des semaines de fin d'année pour donner Noël et le Nouvel An aux équipes dont c'est le tour. Chaque équipe garde son nombre de semaines ; une semaine commencée ne change pas. Elle cherche dans l'ordre : le tour respecté, pas deux semaines de suite pour une équipe, le moins de semaines changées, le plus près des fêtes. Une équipe ne tient pas les deux fêtes, sauf si elles tombent dans la même semaine.
- **Compromis** : si le tour des deux fêtes est impossible (la même équipe attendue aux deux, ou les deux fêtes dans la même semaine avec deux équipes attendues), l'appli le dit clairement et garde le réglage qui s'écarte le moins du tour ; à égalité, Noël passe d'abord.
- **Manœuvres** : reprises de l'année précédente à la même place dans le mois (le 2e dimanche de mars reste le 2e dimanche de mars ; un 5e dimanche absent devient le dernier), même heure, thème, lieu et petit-déjeuner. Mêmes équipes, ou le même tour de rôle s'il se voit (la suite des équipes convoquées se répète à l'identique, au moins deux fois) : il continue où il s'était arrêté. Pas reprises : les annulées, les dates déjà passées, une manœuvre qui tomberait au même moment qu'une autre. Rien n'est annoncé avant la publication de l'année.
- **Repères** : les fériés sont calculés ; les vacances scolaires ne sont pas reprises, le panneau rappelle de les saisir ou de les importer à l'étape Repères.
- **Résumé** avant d'accepter : « 52 semaines, Noël : Équipe 2, Nouvel An : Équipe 4, 11 manœuvres reprises, Équipe 3 incomplète ».

À partir du **1er octobre**, tant que l'année suivante n'est pas publiée, l'Accueil du chef de centre et de son adjoint affiche « Planning 2027 à préparer » dans « À décider ».

### Le fichier du planning

« Exporter l'année ou importer un fichier » : tout préparer d'un coup dans Excel ou LibreOffice. Le fichier (.xlsx) a quatre onglets : Semaines, Manœuvres, Vacances scolaires, Été ; les fériés sont calculés. Une année vide donne un modèle avec le roulement calculé. À l'import, un **aperçu** montre ce qui change : rien n'est écrit avant « Valider », et rien n'est appliqué tant qu'il reste une erreur. Une manœuvre sans « Réf. » est nouvelle ; une ligne retirée retire la manœuvre (annulée si elle est déjà annoncée).

## Ce que voit l'agent

- **Accueil** : une plaque d'astreinte en tête, à la couleur de son équipe (toujours nommée) : le compte à rebours (« 19 jours avant votre astreinte », Équipe 2, du ven. 20 nov. 18 h au ven. 27 nov. 6 h), puis à l'approche l'heure de la relève (« demain 18 h »), puis « En cours » et la plage du moment. Dessous, « Me faire remplacer » et « Ajouter à mon agenda » (« Voir ma semaine » quand la relève approche). Sans équipe (chef de centre) : « Équipe 2 d'astreinte » et « Voir le planning ».
- **Accueil, à la relève** : la plaque porte aussi « Faire la prise de garde », de 2 h avant à 24 h après le début de l'astreinte.
- **Planning** : une phrase vivante en tête (« Votre équipe est d'astreinte dans 19 jours », « Vous êtes d'astreinte jusqu'à vendredi 6 h »), les **vues**, la même plaque condensée avec « Me faire remplacer » et « Ajouter à mon agenda », le lien « Remplacements » avec le nombre de demandes à traiter, le calendrier, puis **À venir** : la prochaine manœuvre (réponse Présent / Absent / Incertain sur place une fois annoncée ; commencée, elle reste 3 h, marquée « En cours », sans réponse ni échange de place), la garde de fête de son équipe, ses remplacements en cours.
- Quatre **vues** en puces, la dernière retenue sur l'appareil :
  - **Semaine** : du jour de relève à la veille de la suivante, jour par jour, les plages réelles (« 18 h – 6 h », « 24 h »), l'équipe, « X remplace Y », manœuvres, fériés ; « Me faire remplacer » pour la semaine et pour chaque jour ; flèches semaine précédente et suivante.
  - **Mois** : par semaine d'astreinte (du vendredi au jeudi), un repère (carré à la couleur de l'équipe, nom, numéro) au-dessus de ses sept jours ; ses semaines à soi en à-plat de couleur, marquées « Mon astreinte » (des cases d'au moins 44 px au téléphone) ; marques pour manœuvre, férié, fête (25 et 31 décembre), vacances, dites en toutes lettres sous la grille ; aujourd'hui en carré d'encre (et dit aux lecteurs d'écran) ; toucher un jour ouvre sa semaine.
  - **Année** : douze mois repliés sauf le mois en cours, chacun résumé (« 1 astreinte, 1 manœuvre, 1 férié ») ; « Seulement mes semaines ».
  - **Équipes** : la même présentation, pour toutes les équipes. Un agent sans équipe la voit d'emblée.
- À l'ordinateur, deux colonnes : le calendrier en grand, « À venir » à côté ; la plaque et les remplacements au-dessus.
- L'équipe de l'agent est celle de **la date** de chaque semaine : un changement d'équipe en cours d'année est suivi.

## Manœuvres annoncées toutes seules

- **Deux semaines avant**, à 8 h (ou tout de suite, entre 8 h et 21 h, pour une manœuvre ajoutée moins de deux semaines avant), l'appli publie la manœuvre sur « Le centre », signée « Planning du centre » : un événement (date, heure, lieu, thème) avec la réponse Présent / Absent / Incertain. Seuls les **convoqués** sont notifiés.
- **Petit-déjeuner** : un sondage « Petit-déjeuner ? » (Oui / Non) dans la même publication, ouvert jusqu'au **vendredi précédent, 18 h**.
- **Relance** : le mercredi qui précède la manœuvre d'au moins 2 jours, une notification aux convoqués qui n'ont pas répondu.
- **Changement ou annulation** par le chef : la publication est mise à jour ou marquée « Annulée » (on n'y répond plus, le sondage non plus) ; les convoqués sont prévenus. Si la date ne change pas, le sondage garde sa clôture.

## Abonnement d'agenda

Moi → « Ajouter à mon agenda » (aussi sur la plaque d'astreinte) : un lien personnel à ajouter une fois dans Google Agenda, l'agenda de l'iPhone ou Outlook. Il contient les astreintes aux vraies heures (par exemple du vendredi 18 h au lundi 6 h d'un seul tenant), les manœuvres (une durée de 3 h est affichée), les gardes de fêtes et les remplacements (une période cédée sort de l'agenda, une période prise à un collègue y entre). Un mode d'emploi accompagne Google Agenda, l'iPhone et Outlook. L'agenda se met à jour tout seul, à son rythme (souvent quelques heures). « Changer le lien » arrête l'ancien ; au départ de l'agent, son lien cesse de marcher.

## Exemple

En novembre, le chef prépare l'année suivante : il garde l'ordre proposé (Équipe 1, 2, 3, 4), voit que l'équipe 1 tiendrait Noël alors que l'équipe 3 ne l'a pas tenu depuis 2022, échange donc deux semaines de décembre, ajoute dix manœuvres et les vacances, puis publie. Chloé (équipe 3) ouvre l'onglet Planning ; sous « À venir » : « Garde de Noël — Votre équipe la tient, le vendredi 25 décembre. »

## Ce que la fonction ne fait pas (encore)

Déplacer des agents d'une équipe à l'autre pour armer le FPT : la proposition le signale seulement ; disponibilités et absences (hors vacances d'été). Les remplacements et échanges ont leur page : [Remplacements et échanges](remplacements-et-echanges.md).
