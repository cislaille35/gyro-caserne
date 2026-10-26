# Déploiement — plan de mise en œuvre

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mettre la préprod en ligne (déployée à chaque fusion sur `main`), préparer la production sur tag, et envoyer les liens de connexion par Brevo.

**Architecture:** `envoyerCourriel` appelle l'API HTTP de Brevo avec `fetch` (Resend retiré). Un workflow `deployer.yml` réutilise la vérification existante (`verifier.yml` devient appelable), puis applique les migrations et déploie le centre désigné par une variable du dépôt GitHub. La base de préprod est créée et chargée une fois, à la main, avec les identifiants du porteur.

**Tech Stack:** SvelteKit 3, adaptateur Cloudflare 8, Wrangler 4, D1, GitHub Actions, API Brevo v3 (`POST https://api.brevo.com/v3/smtp/email`).

**Spec:** `docs/superpowers/specs/2026-10-26-deploiement-design.md`

## Global Constraints

- Gratuit de bout en bout ; passer plus tard à un domaine ne doit demander aucun changement de code (seulement un secret).
- Aucun secret ni donnée réelle dans le dépôt.
- Dépôt privé : pas d'environnements GitHub. La production ne part que d'un tag `v*.*.*` qui pointe sur un commit de `main`.
- Actions figées par empreinte de commit, droits en lecture seule (`permissions: contents: read`), comme `verifier.yml`.
- `CENTRE` obligatoire pour tout ce qui est en ligne.
- Machine de 2 Go : commandes lourdes en cage (`systemd-run --user --scope -q -p MemoryMax=1100M -p MemorySwapMax=900M timeout 900 …`, et `NODE_OPTIONS=--max-old-space-size=950` pour `pnpm check` de `apps/web`), commit + push à chaque étape verte, PR ouverte en brouillon dès le premier push.
- Français partout ; commentaires rares.

## Review Focus

