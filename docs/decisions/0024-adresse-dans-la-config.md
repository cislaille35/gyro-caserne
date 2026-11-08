# 0024 — L'adresse de l'appli dans la config du centre

- **Contexte** : le 7 novembre 2026, la connexion de la préprod était cassée (« Invalid URL ») : `BETTER_AUTH_URL` avait disparu du Worker. Les versions d'essai de la refonte étaient envoyées avec `wrangler versions upload --var BETTER_AUTH_URL:…`, ce qui en faisait une variable en clair de la dernière version ; le `wrangler deploy` suivant n'hérite que des secrets, et la variable est partie.
- **Options** : la garder en secret (rien n'empêche de la perdre à nouveau) ; la mettre en clair dans `centres/<id>/wrangler.jsonc`.
- **Choix** : en clair, `"vars": { "BETTER_AUTH_URL": "https://…" }` dans la config du centre. En local, `.dev.vars` l'emporte toujours : les liens de développement et des tests restent sur `localhost`. Après chaque déploiement, `deployer.yml` vérifie que les réglages indispensables sont sur le Worker et que `/connexion` répond.
- **Pourquoi** : l'adresse n'est pas un secret (elle est publique) ; dans la config, chaque déploiement la pose, versionnée et relue en PR.
- **Leçon** : ne jamais passer en `--var` un réglage qui est un secret sur le Worker.
- **Bascule** : Wrangler 4.152 prévient qu'une variable de la config remplace le secret du même nom, puis déploie (sans question en CI, avec une question en local) : la nouvelle version porte l'adresse en clair, sans moment où l'appli n'en a pas. Le secret n'a pas à être retiré avant.
- **Validé par** : le porteur, le 8 novembre 2026.
