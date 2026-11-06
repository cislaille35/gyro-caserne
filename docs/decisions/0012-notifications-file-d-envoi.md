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
  - **Filet** : réveil toutes les cinq minutes (`*/5 * * * *`), lot de 40 après les autres tâches du réveil (les annonces de 8 h partent donc tout de suite). Remplacements toutes les 10 minutes, météo et vigilance à chaque réveil, annonces à 8 h et 8 h 10 (l'heure prévue du réveil, même s'il part en retard ; une annonce faite n'est jamais refaite), ménage de nuit : inchangés.
- **Conséquences** : 288 réveils par jour au lieu de 1 440. « Le centre » avec 100 appareils : 20 tout de suite, 40 dans les cinq minutes, le reste cinq minutes plus tard (avant : environ 3 minutes en tout). Si ce délai gêne : monter le lot immédiat à 40, ou passer aux Queues (option 3).
- **Validé par** : le porteur, le 6 novembre 2026 (envoi immédiat et filet de 5 minutes) ; la taille du lot immédiat (20) reste à valider (PR #51).
