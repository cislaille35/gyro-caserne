# 0031 — Chemin de sortie : changer d'hébergeur

- **Contexte** : l'appli tourne chez Cloudflare (offre gratuite, décision [0003](0003-stack.md)). Pour un usage officiel par le SDIS ou d'autres centres, un hébergeur français ou imposé peut être demandé. Il faut savoir, avant les vraies données de Laillé, ce qu'un départ coûterait.
- **Options** : (1) rester chez Cloudflare sans plan ; (2) tout rendre portable dès maintenant (couches d'abstraction, double déploiement) ; (3) **noter le chemin**, garder le code tel quel, et ne le suivre que le jour où c'est décidé.
- **Choix** : (3). Le chemin, en quelques jours de travail :
  1. **Données** : la base principale est du SQLite. `wrangler d1 export BASE --remote` en donne un fichier SQL, remis en ordre par `apps/web/scripts/copie-restaurable.ts` (vérifié à la répétition générale du 12/11/2026 : mêmes comptes sur les 71 tables). Il se recharge dans tout SQLite (`sqlite3 base.db < copie.sql`) ou un service compatible.
  2. **Photos** : leur base (`PHOTOS`, décision [0010](0010-photos-dans-leur-base.md)) s'exporte de la même façon, octets compris ; trop lourde pour l'e-mail, elle se télécharge à la main le jour du départ.
  3. **À refaire, propre à Cloudflare** : l'accès à la base (`creerBaseD1` dans `packages/socle/src/base.ts`, pilote Drizzle `d1` → pilote SQLite) ; l'adaptateur de SvelteKit (`adapter-cloudflare` → `adapter-node`) ; les tâches planifiées (`triggers.crons` et `planifie.ts` → un minuteur du serveur) ; le travail après réponse (`waitUntil`) ; les secrets (`wrangler secret` → variables d'environnement) ; le déploiement (`deployer.yml`) ; le retour en arrière (Time Travel → sauvegardes de l'hébergeur).
  4. **Ce qui ne bouge pas** : le socle métier, les écrans, l'authentification (Better Auth), l'envoi par Brevo, les clés des notifications (VAPID).
  5. **Adresse** : quitter `….workers.dev` pour un nom de domaine à soi (environ 10 € par an). Les agents se reconnectent et réactivent leurs notifications une fois (elles sont liées à l'adresse).
- **Hébergeurs possibles** (France) : OVHcloud, Scaleway, Clever Cloud. Un petit serveur avec SQLite suffit à un centre.
- **Pourquoi** : rien à payer ni à maintenir tant que Cloudflare convient ; le socle ne dépend déjà pas de Cloudflare ; les données sortent en un fichier standard, testé.
- **Contreparties** : le jour du départ, quelques jours de code et un essai complet sur un centre jetable, comme la répétition générale ; une coupure courte le temps de copier la base.
- **Validé par** : à valider par le porteur (PR « Doc d'installation corrigée »).
