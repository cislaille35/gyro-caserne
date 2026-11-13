# 0035 — La session lue sans Better Auth

- **Contexte** : l'offre gratuite de Cloudflare permet 10 ms de calcul par requête. Une page en coûtait 13 à 18 en médiane, et une vingtaine de minutes d'usage soutenu vidait le crédit : coupure 1102 (diagnostic du 13/11). À chaque requête, le hook créait Better Auth avec ses deux plugins (environ 1 ms) puis appelait `getSession` (environ 2,5 ms), alors que Better Auth ne sert qu'à se connecter et se déconnecter.
- **Options** :
  1. garder `getSession` : rien à maintenir, mais 3 à 4 ms sur chaque requête ;
  2. le cache de session en cookie de Better Auth (`cookieCache`) : essayé au banc, **plus lent** (signature du cache à vérifier et à réécrire) ;
  3. **lire la session nous-mêmes**, au format de Better Auth, et ne créer Better Auth que là où il sert.
- **Choix** : (3). Même cookie signé, même requête (une seule : session et utilisateur), même prolongation une fois par jour, mêmes cookies effacés pour une session inconnue ou expirée. Rien ne change pour l'agent : ses sessions restent valables, la connexion et la déconnexion passent toujours par Better Auth. Détail : [technique](../technique/README.md).
- **Gain mesuré** (banc local, médianes) : le hook passe de 8 à 9 ms à environ 2 ms ; sans cookie, de 2,5 ms à 0,1 ms.
- **Risques** :
  - suivre le format de Better Auth à chaque mise à jour de la bibliothèque (nom et signature du cookie, règle de prolongation). Garanti par le test de compatibilité de `session.test.ts`, qui compare notre lecture à `auth.api.getSession` et lit des cookies posés par Better Auth : une mise à jour qui change le format le fait échouer ;
  - une vérification de sécurité refaite à la main : la signature est vérifiée par `crypto.subtle.verify` (temps constant), avant toute lecture de la base, et chaque refus a son test.
- **Différences assumées**, toutes sans effet pour l'agent :
  - session disparue pendant sa prolongation (déconnexion au même instant sur un autre appareil) : Better Auth renvoyait une erreur 401 ; nous effaçons le cookie et l'agent n'est simplement plus connecté ;
  - Better Auth efface aussi, à chaque requête, un cookie de cache de session (`session_data` et ses morceaux) s'il en trouve un : l'appli n'en pose jamais, nous ne le cherchons pas ;
  - un cookie de session entre guillemets serait accepté par Better Auth et refusé par nous : plus strict, aucun navigateur ne l'envoie ainsi ;
  - un `BETTER_AUTH_SECRET` vide arrête la requête en erreur au lieu de ne reconnaître personne sans bruit.
- **Validé par** : le porteur (le diagnostic et la lecture maison). Choix de Claude, à valider : les différences ci-dessus.
