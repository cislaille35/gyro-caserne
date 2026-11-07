# 0012 — Notifications : Web Push maison, envoi dès le geste, file en filet toutes les cinq minutes

- **Contexte** : prévenir l'agent au téléphone d'une publication, d'un commentaire ou d'un message. Offre gratuite de Cloudflare : 50 sous-requêtes et 50 requêtes D1 par appel, 10 ms de calcul. Une publication sur « Le centre » peut viser plus de 50 appareils, et la publication de l'auteur ne doit jamais attendre ni échouer à cause des envois.
- **Options** :
  1. tout envoyer dans la requête de l'auteur (en arrière-plan) : bloqué au-delà de 50 appareils ;
  2. une file en base, vidée par une tâche planifiée chaque minute, par lots ;
  3. Cloudflare Queues : un consommateur par lot, mais une brique de plus à créer pour chaque centre.
- **Choix** : option 2.
  - Après la réponse (`waitUntil`), `notifier…` calcule les destinataires, écrit le fil de la cloche et met en file un envoi par appareil non coupé : 2 requêtes D1.
  - Chaque minute (`* * * * *`), un lot de **40 envois au plus** part (marge sous les 50 sous-requêtes ; le jeton VAPID est calculé une fois par service push). Un abonnement qui répond 404 ou 410 est supprimé.
  - Web Push sans bibliothèque (chiffrement aes128gcm et jeton VAPID avec Web Crypto), repris du MVP `cis-laille`.
  - Clés VAPID : secrets du centre (`VAPID_PUBLIQUE`, `VAPID_PRIVEE`), jamais dans le dépôt.
