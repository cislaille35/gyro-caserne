# Notifications : plan d'exécution

> **Pour les sous-agents :** sous-skill requis, superpowers:executing-plans (ou subagent-driven-development). Les étapes sont des cases à cocher (`- [ ]`).

**But :** qu'un agent sache, sans ouvrir l'appli, qu'une publication, un commentaire sous la sienne ou un message le concerne ; et que la cloche devienne un vrai fil de notifications, avec son chiffre de non-lues.

**Architecture :**
- **Socle** (`packages/socle/src/notifications.ts`) : trois tables nouvelles (fil, abonnements, coupures) et une file d'envoi. Après une publication, un commentaire ou un message, `notifier…` calcule les destinataires (droits du moment), écrit le fil et met en file un envoi par appareil non coupé : deux appels D1, hors de la réponse de l'auteur (`waitUntil`).
- **Envoi** (`apps/web/src/lib/server/webpush.ts`, `envoi-push.ts`) : Web Push sans bibliothèque (repris du MVP `cis-laille`). Une tâche planifiée chaque minute vide la file par lots de 40 au plus (sous la limite de 50 sous-requêtes), supprime les abonnements périmés (404/410).
- **Appli** : appli installable (manifeste, icônes, service worker qui ne fait que recevoir et ouvrir), Moi → Notifications, cloche en fil, cloches barrées dans l'en-tête des murs et conversations, en-tête au visage.

**Technos :** SvelteKit 3, Svelte 5, Drizzle sur D1, Web Crypto, Vitest, Playwright et axe.

**Spec :** [`docs/superpowers/specs/2026-10-31-notifications-design.md`](../specs/2026-10-31-notifications-design.md).

## Contraintes globales

- `CLAUDE.md` : français, TDD, code simple, commentaires rares, rien de propre à un centre, **aucune dépendance ajoutée**.
- Migrations **additives**, générées par `drizzle-kit` (`pnpm --filter @gyro-caserne/socle migrations`), base `BASE`.
- D1 : 100 paramètres liés au plus par requête (listes de destinataires passées en **un** paramètre JSON, lues par `json_each`) ; pas de colonnes de même nom issues de tables jointes dans un `batch`.
- Budget : 45 requêtes D1 par page (`routes/budget.test.ts`) ; le compteur de la cloche est **une seule lecture** ; `notifier…` en ajoute 2 au plus ; un lot d'envoi fait 2 appels D1 + 40 `fetch` au plus.
- La publication, le commentaire ou le message de l'auteur ne doit **jamais** attendre ni échouer à cause des notifications (tout `notifier…` est en arrière-plan, erreurs écrites dans la console).
- Jamais à l'auteur lui-même. Destinataires calculés **au moment de l'envoi**. Couper ne retire que le téléphone : le fil montre tout.
- Clés VAPID : secrets `VAPID_PUBLIQUE` et `VAPID_PRIVEE`, jamais dans le dépôt ni dans un journal. Sans elles, rien ne part au téléphone (le fil marche).
- Téléphone d'abord, soigné à 1280, clair et sombre, AA, clavier, jamais la couleur seule.

## Décisions de construction (à présenter au porteur)

- **File en base vidée chaque minute** (cron `* * * * *`), pas d'envoi direct dans la requête de l'auteur : le budget D1 de la requête est déjà près de 45. Délai : moins d'une minute jusqu'à 40 appareils, une minute de plus par tranche de 40 au-delà (« Le centre » à 150 appareils : ≈ 4 min). À valider.
- **Lots de 40** : marge sous 50 sous-requêtes, et limite de 10 ms de calcul de l'offre gratuite (le jeton VAPID est calculé une fois par service push dans un lot).
- **Clés VAPID** : la clé publique (point brut, base64url) et la clé privée (`d`, base64url) ; le contact du jeton est `mailto:COURRIEL_EXPEDITEUR`, sinon `BETTER_AUTH_URL`.
- **Toucher une notification** mène à la publication (ou à la conversation) ; c'est l'ouverture de la publication qui la marque lue, avec ses commentaires. Pas d'adresse spéciale « ouvrir ».
- **Le fil** garde 50 lignes au plus (les plus récentes) ; ménage à 30 jours par la tâche de nuit.

## Revue : à surveiller

