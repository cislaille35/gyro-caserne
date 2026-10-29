# Échanges, lot 3 : la messagerie

Date : 2026-10-29. Cadrée en conversation avec le porteur. Les choix de Claude sont marqués « choix de Claude ».
Maquettes : https://claude.ai/artifact/3aLa9SyFKH3FaFYk25y5Ys, rangée « Messagerie » (M1 à M5), sources dans [`2026-10-29-messagerie/`](2026-10-29-messagerie/).
S'appuie sur la doc fonctionnelle [`messagerie.md`](../../fonctionnel/messagerie.md), qu'elle précise, et sur le lot 2 [`2026-10-29-echanges-chaleureux-design.md`](2026-10-29-echanges-chaleureux-design.md) (liste, visages, jetons).

## Pourquoi

Le porteur veut que les agents écrivent à un collègue ou à un groupe **sans sortir de l'appli et sans connaître son numéro**. Cela remplace les groupes privés de Slack, comme « départ-X ».

Le fonctionnement est celui de toute messagerie. **La différence se fera sur l'interface** (porteur) : des écrans soignés, et un point d'entrée fluide et facile. Le porteur en fait une règle pour tous les écrans de l'appli.

## Objectifs

1. Écrire à quelqu'un en **deux touches** depuis Échanges.
2. Des groupes privés qu'on crée, nomme, complète et quitte, comme partout ailleurs.
3. Une conversation agréable au pouce : bulles, réponse citée, réactions, photos, coches.
4. Seuls les membres lisent. Un recours existe pour un message grave.

Hors objectifs : les notifications sur le téléphone (lot à part), les appels, les messages vocaux, les messages éphémères, les mentions @, la recherche dans les messages.
Anti-objectifs : un 5ᵉ onglet (porteur : « lourd ») ; un chef qui lit les conversations ; la pression du « vu » (pas de liste détaillée de qui a lu dans un groupe).

## Qui, et les règles (porteur, sauf mention)

- **Droit** : `UTILISER_MESSAGERIE`, déjà donné au profil « Agent » par le jeu de départ. Les extérieurs ne l'ont pas, donc pas de messagerie (doc fonctionnelle).
- **Annuaire** : tous les agents actifs (opérationnel, stagiaire, inapte temporaire) qui ont le droit. Un agent suspendu n'apparaît plus et ne lit plus rien. Un agent **parti** quitte toutes ses conversations (doc fonctionnelle).
- **Seuls les membres lisent une conversation**, y compris le chef de centre et le super administrateur. Il n'y a pas d'exception.
- **Conversation à deux** : une seule par paire de personnes. « Écrire à Manon » rouvre la conversation existante (choix de Claude). Si l'autre part ou est suspendu, l'historique reste lisible en lecture seule, avec « Manon n'est plus dans l'annuaire » à la place de la saisie (choix de Claude).
- **Groupe** :
  - **Qui fait quoi** : le créateur est **animateur** et peut nommer d'autres animateurs (choix de Claude, comme WhatsApp ; la doc fonctionnelle parlait d'un seul animateur). Seuls les animateurs ajoutent ou retirent des membres et nomment des animateurs. Tout membre peut renommer le groupe et le quitter (choix de Claude).
  - **Animateurs** : un groupe garde au moins un animateur. Si le dernier part, le plus ancien membre le devient.
  - **Taille** : 2 à 60 membres à la création. Le nom est obligatoire, 60 caractères au plus (choix de Claude).
  - **Groupe qui se vide** : il reste utilisable tant qu'il a un membre (l'animateur peut en ajouter) ; sans aucun membre, il est effacé (choix de Claude).
  - **Historique** : le nouvel arrivant voit l'historique du groupe (choix de Claude, comme Telegram, plutôt que WhatsApp : utile pour un outil de service). Un membre retiré ou qui quitte perd tout l'accès, historique compris (choix de Claude, plus simple et plus sûr).
  - **Messages système**, écrits dans le fil : création, ajout, retrait, départ, renommage, nouvel animateur.
  - **Raccourcis à la création** : « Groupe avec l'équipe N » et « Groupe avec le comité X » ajoutent d'un coup leurs membres du jour (choix de Claude). Le groupe reste indépendant : il ne suit pas les changements d'équipe.
- **Signaler** un message : il part vers ceux qui ont `MODERER_MESSAGERIE`, seul, sans le reste de la conversation (porteur, doc fonctionnelle). Ils le voient dans la cloche, avec l'auteur, la date et qui a signalé.
  - Le signalement garde une **copie du texte** du message (et ses photos), au cas où l'auteur le supprime ; cette copie est effacée quand le signalement est classé (choix de Claude).
  - Le modérateur peut **supprimer le message** pour tous (il devient « Message retiré par la modération ») ou **classer** le signalement. Les deux actions sont inscrites au journal, sans le texte. Il ne voit rien d'autre de la conversation (choix de Claude).
