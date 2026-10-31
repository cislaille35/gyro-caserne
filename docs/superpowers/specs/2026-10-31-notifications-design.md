# Notifications — design

Date : 2026-10-31. Validé dans la conversation par le porteur, sauf les points marqués « choix de Claude ».

## Pourquoi

Un agent doit savoir, sans ouvrir l'appli, qu'il se passe quelque chose qui le concerne. Aujourd'hui, rien ne sonne. La cloche compte « ce qui est à faire » et ne baisse que quand on répond : on ne sait pas ce qui est nouveau.

## Ce qui envoie une notification (porteur)

Par défaut, tout ce qui concerne l'agent, et seulement cela :

- **une publication** sur un mur qu'il peut lire (le périmètre du mur fait foi : une publication du mur de l'équipe 2 ne va qu'à l'équipe 2). Le chef de centre et son adjoint, qui lisent tous les murs, reçoivent tout, comme sur Slack aujourd'hui (porteur) ;
- **un commentaire** sous une de ses publications ;
- **un message** dans une de ses conversations (personnelle ou de groupe).

Jamais à l'auteur lui-même. Aucune exception « impossible à couper » (porteur : l'agent peut tout bloquer).

## Couper (porteur, sur proposition de Claude)

- **Par appareil** : Moi → Notifications → « Activer sur ce téléphone ». Sur iPhone, il faut d'abord ajouter l'appli à l'écran d'accueil (exigence d'Apple) : l'écran l'explique, étapes à l'appui. Plusieurs appareils par agent.
- **Mur par mur, conversation par conversation** : une cloche barrée dans l'en-tête du mur ou de la conversation (comme WhatsApp). Moi → Notifications liste ce qui est coupé, avec « Réactiver ».
- **Tout couper** : un interrupteur général dans Moi → Notifications.
- Couper ne retire que le son du téléphone : la cloche de l'appli montre toujours tout.
- **Choix de Claude** : une coupure vaut pour tout ce qui vient du lieu coupé, commentaires sous ses propres publications compris.

## La cloche de l'appli (porteur)

- Elle devient un vrai **fil de notifications** : une ligne par publication, commentaire ou signalement à traiter, du plus récent au plus ancien, groupé « Aujourd'hui / Plus tôt ».
- Le chiffre = **les notifications non lues**. Il baisse **dès qu'on consulte** une notification (on la touche, on arrive sur la publication). « Tout marquer comme lu » en haut du fil.
- **Choix de Claude** : ouvrir un mur marque lues ses publications (une seule écriture, seulement s'il y a du non-lu) ; ouvrir une publication marque lus ses commentaires.
- **Choix de Claude, signalements** : ils restent dans la cloche comme aujourd'hui, comptés **tant qu'ils ne sont pas traités** (c'est une tâche de modération, pas une nouvelle), en tête du fil, sans notification au téléphone. Le super administrateur, sans murs ni messagerie, ne voit qu'eux.
- « À ne pas manquer » (répondre à un sondage, à un événement) reste sur l'Accueil, inchangé.
- **Choix de Claude** : les messages de la messagerie ne vont pas dans la cloche. Ils ont déjà leur pastille sur Échanges et leurs « non lus » par conversation ; les doubler ferait deux compteurs pour la même chose. Ils envoient bien une notification au téléphone.

## L'en-tête (porteur)

L'icône de profil suivie de « Moi » devient **le visage seul** de l'agent (initiales, couleur d'équipe, brique `Visage`), nommé « Moi » pour les lecteurs d'écran. Super administrateur : l'icône de profil seule.

## Ce que montre la notification du téléphone (choix de Claude)

- Titre : le lieu et l'auteur (« Équipe 2 · Élodie Martin », « Message de Romain », « Départ de Thomas · Manon »).
- Texte : le début (≈ 100 caractères), comme les messageries courantes. Pas de photo.
- Toucher la notification ouvre l'appli sur la publication ou la conversation, et la marque lue.
- Plusieurs messages d'une même conversation se remplacent (une seule notification par conversation à l'écran), pour ne pas inonder le téléphone.

## Contraintes

- **Offre gratuite Cloudflare** : un appel ne peut pas faire plus de 50 sous-requêtes. Une publication sur « Le centre » peut viser plus de 50 appareils : l'envoi ne doit jamais dépasser cette limite dans l'appel de l'auteur (envoi différé et par lots, par exemple une file en base vidée par une tâche planifiée ; au constructeur de choisir). La publication de l'auteur ne doit jamais attendre ni échouer à cause des envois. Délai visé : moins d'une minute.
- **Pas de dépendance** si possible : le MVP `cis-laille` a un envoi Web Push sans bibliothèque (`src/lib/server/webpush.ts`, `notifications.ts`, `src/service-worker.ts`, `src/lib/push.ts`), à reprendre et adapter.
- **Appli installable** (manifeste, icônes, service worker) : nécessaire pour l'iPhone. Le service worker ne met rien en cache hors ligne dans ce lot (seulement recevoir et ouvrir les notifications).
- **Clés VAPID** : secrets du centre, jamais dans le dépôt ; ajouter à `docs/technique/installer-un-centre.md` comment les créer et les poser. Claude les crée et les pose pour la préprod (compte rendu dans la PR).
- **Abonnements périmés** (réponse 404/410) : supprimés.
- **Départ d'un agent** : ses abonnements et ses notifications sont supprimés.
- **Ménage** : notifications de plus de 30 jours effacées par la tâche de nuit existante (choix de Claude).
- Accessibilité AA, téléphone d'abord, clair et sombre, comme le reste. Budget de requêtes (`routes/budget.test.ts`) tenu : le compteur de la cloche est une seule lecture.
- Droits : rien de nouveau. Une notification n'est créée que pour qui peut lire la publication ou la conversation **au moment de l'envoi**.

## Hors périmètre

Réservations (lot suivant, s'appuiera sur ces notifications), heures de silence, rappels programmés, notifications par courriel, réactions (emoji) qui notifient.

## Laissé au constructeur

Forme exacte des tables (fil de notifications, abonnements, coupures), mécanique de la file d'envoi, découpage en tâches, textes d'aide exacts.

## Vérification

- Tests unitaires du socle : qui reçoit quoi (périmètre des murs, auteur exclu, coupures, départ), lecture et compteur.
- Tests de l'appli : cloche (chiffre, consultation, « Tout marquer comme lu »), Moi → Notifications, cloche barrée, en-tête visage.
- Essai réel en préprod sur un Android et un iPhone (porteur), avec les comptes de test.