1. Un agent qui change d'équipe garde dans son fil les anciennes notifications de son ancien mur ; les toucher mène à un refus (403) : acceptable, à tester que la page de refus reste propre.
2. Publication sur « Le centre » avec 150 agents : la création du fil et de la file tient en 2 appels D1 et sous 100 paramètres (test avec 150 agents).
3. Même appareil réabonné par un autre agent (téléphone prêté, changement de compte) : l'abonnement passe au nouvel agent (`ON CONFLICT(endpoint)`), jamais en double.
4. Le service push répond 404/410 : abonnement supprimé ; une autre erreur ou une exception n'arrête pas le lot.
5. Publication supprimée avant l'envoi ou avant l'ouverture du fil : ses notifications disparaissent (cascade), la file part quand même (texte déjà copié) ; acceptable.

---

### Tâche 1 : socle des notifications

**Fichiers :**
- Créer : `packages/socle/src/notifications.ts`, `packages/socle/test/notifications.test.ts`
- Modifier : `packages/socle/src/schema.ts` (4 tables), `packages/socle/migrations/0010_*.sql` (générée), `src/index.ts`, `src/actions/publications.ts` (`lireMur`, `lirePublication` marquent lu), `src/actions/personnes.ts` (`changerStatut` : départ), `apps/web/src/planifie.ts` (ménage de nuit)

**Tables :**
- `notification` : `id`, `personne_id` → personne, `publication_id` → publication (cascade), `commentaire_id` → commentaire (cascade, nul pour une publication), `cree_le`, `lue_le` (nul : non lue). Index (`personne_id`, `lue_le`) et (`personne_id`, `id`).
- `abonnement_push` : `id`, `personne_id` → personne, `endpoint` unique, `p256dh`, `auth`, `appareil`, `cree_le`.
- `coupure` : `personne_id` → personne, `lieu` (`tout`, `mur:<clé>`, `conversation:<id>`), clé primaire (personne, lieu).
- `envoi_push` : `id`, `abonnement_id` → abonnement_push (cascade), `donnees` (JSON `{ titre, texte, url, tag }`), `cree_le`.

**Interfaces (produites) :**
- `notifierPublication(base, id: number, maintenant: string): Promise<void>` — lecteurs du mur ce jour-là (`lecturesAgents`, `agentsDuJour`, lecteur = `a.tous || estMembre(a, mur)`), sauf l'auteur. Titre « <nom du mur> · <Prénom Nom> », texte = 100 premiers caractères, url `/echanges/<mur>/<id>`, tag `publication:<id>`.
- `notifierCommentaire(base, id: number, maintenant): Promise<void>` — l'auteur de la publication s'il est une personne, lit encore le mur et n'est pas le commentateur. Titre « <Prénom Nom> a commenté votre publication », tag `commentaires:<idPublication>`, coupure : celle du mur.
- `notifierMessage(base, id: number, maintenant): Promise<void>` — autres membres ayant la messagerie (`aLaMessagerie`) ; pas de ligne de fil. Titre « Message de <Prénom> » à deux, « <nom du groupe> · <Prénom> » en groupe ; url `/echanges/messages/<conv>`, tag `conversation:<conv>`.
- Tous trois : 1 lecture (batch) + 1 écriture (batch : fil + file), file filtrée par `coupure` (`tout` ou le lieu).
- `filDeNotifications(base, acteur, maintenant): Promise<{ lignes: LigneFil[]; nonLues: number }>` — 50 lignes, plus récente d'abord. `LigneFil = { id, type: 'publication' | 'commentaire', cle: CleMur, nomMur, publicationId, auteur: { prenom, nom, couleur }, extrait, creeLe, lue: boolean }`. Une requête (batch).
- `enTeteDe(base, acteur, aujourdhui): Promise<{ nonLues: number; visage: { prenom, nom, couleur } | null }>` — **une** lecture (batch) ; super administrateur : `{ nonLues: 0, visage: null }` sans requête.
- `toutMarquerLu(base, acteur, maintenant): Promise<void>`.
- `couper(base, acteur, lieu: string, oui: boolean, maintenant): Promise<void>` — lieu valide : `tout`, `mur:<clé lisible>` (vérifié par `exigerMur … 'lire'`), `conversation:<id>` (membre). `coupures(base, acteur): Promise<{ tout: boolean; lieux: { lieu, nom }[] }>`, `estCoupe(base, acteur, lieu): Promise<boolean>`.
- `abonner(base, acteur, { endpoint, p256dh, auth, appareil }, maintenant)` (endpoint `https://`, ≤ 1000 car. ; clés base64url) ; `desabonner(base, acteur, endpoint)` ; `nombreAppareils(base, acteur)`.
- `prendreEnvois(base, max: number): Promise<{ id, abonnementId, endpoint, p256dh, auth, donnees }[]>` — un batch : lecture puis suppression des mêmes lignes (pris une seule fois même si deux lots se croisent). `oublierAbonnements(base, ids: number[])`.
- `effacerVieillesNotifications(base, avant: string)` — notifications avant `avant`, et envois en file de plus d'un jour.
- Départ (`changerStatut` → `parti`) : abonnements, notifications et coupures de la personne supprimés dans le même batch.
- `lireMur` (avec visite) marque lues les notifications de publication de ce mur ; `lirePublication` marque lues celles de la publication et de ses commentaires — dans le batch existant (aucune requête de plus).