- **Conservation** : 12 mois par défaut, puis le message est effacé (doc fonctionnelle). La durée se règle par centre dans `centres/<id>/centre.ts` (choix de Claude ; pas d'écran de réglage dans ce lot).

## Les écrans

### La liste (maquette M1)

- Dans Échanges, deux filtres en haut : **« Murs » | « Messages »**. Le lot 2 prévoyait « Tout » : il disparaît (choix de Claude ; deux filtres suffisent et restent lisibles).
- L'adresse `/echanges` garde la vue des murs, et `/echanges/messages` donne celle des messages.
- La pastille de l'onglet Échanges, dans la barre du bas, compte les **messages non lus**. Les nouveautés des murs restent dans la liste des murs.
- La liste des conversations, de la plus récente à la plus ancienne :
  - le visage (initiales de la personne ; pour un groupe, une icône sur teinte) ;
  - le nom ;
  - l'aperçu « Auteur : … », ou « Vous : … » ;
  - l'heure (« 10 h 12 », « hier », « lun. », puis la date) ;
  - la pastille des non-lus, l'heure passant en couleur quand il y a des non-lus. Le nom et l'aperçu passent en gras.
- Une recherche filtre les conversations par nom.
- **Le bouton flottant crayon** (« Nouveau message »), en bas à droite, au-dessus de la barre de navigation.
- Phrase de bas de liste : « Seuls les membres d'une conversation la lisent. »
- Vide : Gyro et « Aucune conversation. Écrivez à un collègue avec le crayon. » (Gyro selon le niveau de vie, comme ailleurs).

### Nouveau message (maquette M2)

- Une page avec « Annuler » et une recherche (nom, prénom, surnom).
- « **Nouveau groupe** » en tête.
- « **Pour vous** » :
  - votre chef d'équipe ;
  - « Groupe avec l'équipe N », pour votre équipe ;
  - « Groupe avec <comité> », pour chacun de vos comités.
  Une ligne n'apparaît que si elle a un sens.
- « **Tout le centre** » : tous les agents de l'annuaire, rangés par nom, avec leur rôle ou leur équipe.
- Toucher une personne ouvre la conversation, qui est créée au premier message envoyé. Toucher un raccourci de groupe ouvre la création du groupe, déjà remplie.
- **Créer un groupe** :
  - choisir les membres (cases à cocher, la recherche reste en haut) ;
  - puis donner un nom, prérempli pour un raccourci (« Équipe 1 »), et une icône parmi `NOMS_ICONES` (`groupe` par défaut) ;
  - puis « Créer ».

### Une conversation (maquette M3)

- **En-tête** : retour, visage, nom, et en dessous les membres (« Claire, Manon, Romain, vous ») ou « Équipe 2 » pour une personne. Toucher l'en-tête ouvre les infos.
- **Fil** (`role="log"`, nom accessible) :
  - **Bulles** : les miennes à droite, sur une teinte chaude ; les autres à gauche, en blanc.
  - **Regroupement** : les messages consécutifs d'un même auteur, à moins de 5 minutes d'intervalle, forment un bloc. Le nom n'apparaît que sur la première bulle, et seulement dans un groupe.
  - **Nom de l'auteur en couleur**, la couleur venant de son équipe, avec un contraste AA.
  - **Heure** discrète dans la bulle. Mes messages ont leur coche.
  - **Séparateurs** de jour (« Aujourd'hui », « Hier », la date), les **messages système** centrés, et le bandeau « **N messages non lus** » à l'ouverture. On arrive à cet endroit, sinon en bas.
  - Un bouton « **↓** » avec le nombre de nouveaux messages quand on lit plus haut. Sans lui, pas de défilement automatique.
- **Coches** : « envoyé » (✓) puis « lu » (✓✓).
  - En conversation à deux : lu par l'autre. Dans un groupe : lu par tous les membres présents à l'envoi qui n'ont pas coupé leurs coches ; ceux qui les ont coupées ne comptent pas (choix de Claude).
  - Chacun peut les couper dans « Mon profil ». Il ne montre alors plus ses lectures et ne voit plus celles des autres, comme WhatsApp (choix de Claude).
  - Pas de liste « lu par » dans un groupe (choix de Claude : éviter la pression).
  - Toujours accompagnées d'un texte pour les lecteurs d'écran.
- **Gestes sur un message** (appui long au doigt, bouton « ⋯ » au clavier et à la souris) :
  - répondre (citation au-dessus du champ, puis dans la bulle ; toucher la citation remonte au message) ;
  - réagir : 6 réactions fixes, 👍 ❤️ 😂 😮 😢 👏, une par personne, toucher à nouveau la retire (choix de Claude) ;
  - copier ;
  - modifier son message dans les 15 minutes, avec la mention « modifié » (choix de Claude) ;
  - supprimer son message : « Message supprimé » reste à sa place ;
  - signaler (pas sur ses propres messages).
  - Au téléphone, **glisser une bulle vers la droite** répond aussi, en plus du menu, jamais à sa place.
- **Saisie** :
  - un champ qui grandit jusqu'à 5 lignes, « + » pour les photos (4 au plus, réduites comme sur les murs) et le bouton d'envoi ;
  - à l'ordinateur, Entrée envoie et Maj + Entrée va à la ligne ;
  - 4 000 caractères au plus ;
  - le brouillon est gardé sur l'appareil, par conversation, si on quitte (choix de Claude).

### Infos du groupe (maquette M4)

- Icône, nom, « Groupe · N membres · créé par X », « Renommer », et la phrase « Seuls les membres lisent ce groupe. »
- Liste des membres : « Animateur » en texte, puis un menu par membre (écrire, nommer animateur, retirer ; seuls les animateurs voient les deux derniers). « Ajouter des membres » est réservé aux animateurs.
- « **Quitter le groupe** », avec une confirmation.
- Pour une conversation à deux : la fiche courte de la personne (équipe, rôle, téléphone s'il le montre) et « Voir la fiche ».

### À l'ordinateur (maquette M5)

- À partir de 1024 px : la liste des conversations à gauche, la conversation au centre.
- À partir de 1280 px : en plus, les infos du groupe à droite.
- Même découpage que le lot 2, et même règle : l'ordre au clavier suit l'ordre affiché.

### Les autres points d'entrée

- **Fiche agent** : un bouton « Écrire », s'il a le droit et si ce n'est pas soi.
- **Publication d'un mur** : « Répondre en privé » dans le menu de la carte, qui ouvre la conversation avec l'auteur en citant le début de la publication (choix de Claude).

## Rafraîchissement

- **Interrogation régulière** :
  - toutes les **4 s**, quand une conversation est ouverte et visible ;
  - toutes les **30 s** sur la liste et pour la pastille, partout dans l'appli ;
  - arrêt quand l'onglet est masqué ;
  - relance immédiate après un envoi.
- Chaque appel ne lit que ce qui a changé depuis le dernier vu.
- Pourquoi (choix de Claude, d'après la recherche) : 40 agents tiennent largement dans la formule gratuite de Cloudflare (100 000 requêtes par jour). Aucune brique nouvelle n'est nécessaire. Les WebSockets (Durable Objects) viendront seulement si le délai gêne.
- Sans JavaScript, la page se recharge à l'envoi. La conversation reste lisible et utilisable.

## Contraintes

- **Budget** : 45 requêtes D1 au plus par page. Un appel de rafraîchissement doit être **très léger** (2 à 3 requêtes, test de budget).
- **D1** : pas de colonnes de même nom dans un batch, 100 paramètres au plus par requête, ligne de 2 Mo au plus (photos rangées en base comme sur les murs, 400 Ko chacune au plus).
- **Vie privée** :
  - le texte des messages n'est **jamais** inscrit au journal, seulement les actions (création, ajout, retrait, signalement) ;
  - les photos sont servies par l'appli après vérification d'appartenance ;
  - un signalement ne transmet que le message signalé.
- **RGAA AA** :
  - `role="log"` sur le fil ; aucune annonce « assertive » ;
  - un texte pour les coches, les heures et les réactions ;
  - un menu de gestes utilisable au clavier ;
  - cibles de 44 px, contrastes en clair et en sombre ;
  - « réduire les animations » respecté.
- **Écran soigné aux deux tailles**, avec des captures vérifiées à chaque tâche (règle du porteur).
- Rien de propre à un centre. Aucune dépendance ajoutée.

## Ce qui reste au constructeur

- Le modèle de données : conversation (à deux ou groupe), membres (rôle, entrée, dernière lecture, coches coupées), message (texte, réponse à, modifié, supprimé), photos, réactions, signalement. La création se fait au premier message pour une conversation à deux.
- L'effacement après la durée de conservation : un déclencheur planifié Cloudflare, gratuit, ou un effacement à la lecture.
- Le découpage en composants, la gestion du défilement et du brouillon, le geste de glissement (Pointer Events, sans bibliothèque).
- La phrase du vide en Vivant, au ton du design UI.
- Les tests, dont un test de budget pour le rafraîchissement, et l'accessibilité Playwright aux deux tailles.
- La doc : `docs/fonctionnel/messagerie.md` alignée (animateurs multiples, historique visible ; retirer « couper les notifications sauf mention », les mentions étant hors lot), `docs/utilisation/` (« Comment écrire à un collègue ? », « Comment créer un groupe ? »), `docs/technique/`. Ajouter dans `CLAUDE.md` la règle du porteur : « Chaque écran est soigné et son point d'entrée pensé pour être fluide : c'est l'interface qui fait adopter l'appli. »