1. Brevo refuse l'envoi (clé fausse : 401 ; expéditeur non vérifié : 400) → `envoyerCourriel` lève une erreur avec le message de Brevo, pour que la connexion efface le lien et permette un nouvel essai (Tâche 1).
2. Un tag posé sur un commit hors de `main` → le déploiement de production s'arrête avant toute écriture (Tâche 3).
3. Variable `CENTRE_PREPROD` ou `CENTRE_PRODUCTION` absente (fork d'un autre centre) → le job de déploiement est sauté, pas en échec (Tâche 3).
4. Les agents fictifs ne vont jamais dans une autre base que celle d'`exemple` (Tâche 2).
5. La réponse de Brevo n'est pas du JSON (panne, page HTML) → erreur lisible, pas de plantage sur le décodage (Tâche 1).

---

### Tâche 1 : Envoi par Brevo

**Files:**
- Modify: `apps/web/src/lib/server/courriel.ts`, `apps/web/src/lib/server/courriel.test.ts`, `apps/web/src/lib/server/auth.ts` (type `EnvAuth` seulement si le nom du type change), `apps/web/src/routes/connexion/+page.svelte`, `apps/web/.dev.vars.exemple`, `apps/web/package.json` (retirer `resend`), `pnpm-lock.yaml`
- Docs: `docs/decisions/0007-brevo.md` (nouveau), `docs/decisions/0003-stack.md` (une ligne : e-mails via Brevo, voir 0007), `docs/technique/README.md` (tableau des technos : retirer Resend ; ligne « Brevo, API HTTP, sans bibliothèque »), `docs/technique/installer-un-centre.md` (secrets), `docs/technique/passation.md` (clé Brevo), `docs/fonctionnel/acces-et-attributions.md` (Resend → Brevo)

**Interfaces:**
- Produces: `type EnvCourriel = { BREVO_CLE?: string; COURRIEL_EXPEDITEUR?: string }` ; `envoyerCourriel(env: EnvCourriel, m: { a: string; sujet: string; texte: string }): Promise<void>` (signature inchangée hors noms de secrets).

- [ ] **Step 1 : tests qui échouent** (`courriel.test.ts`, `fetch` remplacé par `vi.stubGlobal('fetch', …)`, plus de mock de `resend`) :
  - `écrit le lien dans la console sans clé Brevo` : `envoyerCourriel({}, message)` → `console.log` reçoit le lien, `fetch` non appelé.
  - `envoie par Brevo avec la clé` : `fetch` appelé une fois avec `'https://api.brevo.com/v3/smtp/email'`, méthode `POST`, en-têtes `{ 'api-key': 'cle', 'content-type': 'application/json', accept: 'application/json' }`, corps JSON `{ sender: { name: 'Gyro Caserne', email: 'cislaille35@exemple.fr' }, to: [{ email: 'test@exemple.fr' }], subject: 'Connexion', textContent: message.texte }` ; réponse `201` → aucune erreur, rien dans la console.
  - `signale un envoi refusé par Brevo` : réponse `400` avec `{ code: 'invalid_parameter', message: 'sender not valid' }` → rejette avec une erreur contenant `sender not valid`.
  - `signale une réponse illisible` : réponse `502` avec un corps HTML → rejette avec une erreur contenant `502`.
  - `exige un expéditeur avec la clé` : `{ BREVO_CLE: 'cle' }` → rejette, `fetch` non appelé.
- [ ] **Step 2** : lancer `pnpm exec vitest run src/lib/server/courriel.test.ts` (dans `apps/web`, en cage) → échecs attendus.
- [ ] **Step 3** : implémenter `envoyerCourriel` avec `fetch` (nom affiché « Gyro Caserne » fixé dans le code). Retirer `resend` (`pnpm remove resend --filter @gyro-caserne/web`). `.dev.vars.exemple` : `# BREVO_CLE=` et `# COURRIEL_EXPEDITEUR=cislaille35@gmail.com` (adresse vérifiée dans Brevo, sans nom).
- [ ] **Step 4** : écran de connexion. Après envoi, le message devient : « Si cette adresse est autorisée, un lien vient de partir. Pensez à regarder dans vos courriers indésirables. »
- [ ] **Step 5** : tests du fichier verts, puis `pnpm test` et `pnpm check` de `apps/web` en cage → verts.
- [ ] **Step 6** : docs listées ci-dessus. `0007-brevo.md` au format des autres décisions : contexte (gratuité, pas de domaine, Resend exige un domaine), options (domaine à 10 €/an, Brevo + Gmail, Gmail direct), choix (Brevo + Gmail, nom « Gyro Caserne »), pourquoi (gratuit, une dépendance en moins), contrepartie (Brevo remplace l'adresse d'envoi, risque de spam, message à l'écran), passage futur (authentifier un domaine dans Brevo, changer `COURRIEL_EXPEDITEUR`), validé par le porteur le 2026-10-26.
- [ ] **Step 7** : commit `Courriels envoyés par Brevo au lieu de Resend`, push.

### Tâche 2 : Agents fictifs pour la préprod

**Files:**
- Modify: `apps/web/scripts/jeu-de-depart.ts`, `apps/web/src/commandes.test.ts`, `README.md` (ligne de la commande)

**Interfaces:**
- Produces: option `--avec-fictifs` de `jeu-de-depart`. Sans `--en-ligne`, la base locale reçoit déjà `test@exemple.fr` ; avec `--en-ligne --avec-fictifs`, la base en ligne reçoit les mêmes personnes fictives que la base locale.

- [ ] **Step 1 : test qui échoue** (`commandes.test.ts`, même environnement minimal que les tests existants : `PATH`, `HOME: tmpdir()`, `timeout`) : `jeu-de-depart --en-ligne --avec-fictifs refuse un autre centre qu'exemple` avec `CENTRE: 'laille'` → code de sortie 1, `stderr` contient `fictifs réservés au centre exemple`. Le refus doit arriver avant toute écriture de fichier et tout appel à Cloudflare.
- [ ] **Step 2** : lancer le test → échec.
- [ ] **Step 3** : implémenter. Personnes fictives (toutes `@exemple.fr`, profil « Agent ») : `test@exemple.fr` (Test Fictif) et quatre agents répartis dans les équipes d'`exemple` (prénoms et noms visiblement fictifs). Une seule liste, utilisée en local et en ligne avec `--avec-fictifs`. Insertion idempotente (`onConflictDoNothing`), comme aujourd'hui.
- [ ] **Step 4** : test vert ; `pnpm base-locale` puis `pnpm jeu-de-depart` sur une base locale neuve (supprimer `centres/exemple/.wrangler` d'abord) → message de succès.
- [ ] **Step 5** : README : `CENTRE=exemple pnpm --filter @gyro-caserne/web jeu-de-depart --en-ligne --avec-fictifs` (préprod uniquement). Commit `Agents fictifs pour la préprod`, push.

### Tâche 3 : Workflow de déploiement

**Files:**
- Modify: `.github/workflows/verifier.yml` (ajouter `workflow_call` ; retirer `push: branches: [main]`, que `deployer.yml` couvre)
- Create: `.github/workflows/deployer.yml`
- Docs: `docs/technique/README.md` (section CI), `docs/technique/installer-un-centre.md` (déploiement automatique, variables et secrets GitHub, `centres/exemple` modèle et préprod : remplacer `database_id` en le copiant)

**Interfaces:**
- Consumes: `pnpm --filter @gyro-caserne/web base-en-ligne` et `pnpm deployer`, avec `CENTRE` (existants).
- Produces : variables du dépôt `CENTRE_PREPROD` (Laillé : `exemple`) et `CENTRE_PRODUCTION` (Laillé : `laille`) ; secrets du dépôt `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.

- [ ] **Step 1** : `deployer.yml` :
  - déclencheurs : `push` sur `main` et sur les tags `v*.*.*` ;
  - job `verifier` : `uses: ./.github/workflows/verifier.yml` ;
  - job `preprod` (`needs: verifier`) : seulement sur `refs/heads/main` et si `vars.CENTRE_PREPROD != ''` ;
  - job `production` (`needs: verifier`) : seulement sur `refs/tags/v*` et si `vars.CENTRE_PRODUCTION != ''` ; checkout avec `fetch-depth: 0`, puis première étape : `git fetch origin main` puis `git merge-base --is-ancestor "$GITHUB_SHA" origin/main`, sinon échec avec le message « Le tag doit pointer sur un commit de main » ;
  - chaque job de déploiement : checkout, pnpm, node (mêmes actions et empreintes que `verifier.yml`), `pnpm install --frozen-lockfile`, puis `base-en-ligne` puis `deployer`, avec `CENTRE`, `CLOUDFLARE_API_TOKEN` et `CLOUDFLARE_ACCOUNT_ID` en variables d'environnement ;
  - `concurrency` par environnement, **sans** annuler un déploiement en cours ; `permissions: contents: read`.
- Si `base-en-ligne` échoue, `deployer` ne tourne pas (étapes successives) : on s'arrête et on demande au porteur avant de rejouer une migration.
- [ ] **Step 2** : vérifier la syntaxe avec `actionlint` (binaire unique téléchargé dans le dossier scratchpad, hors dépôt) → aucune erreur. Si indisponible, le dire dans le rapport.
- [ ] **Step 3** : docs. Commit `Déploiement automatique : préprod sur main, production sur tag`, push. La CI de la PR doit rester verte (le job `verifier` appelé par la PR via `verifier.yml`).

### Tâche 4 : Mise en ligne de la préprod (avec le porteur)

Faite par le contrôleur, pas par un sous-agent : elle demande les identifiants du porteur. Chaque étape est notée dans le journal.

- [ ] **Step 1** : recevoir du porteur le jeton Cloudflare (Workers Scripts : modifier ; D1 : modifier ; Account Settings : lire), l'identifiant du compte, la clé d'API Brevo (avec `cislaille35@gmail.com` vérifiée comme expéditeur) et l'adresse du super administrateur. Ne jamais les écrire dans le dépôt ni dans un journal.
- [ ] **Step 2** : `wrangler d1 create gyro-caserne-exemple` ; reporter le `database_id` dans `centres/exemple/wrangler.jsonc` ; commit `Préprod : identifiant de la base`, push.
- [ ] **Step 3** : `CENTRE=exemple pnpm --filter @gyro-caserne/web base-en-ligne`, puis `jeu-de-depart --en-ligne --avec-fictifs` → « Base en ligne de « exemple » prête ». Premier essai réel de ces deux commandes : tout écart est corrigé dans une tâche à part, avec test.
- [ ] **Step 4** : `CENTRE=exemple pnpm deployer` (premier déploiement, pour créer l'appli), puis `wrangler secret put` : `BETTER_AUTH_SECRET` (`openssl rand -base64 32`), `BETTER_AUTH_URL` (adresse affichée), `SUPER_ADMINS`, `BREVO_CLE`, `COURRIEL_EXPEDITEUR`.
- [ ] **Step 5** : GitHub (`gh secret set`, `gh variable set`) : `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `CENTRE_PREPROD=exemple`. `CENTRE_PRODUCTION` n'est pas posée avant la mise en production.
- [ ] **Step 6** : vérification de bout en bout avec le porteur : il demande un lien sur la préprod depuis son téléphone, le reçoit (au besoin dans les indésirables), se connecte. Une adresse inconnue : même message, aucun courriel.
- [ ] **Step 7** : après la fusion de la PR, la CI déploie la préprod toute seule : vérifier que le job `preprod` passe.
