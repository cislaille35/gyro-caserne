# 0011 — Messagerie : rafraîchissement par interrogation, et entrée du worker générée

- **Contexte** : la messagerie doit montrer les nouveaux messages presque en temps réel. L'appli tourne sur l'offre gratuite de Cloudflare : 100 000 requêtes par jour, 50 requêtes D1 par appel, et un seul worker par centre, écrit par l'adaptateur SvelteKit. Les vieux messages doivent aussi être effacés chaque nuit, ce qui demande un gestionnaire planifié (`scheduled`) que l'adaptateur n'écrit pas.
- **Options** :
  1. interrogation régulière : la page demande ce qui a changé depuis son dernier passage ;
  2. SSE (flux d'événements du serveur) : une requête reste ouverte, mais le worker n'a rien pour être prévenu d'un nouveau message, sauf à interroger lui-même la base ;
  3. WebSockets avec Durable Objects : du vrai temps réel, mais une brique de plus par centre, à écrire, tester et surveiller.
- **Choix** : option 1.
  - Toutes les **4 s** dans une conversation ouverte, toutes les **30 s** pour la liste et la pastille d'Échanges.
  - **Page visible seulement** : rien quand l'onglet est masqué, une relance au retour et après un envoi.
  - Chaque appel ne lit que ce qui a changé (2 à 3 requêtes D1). Un repère de plus d'une heure recharge la conversation.
- **Le même choix couvre l'entrée du worker** : l'adaptateur n'écrit qu'un `fetch`, à l'endroit désigné par `main` (wrangler.jsonc), et efface ce fichier à chaque build. Après lui, `entree-du-worker.ts` renomme son worker en `_sveltekit.js` et écrit à sa place une petite entrée, qui reprend `fetch` et ajoute `scheduled` (`planifie.ts`, effacement quotidien par un déclencheur Cron gratuit). Pas de second worker, et pas de fichier d'entrée écrit à la main que le build effacerait.
- **Pourquoi** : aucune brique nouvelle, et tout reste gratuit. Une conversation ouverte et visible fait 900 appels par heure : 40 agents qui lisent chacun une heure par jour restent loin des 100 000 requêtes. Le délai de 4 s convient à des messages entre collègues. Les WebSockets viendront seulement si ce délai gêne.
- **Conséquences** : l'entrée générée dépend d'un détail de l'adaptateur 8.0.1. Une montée de version qui le changerait ferait échouer le build bruyamment, sans casse silencieuse. Le test des centres garantit que `main` désigne bien ce fichier.
- **Détails** : [la spec](../superpowers/specs/2026-10-29-messagerie-design.md), [socle.md](../technique/socle.md), [README technique](../technique/README.md).
- **Validé par** : le porteur, à la PR #23.
