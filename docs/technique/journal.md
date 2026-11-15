# Journal de Cloudflare (Workers Logs)

Décision : [0036](../decisions/0036-journal-cloudflare.md).

## Où il est activé

| Centre | Réglage (`centres/<id>/wrangler.jsonc`) | Contenu |
|---|---|---|
| `exemple` (préprod, données fictives) | `"observability": { "enabled": true, "head_sampling_rate": 1, "logs": { "invocation_logs": true } }` | chaque requête et nos messages d'erreur |
| `laille` (production) | `"observability": { "enabled": false }` | rien, en attendant la décision du porteur |

Chaque centre écrit le réglage en toutes lettres (`centres.test.ts`) : sans lui, Cloudflare active le journal d'office sur un nouveau Worker. Le réglage s'applique au déploiement ; le tableau de bord (Workers & Pages › le Worker › Settings › Observability) le change tout de suite, jusqu'au déploiement suivant.

## Ce qui y part

- **De Cloudflare, pour chaque requête** (si `invocation_logs`) : méthode, adresse de la page **avec ses paramètres**, réponse, temps de calcul, en-têtes (Cloudflare dit masquer `Authorization`, `Cookie` et les noms sensibles). Donc aussi le jeton d'un lien de connexion (`/api/auth/magic-link/verify?token=…`, usage unique, 5 minutes) et la clé d'un lien d'agenda (`/agenda/<clé>.ics`, valable jusqu'à ce que l'agent la change) : sans risque en préprod (comptes de test), à peser pour la production.
- **De l'appli** : ses messages d'erreur seulement, toujours passés par `resumeErreur` (`packages/socle/src/erreur-anonyme.ts`) : nom, message sans adresse e-mail, sans paramètres d'adresse web, sans jeton (suite de 20 lettres ou chiffres et plus), sans les valeurs d'une requête refusée (`params:` de Drizzle), puis la cause et la pile. `handleError` (`hooks.server.ts`) y ajoute le modèle de la page (`/agents/[id]`). Le journal de Better Auth est nettoyé de même (`auth.ts`). `journal-sans-donnees.test.ts` refuse une erreur passée brute à `console.*`.
- **Jamais** : le courriel de connexion. Sans `BREVO_CLE`, il n'est écrit à la console qu'en local (`BETTER_AUTH_URL` sur `localhost`, tests compris) ; en ligne, l'envoi échoue (`courriel.ts`).

## Combien de temps, où

- Offre gratuite : 200 000 événements par jour, gardés 3 jours ; à partir du 1er décembre 2026, 0,5 Go par jour, gardés 7 jours. Au-delà de la limite du jour, plus rien n'est enregistré jusqu'à minuit UTC, sans frais.
- Chez Cloudflare, **peut-être hors de l'Union européenne** : la frontière de données (Customer Metadata Boundary) est réservée à l'offre Enterprise et ne vaut pas pour `workers.dev`.

## Le lire

- **Tableau de bord** : Workers & Pages › `gyro-caserne-exemple` › Observability. Exemples : filtrer `$workers.event.response.status` ≥ 500, regrouper par `$workers.event.request.path` ; ou chercher le texte « Erreur imprévue ».
- **En direct** (rien n'est gardé de plus) : `pnpm --filter @gyro-caserne/web exec wrangler tail gyro-caserne-exemple`.
- **Relevé quotidien** (`releve-coupures.yml`, étape « Pages en cause ») : coupures (`$workers.outcome` commençant par `exceeded`) et erreurs (500 et plus) de la veille par page, par l'API [Telemetry query](https://developers.cloudflare.com/api/resources/workers/subresources/observability/subresources/telemetry/methods/query/). Le résumé est public : `scripts/pages-en-erreur.ts` regroupe les chemins (un morceau avec un chiffre, un point, un caractère encodé ou de 20 caractères et plus devient `:id`) et n'écrit que des nombres. Droit à ajouter au jeton `CLOUDFLARE_API_TOKEN` : **Account › Workers Observability : Edit** (Cloudflare n'accepte que celui-là, même pour lire). Sans lui, ou si Cloudflare ne répond pas, le résumé le dit et le relevé continue. Pour un Worker au journal coupé, il dit « aucune coupure ni erreur au journal (ou journal coupé) ».
- **Premier passage avec le droit** : vérifier dans le résumé que les noms de champs (`$workers.outcome`, `$workers.event.request.path`, `$workers.event.response.status`, `$metadata.service`) donnent bien des chiffres ; sinon les confirmer par l'API des clés (`…/telemetry/keys`).