- [ ] **Étape 1 : tests d'abord** (`notifications.test.ts`), avec le jeu de `preparer` du socle (chef de centre, Alice équipe 1, Bruno équipe 2) :
  - publication sur `equipe:<e2>` : fil de Bruno et du chef, pas d'Alice ni de l'auteur ; sur `centre` : tous sauf l'auteur ;
  - 150 agents sur `centre` : 2 appels D1, `parametresMax` ≤ 100 ;
  - commentaire : seul l'auteur de la publication, jamais s'il commente lui-même ; publication du super administrateur : personne ;
  - message : l'autre membre en file, pas de fil ; membre parti exclu ;
  - coupures : `tout` et `mur:…` retirent de la file, pas du fil ; `conversation:<id>` coupe ce groupe seulement ; commentaire sous sa publication d'un mur coupé : pas de file ;
  - `enTeteDe` : non-lues et visage en 1 requête ; `lireMur` marque lues les publications (pas les commentaires), `lirePublication` les deux ; `toutMarquerLu` ;
  - `abonner` deux fois le même endpoint (deux agents) : une ligne, au dernier ; endpoint `http://` refusé ;
  - `prendreEnvois(base, 2)` sur 3 : 2 rendus et retirés, le 3ᵉ reste ;
  - départ : abonnements, fil, coupures effacés ; ménage : avant 30 jours effacé, après gardé.
