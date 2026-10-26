# Passation du super administrateur

Quand le super administrateur quitte le centre, son successeur reprend les accès. Les anciens secrets ne doivent plus rien ouvrir.

1. Changer le mot de passe de la boîte du centre, puis le remettre au successeur.
2. Remplacer le secret des sessions : `openssl rand -base64 32`, puis `pnpm exec wrangler secret put BETTER_AUTH_SECRET --config ../../centres/<id>/wrangler.jsonc` depuis `apps/web`.
3. Remplacer la clé Resend : en créer une nouvelle sur Resend, supprimer l'ancienne, puis `wrangler secret put RESEND_CLE` (même commande).
4. Mettre à jour la liste des super administrateurs : `wrangler secret put SUPER_ADMINS`, avec les adresses séparées par des virgules.
5. Créer un nouveau jeton Cloudflare pour le successeur, puis supprimer l'ancien.
6. Fermer toutes les sessions : `pnpm exec wrangler d1 execute BASE --remote --command "DELETE FROM session" --config ../../centres/<id>/wrangler.jsonc`. Chacun se reconnecte par un lien.
7. Vérifier : l'ancien super administrateur ne peut plus se connecter, le successeur reçoit bien son lien.
