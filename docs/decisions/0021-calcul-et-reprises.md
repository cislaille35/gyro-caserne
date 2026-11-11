# 0021 — Temps de calcul, coupures et groupes d'été

- **Contexte** : sur l'offre gratuite de Cloudflare (10 ms de calcul par requête, tolérance d'environ 2 s de crédit), l'appli peut être coupée (erreur 1102). L'audit du 4 novembre 2026 a montré que les dates en étaient le plus gros poste. L'offre payante est refusée par le porteur.
- **Choix** :
  - **Dates** : un format `Intl` n'est créé qu'une fois (`formatDeDate`) ; `ajouterJours` et `rangDuJour` sans analyse de texte. Aucun changement d'affichage. Banc local, dates d'une page de planning (3 années calculées, 52 semaines écrites) : médiane **40 ms → 5 ms**.
  - **Échange, étape « sienne »** (11/11, coupure 1102 en préprod) : les semaines d'astreinte d'une personne, calculées sur toutes les années publiées, étaient refaites pour chaque tranche de chaque collègue (707 fois par requête). Elles sont gardées dans le contexte de la requête. Banc local, 38 agents, 3 périodes : chargement **28 → 12 ms**, rendu inchangé (< 1 ms). Sous Node, requêtes SQLite comprises : réduit, sans garantir les 10 ms.
  - **Relevé quotidien** : `releve-coupures.yml`, échec du passage si coupures la veille. Le plus simple : pas d'issue, pas de droit d'écriture.
  - **Forme de l'erreur**, mesurée sur un Worker jetable (supprimé ensuite) : statut 503, `content-type: text/plain`, corps `error code: 1102`, pour GET comme pour POST. Le service worker ne lit le corps que d'un 503 : ni un 404, ni un 403, ni une erreur de l'appli ne sont pris pour une coupure.
  - **Page d'attente** : dans le code du service worker, sans cache ni appel au serveur. Nouveaux essais à 5, 10, 20 s, le compte gardé dans l'historique du navigateur, puis un bouton. Rien d'autre n'est mis en cache : pas de hors-ligne.
  - **Navigation dans l'appli** : rien de plus à faire. Quand `__data.json` échoue deux fois, SvelteKit recharge la page entière, qui passe par le service worker ; si la seconde lecture réussit, c'est `+error.svelte`, avec « Réessayer ».
  - **Envois** : jamais de renvoi. Un envoi `enhance` coupé reçoit un refus au format de SvelteKit : la page et la saisie restent, et le service worker envoie le message à la page (`EnvoiCoupe.svelte`), affiché sur tous les écrans. Un formulaire classique (connexion) : page d'attente sans nouvel essai, avec « Revenir au formulaire » (le navigateur restitue la saisie).
  - **Groupes** : « Groupe A, B, C, D » au lieu de « Équipe N » sur les semaines d'été. Les agents les voient à la publication de l'été (planning, carte astreinte, agenda, notifications) ; le chef dès la proposition (tableau de l'été, onglet Été du fichier). Décision du porteur à la relecture de la PR #47. Correspondance : équipes actives dans l'ordre du roulement du centre (`ordre_rotation`), recalculée à l'affichage, rien en base.
- **Limites** :
  - La toute première visite, avant l'installation du service worker, montre encore l'erreur brute de Cloudflare, ainsi que les navigateurs sans service worker. Sans lui, un envoi coupé mène à `+error.svelte` : la saisie est perdue.
  - La page d'attente suit le thème de l'appareil, pas le choix fait dans l'appli : le cookie n'est pas lisible par le navigateur (`HttpOnly`).
  - Le budget de calcul reste celui de l'offre gratuite : ceci réduit les coupures et les rend supportables, sans les interdire.
- **Validé par** : le porteur (PR #47).