- **Pourquoi** : rien de nouveau à installer, tout reste gratuit, et l'auteur n'attend jamais. Délai : moins d'une minute jusqu'à 40 appareils.
- **Conséquences** : au-delà de 40 appareils, une minute de plus par tranche de 40 (« Le centre » avec 150 appareils : environ 4 minutes). Si ce délai gêne, passer aux Queues (option 3). La tâche de chaque minute coûte une requête D1 quand la file est vide (1 440 par jour).
- **Détails** : [la spec](../superpowers/specs/2026-10-31-notifications-design.md), [socle.md](../technique/socle.md).
- **Validé par** : à valider par le porteur (PR #26).

## Révision du 6 novembre 2026 : envoi immédiat, réveil toutes les cinq minutes

- **Contexte** : mesuré par l'API de Cloudflare, la tâche de chaque minute coûtait environ 20 ms de calcul même sans rien à faire (1 440 réveils par jour), au-dessus des 10 ms de l'offre gratuite, et usait la marge en continu.
- **Choix** :
  - **Envoi dès le geste** : après la réponse (`waitUntil`, dans `hooks.server.ts`), si une requête du geste a mis des envois en file (`creerBaseD1` le signale), un lot de **20 envois au plus** part (`envoyerApres`). Aucune requête de plus quand rien n'est en file. Vaut pour tous les gestes, y compris ceux qui écrivent la file dans leur propre requête (réservations, remplacements, anomalies, été).
  - **Pourquoi 20** : mesuré en local dans workerd, un envoi coûte environ 0,5 ms de calcul (chiffrement), plus 1 ms pour le jeton VAPID : 20 envois ≈ 10 ms, 40 ≈ 22 ms. La requête de l'auteur reste légère ; les messages, commentaires et réservations (quelques appareils) partent en entier.
  - **Filet** : ce qui reste en file au-delà du lot immédiat (un envoi refusé n'est jamais renvoyé ; coupé, il est repris depuis le 7 novembre 2026). Réveil toutes les cinq minutes (`*/5 * * * *`), lot de 40 après les autres tâches du réveil (les annonces de 8 h partent donc tout de suite). Remplacements toutes les 10 minutes, météo et vigilance à chaque réveil, annonces à 8 h et 8 h 10 (l'heure prévue du réveil, même s'il part en retard ; une annonce faite n'est jamais refaite), ménage de nuit : inchangés.
- **Conséquences** : 288 réveils par jour au lieu de 1 440. « Le centre » avec 100 appareils : 20 tout de suite, 40 dans les cinq minutes, le reste cinq minutes plus tard (avant : environ 3 minutes en tout). Si ce délai gêne : monter le lot immédiat à 40, ou passer aux Queues (option 3). Risque : si Cloudflare coupe la requête (1102) pendant l'envoi, le lot déjà retiré de la file est perdu (même risque qu'avant dans la tâche planifiée) ; corrigé le 7 novembre 2026 (voir plus bas).
- **Validé par** : le porteur, le 6 novembre 2026 (envoi immédiat et filet de 5 minutes) ; la taille du lot immédiat (20) reste à valider (PR #51).

## Révision du 7 novembre 2026 : aucun envoi perdu si la requête est coupée

- **Contexte** : un lot était retiré de la file avant de partir ; si Cloudflare coupait la requête pendant l'envoi (1102), ces notifications étaient perdues.
- **Options** :
  1. réserver les lignes, ne les retirer qu'une fois parties, reprendre celles d'un lot coupé (une migration additive) ;
  2. retirer chaque ligne juste après son envoi : une requête D1 par envoi, au-delà de l'offre gratuite ;
  3. Cloudflare Queues (reprise intégrée) : une brique de plus par centre, écartée en 2026 (voir plus haut).
- **Choix** : option 1 (migration `0020_envoi_reserve`, trois colonnes ajoutées à `envoi_push`, aucune donnée touchée).
  - Un lot réserve ses lignes sous un jeton (`jeton`, `reservee_le`, `essais + 1`), d'un seul bloc : deux passages en même temps ne prennent jamais les mêmes. Une fois les envois partis, il retire ses lignes, avec les abonnements périmés, en une requête.
  - Une ligne réservée depuis **5 minutes** ou plus (son lot a été coupé) redevient libre : le geste suivant qui notifie ou le réveil suivant la reprend. Délai d'un envoi coupé : 5 à 10 minutes. Un appel au service push qui ne répond pas en 20 s est abandonné : un lot ne reste jamais en vol jusqu'à sa reprise.
  - **3 essais** au plus : une ligne coupée trois fois est abandonnée, avec un avertissement dans le journal du Worker. Une coupure vise la requête entière (les erreurs d'un envoi sont attrapées une à une) : trois coupures de suite font donc abandonner tout le lot repris. Si ces avertissements apparaissent, reprendre en lots plus petits.
  - Inchangé : un envoi refusé par le service push n'est pas renvoyé (404 ou 410 : abonnement supprimé ; autre refus ou erreur : journal) ; seule la coupure de notre côté est reprise. Lots de 20 dès le geste et de 40 au réveil.
- **Pourquoi** : rien de nouveau à installer, gratuit, et la seule perte restante est voulue (refus du service, ou trois coupures). Doublon rare : si la coupure tombe après le départ de certains envois, ils repartent ; le même `tag` remplace la notification encore affichée, sans en ajouter une. Elle ne réapparaît que si la personne l'avait déjà touchée ou écartée.
  - Ordre : un envoi repris ne remplace jamais un envoi plus récent du même fil. Il part sans `Topic`, et il porte son numéro dans la file : le service worker garde la notification affichée si elle est plus récente (`lib/notification-recue.ts`).
- **Conséquences** : une requête D1 de plus par lot non vide (2 au lieu de 1 ; le retrait des abonnements périmés y est compris) : un geste qui notifie passe de 28 à 29 requêtes au plus, sous les 45 du budget ; le réveil reste à 1 requête quand la file est vide, 2 sinon. Calcul : inchangé (le jeton est un `randomUUID`).
- **Validé par** : le porteur, le 7 novembre 2026.

## Révision du 7 novembre 2026 : la pastille sur l'icône, et la notification touchée marquée lue

- **Contexte** : appli fermée, l'icône ne disait rien des non-lues ; et une notification touchée au téléphone ouvrait sa page sans marquer lue sa ligne de la cloche (avis d'été, rappel des vacances, anomalies).
- **Choix** :
  - **Pastille** : la charge porte `pastille`, le chiffre de la cloche de la personne (mêmes sources que l'en-tête des pages). Il est compté pour tout le lot dans la **même requête** que la réservation des envois (`prendreEnvois`) : aucune requête de plus. Le service worker le pose avec `navigator.setAppBadge` (ou l'efface à 0) ; l'appli ouverte fait de même avec la cloche.
  - **Notification touchée** : chaque envoi qui a sa ligne de cloche (publication, commentaire, avis de réservation, de remplacement, d'été, d'anomalie) la retrouve à l'écriture (`mettreEnFile`, la plus récente de la personne, écrite juste avant dans le même batch) ; l'adresse de la charge devient `/notifications/ouvrir?genre=…&id=…&vers=…`, qui la marque lue puis redirige (adresses externes refusées). Sans ligne (message, demande de réservation à trancher, vigilance rouge) : l'adresse directe.
- **Coût** : un lot d'envois reste à 2 requêtes D1 (1 si la file est vide) ; une notification touchée coûte une requête de plus (marquer lue) et une redirection. Calcul : quelques sous-requêtes SQL de plus par lot, côté base.
- **Validé par** : le porteur, le 7 novembre 2026 (le fond) ; la mise en œuvre est à valider (PR #60).
