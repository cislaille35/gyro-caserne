# Planning de l'année — design

Date : 2026-11-01. Cadré avec le porteur ; les propositions de Claude sont à valider sur ce document (« propose, je validerai »).

Choix de Claude après relecture : l'**année est civile** (janvier à décembre, comme les fichiers du porteur ; la semaine à cheval sur deux années appartient à celle où elle commence). Un **agent sans équipe** (chef de centre, adjoint…) voit le planning de toutes les équipes, n'a pas de « prochaine astreinte », et son agenda contient les manœuvres auxquelles il est convoqué. Les notifications des manœuvres vont aux **convoqués** seulement (pas à tout le mur), et la publication est signée « Planning du centre » (nouvelle sorte d'auteur). Une manœuvre annulée garde sa publication, marquée « Annulée ».

Premier des trois lots du planning : (1) **le planning de l'année** (ce document), (2) les vacances et le planning d'été, (3) la préparation de l'année suivante.

## Pourquoi

Aujourd'hui, le chef de centre fait le planning de l'année dans un tableur (astreinte des équipes, manœuvres, gardes de Noël et du Nouvel An), le diffuse en PDF, et chaque agent le recopie dans son agenda personnel. Plusieurs outils, des recopies, des erreurs. L'appli doit donner à chaque agent une lecture claire de son année, sans recopie.

## Ce qu'on reproduit (fichiers du porteur, Laillé 2025-2026)

Les fichiers réels ont servi à comprendre ; ils ne vont pas dans le dépôt (données réelles). Jeux de test fictifs uniquement.

- **4 équipes**, astreinte **par semaine, du vendredi 18 h au vendredi suivant 6 h** (porteur). Laillé est une caserne de volontaires : en semaine, l'astreinte va de **18 h à 6 h** ; le **week-end et les jours fériés, 24 h sur 24** (porteur). Ces horaires sont des réglages du centre.
- **L'ordre des équipes n'est pas figé** (porteur) : la garde du 25 et celle du 31 décembre sont tenues par **l'équipe d'astreinte à ce moment-là**. Pour que chaque équipe y passe à son tour (tableau tenu depuis 2014), le chef ajuste l'ordre des semaines d'une année à l'autre.
- **Manœuvres** : environ une par mois, souvent un dimanche matin, un thème (« Sport + SAP », « Feux de forêt », « Sainte Barbe »…), deux équipes ou toutes.
- Repères : jours fériés, vacances scolaires, numéro de semaine.
- Le fonctionnement peut différer ailleurs : le roulement (ordre, jour de relève, durée) est un **réglage du centre**, pas du code.

## L'année, saisie par le chef (droit existant `GERER_PLANNING`)

Planning → « Préparer l'année » (chef de centre et adjoint) :

1. **Roulement** : ordre des équipes et équipe de la première semaine ; l'appli remplit toutes les semaines de l'année (relève le vendredi à 18 h, réglage du centre). Le chef peut **changer l'équipe de n'importe quelle semaine** (c'est ainsi qu'il règle le tour des fêtes).
2. **Manœuvres** : date, heure de début, thème, lieu (caserne par défaut), équipes concernées (une, plusieurs, toutes), petit-déjeuner oui/non.
3. **Noël et Nouvel An** : l'appli montre quelle équipe tient le 25 et le 31 avec le roulement saisi, et l'historique du tour (le chef saisit une fois les années passées utiles). Si une équipe y passe hors de son tour, l'appli le signale (sans bloquer). Proposer automatiquement l'ordre qui respecte le tour revient au lot 3 (préparer l'année suivante).
4. **Repères** : jours fériés calculés par l'appli ; vacances scolaires saisies par le chef (périodes), pour l'affichage seulement (choix de Claude : pas de dépendance à un service extérieur).
5. **Publier l'année** : avant, rien n'est visible des agents ; après, tout le monde la voit. Une modification après publication est visible tout de suite (et pour une manœuvre déjà annoncée, voir plus bas).

## Ce que voit l'agent (onglet Planning)

- **En haut** : « Ma prochaine astreinte » (du vendredi 18 h au vendredi 6 h, équipe), « Ma prochaine manœuvre », et la garde de fête (25 ou 31) si son équipe la tient.
- **Mon année** : semaine par semaine, ses semaines d'astreinte en évidence (couleur de son équipe **et** texte, jamais la couleur seule), ses manœuvres, ses gardes de fêtes, les fériés et les vacances scolaires. Au téléphone, une liste par mois qui défile ; à l'ordinateur, une vue de l'année en grille (12 mois).
- **Toutes les équipes** : la même vue pour le centre entier (quelle équipe est d'astreinte quand).
- L'équipe de l'agent est celle de l'effectif **à la date** de la semaine (un changement d'équipe en cours d'année est suivi).
- Rien n'est encore publié : un vide soigné « Le planning de l'année n'est pas encore publié ».

## Abonnement d'agenda (proposition de Claude, idée du porteur)

- Moi → « Ajouter à mon agenda » : un lien d'abonnement (format iCalendar) à ajouter une fois dans Google Agenda, l'agenda de l'iPhone ou Outlook ; mode d'emploi pas à pas pour chacun.
- Contenu : ses périodes d'astreinte **aux vraies heures** (en semaine 18 h – 6 h, week-end et fériés en continu : par exemple du vendredi 18 h au lundi 6 h d'un seul tenant), ses manœuvres (avec heure, lieu, thème), ses gardes de fêtes. L'agenda se met à jour tout seul quand le planning change (au rythme de l'agenda, souvent quelques heures).
- Le lien contient une clé secrète propre à l'agent, sans autre connexion ; « Changer le lien » l'invalide (lien perdu ou partagé). Au départ de l'agent, le lien cesse de marcher.

## Manœuvres publiées automatiquement (idée et délais du porteur)

- **2 semaines avant** (porteur) : la tâche de nuit publie la manœuvre sur le mur « Le centre », comme publication **événement** (date, heure, lieu, thème), avec les **équipes concernées convoquées** (mécanique existante des événements) et la réponse Présent / Absent / Incertain. Notification aux concernés (lot Notifications).
- **Petit-déjeuner** : si la manœuvre en a un, un sondage « Petit-déjeuner ? » (Oui / Non) joint à la publication, ouvert jusqu'au **vendredi** précédant la manœuvre, pour laisser le temps de commander (choix de Claude) ; la relance du mercredi le rappelle aussi. Au constructeur de choisir entre un sondage dans la même publication et une publication liée, selon ce que le modèle permet le plus simplement.
- **Relance le mercredi d'avant** (porteur ; pour une manœuvre du dimanche, le mercredi de la même semaine ; règle générale : le mercredi qui précède la manœuvre d'au moins 2 jours) : une notification aux convoqués qui n'ont pas répondu.
- **Changement ou annulation** d'une manœuvre déjà publiée : la publication est mise à jour (ou marquée annulée) et les convoqués sont prévenus.
- Auteur affiché : le centre (« Planning du centre ») plutôt qu'une personne (choix de Claude).

## Hors périmètre (lots suivants ou plus tard)

Vacances et planning d'été (lot 2) ; préparer l'année suivante en tenant compte des évolutions d'équipes (lot 3) ; disponibilités, remplacements et échanges ; composition minimale d'une garde par aptitudes ; import du tableur existant.

## Contraintes

- Migrations additives ; budget de requêtes tenu ; heure de Paris partout ; accessibilité AA (grille de l'année utilisable au clavier et lisible par un lecteur d'écran, jamais la couleur seule) ; téléphone d'abord, soigné à 1280, clair et sombre.
- Tâche de nuit existante pour les publications et relances (pas de nouveau déclencheur planifié : l'offre gratuite en limite le nombre).
- Le lien d'agenda est une donnée sensible : jamais dans les journaux, comparé en temps constant.

## Laissé au constructeur

Forme des tables, calcul des semaines, format exact du fichier d'agenda, vue de l'année.
