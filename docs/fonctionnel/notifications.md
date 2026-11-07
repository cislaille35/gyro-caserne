# Notifications

## À quoi ça sert

Savoir, sans ouvrir l'appli, qu'il se passe quelque chose qui vous concerne ; et retrouver dans la cloche ce qui est arrivé.

## Ce qui envoie une notification

Tout ce qui concerne l'agent, et seulement cela, jamais à l'auteur lui-même :

- **une publication** sur un mur qu'il lit. Le périmètre du mur fait foi : une publication du mur de l'équipe 2 ne va qu'à l'équipe 2. Le chef de centre et son adjoint, qui lisent tous les murs, reçoivent tout ;
- **un commentaire** sous une de ses publications ;
- **un message** dans une de ses conversations (au téléphone seulement : les messages ont déjà leur pastille sur Échanges) ;
- **une réservation** : une demande à trancher chez qui gère la ressource, l'accord, le refus ou l'annulation chez le demandeur (voir [Réservations](reservations.md)).

Seul qui peut lire la publication ou la conversation **au moment de l'envoi** est prévenu.

## Au téléphone

- Moi → Notifications → « Activer sur ce téléphone ». Plusieurs appareils par agent.
- Sur iPhone, il faut d'abord ajouter l'appli à l'écran d'accueil (exigence d'Apple) : l'écran l'explique, étapes à l'appui (voir « Installer l'appli » plus bas).
- La notification dit le lieu et l'auteur (« Équipe 2 · Élodie Martin », « Message de Romain », « Départ de Thomas · Manon ») et le début du texte. Pas de photo.
- La toucher ouvre sa page et marque lue sa ligne de la cloche, quelle qu'elle soit (avis d'été, rappel des vacances, anomalie compris) : elle passe par la même adresse que la cloche (`/notifications/ouvrir`). Sans ligne de cloche (un message, une demande de réservation à trancher, une vigilance rouge), elle ouvre sa page directement.
- Plusieurs messages d'une même conversation se remplacent : une seule notification par conversation à l'écran.
- Délai : tout de suite (quelques secondes) jusqu'à 20 téléphones ; au-delà, le reste dans les cinq minutes, puis cinq minutes de plus par tranche de 40 (« Le centre » avec 100 appareils : 20 tout de suite, le reste en 10 minutes au plus). Une notification refusée par le téléphone n'est pas renvoyée. Un envoi interrompu de notre côté (coupure de Cloudflare) n'est pas perdu : il repart 5 à 10 minutes plus tard. Il remplace la notification encore affichée au lieu de s'ajouter, et ne recouvre jamais une notification plus récente de la même conversation ou publication.

## La pastille sur l'icône

- L'icône de l'appli installée porte le **chiffre de la cloche** : le même nombre, des mêmes sources (non lues, remplacements à valider, messages signalés pour qui modère, réservations à trancher). Les messages n'y comptent pas : ils ont leur pastille sur Échanges.
- Appli fermée, chaque notification reçue apporte le nombre du moment, et la pastille se met à jour. Appli ouverte, elle suit la cloche, relue après chaque lecture. Déconnecté, elle s'efface.
- iPhone (16.4 ou plus récent, appli sur l'écran d'accueil) et ordinateur (Chrome ou Edge, appli installée) : le nombre. Android : souvent un simple point, selon le téléphone. Ailleurs : rien.
- Une notification coupée (mur, conversation, « Tout couper ») n'arrive pas, et une lecture faite sur un autre appareil ne se voit pas tout de suite : la pastille se met à jour à la prochaine notification reçue, ou à l'ouverture de l'appli.

## Installer l'appli

- **Accueil** : tant que l'appli n'est pas installée, un encart discret. Sur iPhone, les deux gestes (Partager, puis « Sur l'écran d'accueil »), avec l'argument : sans installation, ni notification ni pastille. Avec Chrome ou Edge (Android, ordinateur), le bouton « Installer Gyro Caserne », qui ouvre la fenêtre d'installation du navigateur. Ailleurs (Firefox, par exemple), rien sur l'Accueil.
- « Plus tard » cache l'encart **5 jours** sur ce navigateur.
- **Moi → Installer l'appli** : toujours là, sauf dans l'appli installée ; donne aussi le chemin du menu du navigateur quand il n'y a pas de bouton.
- Rien sur la page de connexion. Déjà installée : rien nulle part.
- Pas à pas : [Comment installer l'appli sur mon téléphone ?](../utilisation/installer-l-appli.md).

## Couper

- **Un mur ou une conversation** : le haut-parleur dans son en-tête (barré quand c'est coupé). Une seule cloche à l'écran : celle de l'appli. Une coupure vaut pour tout ce qui vient de ce lieu, commentaires sous ses propres publications compris.
- **Tout** : l'interrupteur « Tout couper » de Moi → Notifications, qui liste aussi ce qui est coupé, avec « Réactiver ».
- Couper ne retire que le son du téléphone : la cloche de l'appli montre toujours tout. Aucune notification n'est impossible à couper.

## La cloche

- Un fil : une ligne par publication, commentaire, réponse à une réservation, avis de remplacement, de l'été ou d'anomalie, du plus récent au plus ancien, « Aujourd'hui » puis « Plus tôt » (50 lignes au plus).
- Le chiffre compte les **non lues**. Toucher une ligne de la cloche la marque lue, quelle qu'elle soit, puis ouvre sa page. Ouvrir un mur marque lues ses publications ; ouvrir une publication la marque lue avec ses commentaires. Ouvrir une demande de remplacement marque lus ses avis ; ouvrir l'été (chef) marque lus les avis qui y mènent (« vacances changées »), pas le rappel de donner ses vacances, qui mène à « Mes vacances ». Le chiffre baisse dès la page ouverte. Une ligne non lue se reconnaît à son titre en gras et à son point ; les lecteurs d'écran disent « Non lu ». « Tout marquer comme lu » en haut du fil.
- Pour qui gère une ressource, les demandes de réservation à trancher restent en tête et comptent tant que personne n'a tranché (elles sonnent une fois au téléphone).
- Pour qui modère, les messages signalés restent en tête et comptent tant qu'ils ne sont pas traités (sans notification au téléphone). Le super administrateur ne voit qu'eux.
- « À ne pas manquer » (répondre à un sondage, à un événement) reste sur l'Accueil.

## Les règles

- Les notifications de plus de 30 jours sont effacées chaque nuit.
- Au départ d'un agent, ses appareils et ses notifications sont effacés. Se déconnecter désabonne l'appareil : un téléphone partagé ne reçoit plus les notifications du compte qui l'a quitté.
- Pas d'heures calmes dans l'appli : le mode « Ne pas déranger » du téléphone s'en charge. Pas d'alerte opérationnelle : c'est le rôle du CTA-CODIS.

## Ce que la fonction ne fait pas (encore)

Rappels programmés, courriels, réactions qui notifient.

## Exemple

Élodie publie « Manœuvre samedi 9 h » sur le mur de l'équipe 2. Romain (équipe 2) reçoit sur son téléphone « Équipe 2 · Élodie Martin — Manœuvre samedi 9 h » ; la cloche de son appli et l'icône sur son écran d'accueil passent à 1. Il touche la notification : la publication s'ouvre, le chiffre retombe, sur l'icône aussi. Manon, qui a coupé le mur de l'équipe 2, ne reçoit rien au téléphone, mais la publication est dans sa cloche.
