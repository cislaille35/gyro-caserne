# 0012 — Notifications : Web Push maison et file d'envoi vidée chaque minute

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
