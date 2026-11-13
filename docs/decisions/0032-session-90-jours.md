# 0032 — Rester connecté 90 jours, prolongés à l'usage

- **Contexte** : sans réglage, Better Auth garde une session 7 jours. Il la prolonge en base une fois par jour d'usage, mais l'appli ne renvoyait pas le cookie prolongé au navigateur : l'agent était déconnecté 7 jours après sa connexion, même en ouvrant l'appli tous les jours. Pour une appli de caserne ouverte au téléphone, redemander un lien chaque semaine décourage.
- **Options** : (1) 7 jours, cookie enfin prolongé ; (2) **90 jours glissants** ; (3) une session sans fin.
- **Choix** : (2). Sans ouvrir l'appli pendant 90 jours, l'agent se reconnecte par un lien. Chaque jour d'usage repousse l'échéance de 90 jours : la session en base et le cookie du navigateur (`lib/server/session.ts`, appelé par `hooks.server.ts`).
- **Pourquoi** : un agent qui ouvre l'appli ne se reconnecte plus ; un téléphone perdu ou oublié finit par se fermer seul.
- **Ce qui protège quand même** : l'accès est vérifié à chaque requête (`acteurDe`) ; une suspension, un départ ou un changement d'adresse ferment toutes les sessions de l'agent ; « Me déconnecter de tous mes appareils » (Moi) ferme les siennes d'un geste.
- **Validé par** : le porteur (décision de la demande du lot).
