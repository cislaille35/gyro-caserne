# Planning de l'année

## À quoi ça sert

Le chef de centre prépare l'année dans l'appli (astreintes des équipes, manœuvres, gardes de Noël et du Nouvel An) et la publie. Chaque agent lit son année dans l'onglet « Planning » et l'ajoute une fois à l'agenda de son téléphone. Plus de tableur, de PDF ni de recopie.

## Les réglages du centre (`centres/<id>/centre.ts`)

- **Relève** : jour et heure de prise et de fin d'une semaine d'astreinte (Laillé : du vendredi 18 h au vendredi suivant 6 h).
- **Heures en semaine** (`astreinte.semaine`) : en semaine, l'astreinte ne couvre que ces heures (Laillé : 18 h à 6 h). Le samedi, le dimanche et les jours fériés, elle couvre toute la journée. Sans ce réglage, l'astreinte est continue.
- **Référence** : une date de relève et son équipe ; elle sert à proposer l'ordre du roulement.

## Préparer l'année (droit « Gérer le planning » : chef de centre et adjoint)

Planning → « Préparer l'année ». L'année est civile : une semaine appartient à l'année où elle commence.

1. **Roulement** : l'ordre des équipes ; la première tient la première semaine. L'appli remplit toutes les semaines.
2. **Semaines** : le chef change l'équipe de n'importe quelle semaine (c'est ainsi qu'il règle le tour des fêtes). La suite du roulement ne bouge pas.
3. **Noël et Nouvel An** : l'appli montre l'équipe d'astreinte le 25 décembre à midi et le 31 décembre à 23 h. Avec l'historique (saisi une fois pour les années passées), elle signale une équipe qui passe hors de son tour : c'est le tour de celle qui a tenu la fête il y a le plus longtemps, ou jamais. Elle ne bloque pas.
4. **Manœuvres** : date, heure, thème, lieu (« Caserne » par défaut), équipes convoquées (certaines, ou tout le centre), petit-déjeuner oui ou non.
5. **Repères** : les jours fériés sont calculés ; les vacances scolaires sont saisies par le chef, pour l'affichage.
6. **Publier** : avant, les agents ne voient rien ; après, tout changement est visible tout de suite.

## Ce que voit l'agent

- En haut : « Ma prochaine astreinte » (avec les heures, et « En cours » s'il y est), « Ma prochaine manœuvre », la garde de Noël ou du Nouvel An si son équipe la tient.
- « Mon année » : douze mois, semaine par semaine ; ses semaines sont marquées « Mon astreinte » (en texte et en couleur). Fériés, vacances, ses manœuvres et les fêtes sont écrits sous la semaine.
- « Toutes les équipes » : la même vue pour tout le centre. Un agent sans équipe (chef de centre, adjoint) la voit d'emblée.
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