- [ ] **Étape 2 :** `pnpm --filter @gyro-caserne/socle test` → les nouveaux tests échouent.
- [ ] **Étape 3 :** schéma, migration générée, `notifications.ts`, marquage lu, départ, ménage (`planifie.ts` appelle aussi `effacerVieillesNotifications` avec la date d'il y a 30 jours).
- [ ] **Étape 4 :** `pnpm test` (socle et appli) au vert.
- [ ] **Étape 5 :** commit « Notifications, socle : fil, coupures, abonnements, file d'envoi » et push.

### Tâche 2 : envoi Web Push, file et tâche planifiée, déclenchement après publication, commentaire et message

**Fichiers :**
- Créer : `apps/web/src/lib/server/webpush.ts` (+ test), `apps/web/src/lib/server/envoi-push.ts` (+ test), `apps/web/src/lib/server/notifier.ts`
- Modifier : `apps/web/src/planifie.ts` (+ test), `src/app.d.ts`, `src/hooks.server.ts` (`locals.enArrierePlan = waitUntil`), `src/routes/echanges/publier/+page.server.ts`, `src/lib/server/gestes-mur.ts`, `src/lib/server/formulaire-messagerie.ts`, `centres/*/wrangler.jsonc` (cron `* * * * *` en plus), `src/centres.test.ts`, `.dev.vars.exemple`

**Interfaces :**
- `webpush.ts` : `chiffrer(message, p256dh, auth)`, `jetonVapid(audience, cles, contact)`, `requetePush(abonnement, donnees, cles, jetons?: Map<string,string>)` → `{ url, init }`, `clesVapid(env): ClesVapid | null` (`{ publique, privee: JsonWebKey, contact }`, JWK rebâtie depuis la clé publique brute).
- `envoi-push.ts` : `envoyerLot(base, cles, envoyer = fetch, max = 40): Promise<{ envoyes: number; perimes: number }>`.
- `notifier.ts` : `enArrierePlan(locals, travail: () => Promise<unknown>)` — appelle `locals.enArrierePlan` (sinon ne fait rien d'autre que lancer), erreurs écrites sans le texte.
- `planifie.ts` : `scheduled` choisit selon `controleur.cron` : `30 3 * * *` → ménage (messages et notifications) ; sinon → `envoyerLot`.

- [ ] **Étape 1 : tests d'abord**
  - `webpush.test.ts` : `chiffrer` déchiffré par une clé d'agent utilisateur générée dans le test (RFC 8291 : en-tête 86 octets, `rs` 4096) ; `jetonVapid` vérifié par la clé publique ; `clesVapid` nul sans secrets ;
  - `envoi-push.test.ts` : 3 en file, faux `envoyer` : 201, 410, exception → 1 abonnement supprimé, file vide, en-têtes `Authorization: vapid t=…, k=…`, `TTL`, `Topic` dérivé du tag ; `max` respecté ;
  - `planifie.test.ts` : le cron de nuit efface, le cron de la minute envoie ;
  - tests des actions : publier, commenter et envoyer appellent `locals.enArrierePlan`, et la notification existe une fois la promesse attendue ; une erreur de notification ne change pas la réponse ;
  - `centres.test.ts` : crons `['30 3 * * *', '* * * * *']`.
- [ ] **Étape 2 :** tests → échecs attendus.
- [ ] **Étape 3 :** code ; budget : les tests du budget de publier, commenter et envoyer comptent aussi la promesse en arrière-plan (≤ 45 + 2).
- [ ] **Étape 4 :** `pnpm test` au vert.
- [ ] **Étape 5 :** commit « Notifications : envoi Web Push par lots, tâche planifiée » et push.

### Tâche 3 : appli installable, abonnement, Moi → Notifications

**Fichiers :**
- Créer : `apps/web/static/manifest.webmanifest`, `static/icones/` (192, 512, masquable 512, `apple-touch-icon` 180, PNG tirés de Gyro), `apps/web/src/service-worker.ts`, `src/lib/push.ts` (navigateur), `src/routes/moi/notifications/{+page.server.ts,+page.svelte,page.server.test.ts,page.test.ts}`, `src/routes/moi/notifications/abonnement/+server.ts` (+ test)
- Modifier : `src/app.html` (manifeste, icônes), `src/routes/moi/+page.svelte` (rangée « Notifications »), `navigation.ts` (`/moi/notifications` sous Moi)

**Comportement :**
- Service worker : `push` → `showNotification(titre, { body, icon, badge, tag, data: { url } })` ; `notificationclick` → fenêtre de l'appli ouverte sur l'url, sinon nouvelle fenêtre. Rien en cache.
- `push.ts` : `etatPush()` → `'indisponible' | 'ios-a-installer' | 'refuse' | 'inactif' | 'actif'`, `activerPush(cle)`, `desactiverPush()`.
- `/moi/notifications` : « Ce téléphone » (bouton « Activer sur ce téléphone » ; sur iPhone non installé, étapes : 1. Partager, 2. « Sur l'écran d'accueil », 3. ouvrir Gyro Caserne depuis l'icône ; refusé : comment réautoriser ; sans clés : « pas encore configurées pour ce centre ») ; interrupteur « Tout couper » (formulaire, marche sans JavaScript) ; « Coupés » : liste avec « Réactiver » ; nombre d'appareils activés.
- `abonnement/+server.ts` : POST (JSON `{ endpoint, keys: { p256dh, auth }, appareil }`) et DELETE (`{ endpoint }`), réservés aux personnes, 400 si invalide.

- [ ] **Étape 1 : tests d'abord** : load (coupures nommées, `clePublique` ou nulle, appareils), actions `toutCouper`, `reactiver` ; POST/DELETE ; rendu (bouton, étapes iPhone, interrupteur avec `aria-pressed` ou case à cocher, « Réactiver » nommé « Réactiver <lieu> ») ; Moi montre la rangée ; manifeste valide (nom, `display: standalone`, icônes présentes).
- [ ] **Étape 2 :** échecs attendus. **Étape 3 :** code. **Étape 4 :** `pnpm test` vert.
- [ ] **Étape 5 :** commit « Notifications : appli installable, Moi → Notifications » et push.

### Tâche 4 : la cloche en fil, cloches barrées, en-tête au visage

**Fichiers :**
- Modifier : `src/routes/+layout.server.ts` (+ test : `cloche` = `enTeteDe.nonLues` + signalements, `visage`), `src/routes/+layout.svelte`, `src/lib/ui/Coquille.svelte` (+ `coquille.test.ts`), `src/routes/notifications/{+page.server.ts,+page.svelte,tests}`, `src/routes/echanges/[mur]/{+page.server.ts,+page.svelte,tests}`, `src/lib/messagerie/Conversation.svelte`, `src/routes/echanges/messages/[id]/{+page.server.ts,tests}`, `src/routes/budget.test.ts`
- Créer : `src/lib/ui/ClocheCoupee.svelte` (bouton de formulaire, cloche barrée ou non, `aria-pressed`, nom « Couper les notifications de <lieu> »)

**Comportement :**
- Cloche : signalements en tête (inchangés), puis le fil groupé « Aujourd'hui / Plus tôt » ; ligne = visage de l'auteur, « <Prénom Nom> a publié dans <mur> » ou « … a commenté votre publication », extrait, heure ; non lue : point, gras et « Non lu » pour les lecteurs d'écran ; lien vers `/echanges/<mur>/<id>`. « Tout marquer comme lu » en haut s'il y a du non-lu. « À faire » quitte la cloche (reste sur l'Accueil).
- Chiffre : non-lues + signalements non traités. Super administrateur : signalements seuls.
- En-tête : visage seul (initiales, couleur d'équipe) nommé « Moi » ; super administrateur : l'icône de profil seule, nommée « Moi ».
- Mur et conversation : `ClocheCoupee` dans l'en-tête ; action `couper` ; un geste sans JavaScript recharge la page.

- [ ] **Étape 1 : tests d'abord** : layout (cloche, visage) et budget (racine ≤ 11 inchangé, cloche en une lecture) ; page notifications (fil, groupes, tout marquer lu) ; Coquille (visage, nom « Moi ») ; mur et conversation (`coupe`, action `couper`, bouton rendu).
- [ ] **Étape 2 :** échecs attendus. **Étape 3 :** code. **Étape 4 :** `pnpm test` vert.
- [ ] **Étape 5 :** commit « Notifications : la cloche en fil, cloches barrées, en-tête au visage » et push.

### Tâche 5 : secrets VAPID en préprod, doc, e2e, captures

**Fichiers :**
- Créer : `apps/web/scripts/cles-vapid.ts` (affiche une paire neuve, rien d'écrit sur disque), `docs/fonctionnel/notifications.md` (réécrite), `docs/utilisation/activer-les-notifications.md`, `docs/utilisation/couper-les-notifications.md`, `docs/decisions/0012-notifications-file-d-envoi.md`, `apps/web/e2e/notifications.spec.ts`
- Modifier : `.github/workflows/deployer.yml` (après `pnpm deployer`, si les secrets existent : `wrangler secret bulk` depuis l'entrée standard), `docs/technique/installer-un-centre.md`, `docs/technique/README.md`, `docs/utilisation/README.md`, `docs/fonctionnel/README.md`, `apps/web/e2e/accessibilite.spec.ts` (`/moi/notifications`)

- [ ] **Étape 1 :** e2e : publier sur un mur depuis le compte de test, la cloche montre 1 chez un autre agent (via base locale), ouvrir le fil puis « Tout marquer comme lu » ; cloche barrée sur un mur ; axe sans violation sur `/moi/notifications` et `/notifications`.
- [ ] **Étape 2 :** paire VAPID générée, posée par `gh secret set VAPID_PUBLIQUE` / `VAPID_PRIVEE` (valeurs jamais affichées dans un journal), étape de `deployer.yml`.
- [ ] **Étape 3 :** doc ; `pnpm test` complet ; captures 390 et 1280, clair et sombre (cloche, Moi → Notifications, mur, conversation, en-tête) regardées et corrigées.
- [ ] **Étape 4 :** commit « Notifications : secrets VAPID en préprod, doc, e2e » et push ; `gh workflow run verifier.yml --ref fonction/notifications` jusqu'au vert.
