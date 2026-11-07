# 0013 — Planning de l'année : semaines calculées, heures réglées par le centre, annonces le matin

- **Contexte** : remplacer le tableur du chef (astreinte des équipes, manœuvres, fêtes) par l'appli, sans recopie par les agents ([la spec](../superpowers/specs/2026-11-01-planning-annee-design.md)).
- **Choix** :
  - **Semaines calculées, pas enregistrées** : en base, l'ordre du roulement par année et les seules semaines changées par le chef. Les semaines, leurs heures, l'équipe de Noël et du Nouvel An se recalculent à chaque lecture (moins de 60 semaines).
  - **Heures réglées par le centre** (`astreinte.semaine` dans `centre.ts`) : en semaine 18 h – 6 h à Laillé ; samedi, dimanche et fériés en continu. Un jour de relève férié ou de week-end, l'équipe sortante reste jusqu'à la relève.
  - **Fériés** : les onze fériés nationaux calculés (Pâques par l'algorithme grégorien), sans service extérieur.
  - **Fêtes** : Noël = l'équipe d'astreinte le 25 décembre à midi ; Nouvel An = le 31 décembre à 23 h. Tour : l'équipe attendue est celle qui a tenu la fête il y a le plus longtemps, ou jamais.
  - **Manœuvres** : un événement avec son sondage dans **la même publication** (le modèle des murs le permet), auteur `planning` affiché « Planning du centre ». Annoncées **à 8 h** (passages de 8 h et 8 h 10 de la tâche de chaque minute), pas par la tâche de 3 h 30 UTC : les téléphones ne sonnent pas en pleine nuit, et aucun déclencheur planifié n'est ajouté. Une manœuvre enregistrée (ou une année publiée) entre 8 h et 21 h est annoncée tout de suite si elle tombe dans les deux semaines. Une manœuvre annoncée l'est une seule fois (`annoncee_le`), même si un modérateur supprime sa publication.
  - **Agenda** : fichier iCalendar en UTC, servi à `/agenda/<id>-<clé>.ics`. Clé aléatoire de 32 octets, gardée en clair (pour réafficher le lien), comparée en temps constant, jamais journalisée par l'appli. 404 sans détail sinon. La clé est dans le chemin de l'adresse : si les journaux de requêtes de Cloudflare sont activés pour le centre, elle y figure (« Changer le lien » la remplace). Une manœuvre y dure 3 h.
- **Pourquoi** : peu de données, rien à resynchroniser quand le roulement change, gratuit.
- **Conséquences** : changer un réglage d'heures dans `centre.ts` change aussi l'affichage des années passées.
- **Validé par** : le porteur du projet, à la fusion de la PR #28 (01/11/2026).
- **Remplacée en partie** par la [révision du 6 novembre 2026 de 0012](0012-notifications-file-d-envoi.md#révision-du-6-novembre-2026--envoi-immédiat-réveil-toutes-les-cinq-minutes) : les annonces de 8 h et 8 h 10 partent du réveil de toutes les cinq minutes.
