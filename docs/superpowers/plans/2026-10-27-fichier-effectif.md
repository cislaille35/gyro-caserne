# Effectif, lot 4 : le fichier de l'effectif (XLSX) — plan de mise en œuvre

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exporter l'effectif (ou un modèle vierge) en XLSX avec listes déroulantes, puis l'importer avec un aperçu avant validation.

**Architecture:** Le navigateur écrit et lit le fichier ; le serveur ne voit que du JSON. Le socle fournit trois fonctions : les données du fichier, l'aperçu (lectures groupées, aucune écriture) et l'application d'**une** opération via les actions existantes. Le navigateur envoie les opérations une à une, parce que D1 gratuit limite à 50 requêtes par appel (un `batch` compte pour une).

**Tech Stack:** SvelteKit 3, Svelte 5, Drizzle (D1 / SQLite en test), Vitest, Playwright + axe (CI), `write-excel-file` 4.1.1 et `read-excel-file` 9.3.12 (entrées `/universal`).

**Spec:** `docs/superpowers/specs/2026-10-27-fichier-effectif-design.md`

## Global Constraints

- Réservé aux gestionnaires (`estGestionnaire`) : chaque fonction du socle et chaque route le vérifient.
- Chef de centre et adjoint **en fonction** : jamais exportés, jamais modifiés ni mis au départ par le fichier ; leurs responsabilités n'ont pas de colonne.
- Aucune règle métier recopiée : chaque écriture passe par `ajouterPersonne`, `modifierFiche`, `affecterEquipe`, `retirerEquipe`, `changerStatut`, `attribuer`, `terminerAttribution`.
- **50 requêtes au plus** par appel au socle (un `batch` = 1) : `donneesFichier` et `apercuImport` lisent par requêtes groupées, jamais une requête par ligne.
- Dates du fichier en `JJ/MM/AAAA` (on accepte aussi `J/M/AAAA` et les cellules date du tableur) ; ISO `AAAA-MM-JJ` dans le socle.
- En-têtes de données exacts, dans cet ordre : `N°`, `E-mail`, `Prénom`, `Nom`, `Grade`, `Date de grade`, `Équipe`, `Statut`, `Profil`, `Téléphone`, `Naissance`, `Entrée au centre`, `Engagement SPV`. Puis une colonne par responsabilité (en-tête = son nom), puis une par comité (`Comité : <nom>`).
- Valeurs : grade = `libelle`, équipe = `nom` (actives), statut = libellés de `#lib/ui/statut.ts` (« Opérationnel »…), profil = `nom`, responsabilité = `Oui` ou vide, comité = nom d'une responsabilité de portée comité ou vide.
- Cellule vide sur une ligne : champ facultatif effacé ; statut vide = « Opérationnel » ; profil obligatoire (erreur « Indiquez le profil ») ; e-mail, prénom, nom obligatoires.
- Repère d'export `{ journal: number; personne: number }` (plus grands `journal.id` et `personne.id` au moment de l'export), écrit dans une feuille masquée `Repère` ; absent du modèle vierge.
- Fondations : composants `#lib/ui`, téléphone et ordinateur à égalité, RGAA AA, français, vouvoiement. Dépendances à versions fixées, justifiées dans `docs/technique/`.
- Machine de 2 Go : commandes lourdes en cage (`systemd-run --user --scope -q -p MemoryMax=1100M -p MemorySwapMax=900M timeout 900 …`), commit + push à chaque étape verte, Playwright en CI.

## Review Focus

1. Fichier tronqué (lignes supprimées par erreur) → tous les départs en tête de l'aperçu avec leur nombre ; rien n'est écrit sans « Valider » (Tâches 3 et 6).
2. Vieux fichier réimporté après une modification à l'écran ou un import → ligne périmée, non appliquée ; un agent créé après l'export ne part pas (Tâche 3).
3. Fichier enregistré par LibreOffice ou Excel : dates en cellules date ou en texte, nombres en `N°`, espaces autour des valeurs, lignes vides au milieu → lus correctement (Tâche 5).
4. Ligne qui vise le chef de centre ou l'adjoint en fonction (par son n°), ou un e-mail de super administrateur → erreur sur la ligne (Tâches 1 et 3).
5. Import de 150 lignes avec plusieurs rôles : aucun appel au socle ne dépasse 50 requêtes (Tâches 2, 3, 4).

---

### Tâche 1 : Socle — l'adresse du super administrateur refusée dans le socle

**Files:** `packages/socle/src/actions/personnes.ts`, `packages/socle/test/actions-personnes.test.ts`, appels dans `apps/web/src/routes/agents/nouveau/+page.server.ts`, `apps/web/src/routes/agents/[id]/+page.server.ts`, `apps/web/src/lib/server/formulaire-agent.ts`, leurs tests, `docs/technique/socle.md`

**Interfaces (produces):**
- `ajouterPersonne(base, acteur, donnees, aujourdhui, adressesReservees: string[])` et `modifierFiche(base, acteur, id, champs, aujourdhui, adressesReservees: string[])` : paramètre **obligatoire** ; l'adresse normalisée présente dans `adressesReservees` (normalisées aussi) → `DonneeInvalide('Adresse réservée au super administrateur')`, avant toute écriture.

- [ ] **Step 1 : tests qui échouent** : ajout et modification avec `'Admin@Exemple.fr '` quand `adressesReservees = ['admin@exemple.fr']` → refus, base inchangée ; adresse libre → accepté.
- [ ] **Step 2** : échecs. **Step 3** : implémenter ; les pages passent `locals.superAdmins` ; le contrôle du formulaire web est retiré et le message du socle arrive sur le champ e-mail (tests de page adaptés). **Step 4** : tests socle + web, `tsc` en cage. **Step 5** : commit `Socle : adresse du super administrateur refusée`, push, PR en brouillon.

### Tâche 2 : Socle — les données du fichier

**Files:** Create `packages/socle/src/fichier-effectif.ts`, `packages/socle/test/fichier-effectif.test.ts` ; Modify `packages/socle/src/index.ts`, `packages/socle/test/base-de-test.ts` (compteur)

**Interfaces (produces):**
- `export const ENTETES = ['N°', 'E-mail', … 'Engagement SPV'] as const` et `export const LIBELLES_STATUT: Record<StatutOperationnel, string>` (mêmes libellés que l'interface ; `#lib/ui/statut.ts` les réutilise ensuite).
- `export type Repere = { journal: number; personne: number }`
- `export type DonneesFichier = { entetes: string[]; listes: { grades: string[]; equipes: string[]; statuts: string[]; profils: string[]; rolesComite: string[] }; colonnesListe: Record<string, keyof DonneesFichier['listes'] | 'oui'>; lignes: string[][]; repere: Repere | null }` — `entetes` = données + responsabilités + comités ; `colonnesListe` dit quelle liste déroulante va sous quel en-tête ; `lignes` en texte (dates `JJ/MM/AAAA`, `N°` = id).
- `donneesFichier(base, acteur, aujourdhui, modele: boolean): Promise<DonneesFichier>` — `RefusDroit` si non gestionnaire ; `modele` → `lignes: []`, `repere: null`.
- `export function dateFichier(iso: string | null): string` et `export function dateIso(texte: string): string | null` (null si invalide).
- Test : `baseDeTest({ compter: true })` expose `base.requetes` (nombre d'appels, batch = 1).

- [ ] **Step 1 : tests qui échouent** : export = tous sauf chef de centre et adjoint en fonction, partis et extérieurs compris, triés par nom ; colonnes = responsabilités non archivées de portée centre ou équipe hors `chef_centre`/`chef_centre_adjoint`, puis comités non dissous ; un « Oui » sous « Chef d'équipe » pour le chef de l'équipe 2 ; « Membre de comité » sous `Comité : Amicale` ; dates en `JJ/MM/AAAA` ; `repere` = plus grands id ; modèle → aucune ligne ; agent ordinaire → `RefusDroit` ; 150 agents fictifs → `base.requetes <= 50` ; `dateIso('1/3/2024') === '2024-03-01'`, `dateIso('31/02/2024') === null`.
- [ ] **Step 2–4** : échecs, implémenter, tests + `tsc` en cage. **Step 5** : commit `Socle : données du fichier de l'effectif`, push.

### Tâche 3 : Socle — l'aperçu de l'import

**Files:** `packages/socle/src/fichier-effectif.ts`, `packages/socle/test/apercu-import.test.ts`, `index.ts`

**Interfaces:**
- Consumes : `ENTETES`, `LIBELLES_STATUT`, `dateIso`, `Repere` (Tâche 2).
- Produces :
  - `export type FichierLu = { entetes: string[]; lignes: { numero: number; cellules: string[] }[]; repere: Repere | null }` — `numero` = n° de ligne du tableur ; cellules déjà en texte, coupées.
  - `export type RefPersonne = { id: number } | { ligne: number }` (`ligne` : l'agent créé par l'opération `ajouter` de cette ligne)
  - `export type Operation = { ligne: number } & ({ type: 'ajouter'; donnees: Parameters<typeof ajouterPersonne>[2] } | { type: 'modifier'; personneId: number; champs: Partial<ChampsFiche> } | { type: 'equipe'; personneId: number; equipeId: number | null } | { type: 'statut'; personneId: number; statut: StatutOperationnel } | { type: 'attribuer'; personne: RefPersonne; responsabiliteId: number; perimetre: Perimetre } | { type: 'terminer'; attributionId: number })`
  - `export type Apercu = { departs: { personneId: number; nom: string }[]; arrivees: { ligne: number; nom: string }[]; modifications: { ligne: number; nom: string; changements: { colonne: string; avant: string; apres: string }[] }[]; erreurs: { ligne: number; colonne: string | null; message: string }[]; perimees: { ligne: number; nom: string }[]; colonnesIgnorees: string[]; operations: Operation[] }`
  - `apercuImport(base, acteur, fichier: FichierLu, aujourdhui, adressesReservees: string[]): Promise<Apercu>` — aucune écriture.

Règles (celles de la spec, plus) : une ligne est soit appliquée en entier, soit en erreur ou périmée (aucune opération) ; `equipe` = `affecterEquipe(…, aujourdhui, …)` ou `retirerEquipe` si `null` ; ordre des opérations d'une ligne : `ajouter`/`modifier`, `equipe`, `statut`, `terminer`, `attribuer` ; les départs (`statut: 'parti'`) à la fin ; « périmé » = une entrée de journal d'id > `repere.journal` qui vise la personne (`cibleType 'personne'`) ou l'une de ses attributions ; ligne avec `N°` sans `repere` → erreur « Partez d'un export pour modifier un agent » ; `N°` inconnu → erreur ; même e-mail sur deux lignes → erreur sur les deux ; en-tête de données manquant → erreur de fichier (`ligne: 0`) et aucune opération.

- [ ] **Step 1 : tests qui échouent** (un par règle, dont les Review Focus 1, 2, 4, 5) : arrivée avec équipe, statut et deux rôles ; modification champ par champ (avant → après) ; équipe vide → `equipe: null` ; chef d'équipe qui change d'équipe → `terminer` puis `attribuer` sur la nouvelle ; rôle d'équipe sur une autre équipe → erreur ; deux rôles dans un même comité → erreur ; colonne inconnue → `colonnesIgnorees` ; agent absent → départ, sauf chef/adjoint en fonction, déjà parti, créé après le repère ou périmé ; modèle vierge → aucun départ ; ligne périmée ; profil vide ; date invalide (« Ligne 12, Naissance : date invalide ») ; grade, équipe, statut, profil inconnus ; e-mail réservé ; e-mail déjà pris par un autre agent ; base inchangée après l'aperçu ; 150 lignes → `base.requetes <= 50`.
- [ ] **Step 2–4** : échecs, implémenter, tests + `tsc` en cage. **Step 5** : commit `Socle : aperçu de l'import`, push.

### Tâche 4 : Socle — appliquer une opération

**Files:** `packages/socle/src/fichier-effectif.ts`, `packages/socle/test/appliquer-import.test.ts`, `index.ts`

**Interfaces:**
- Consumes : `Operation`, `RefPersonne` (Tâche 3), actions existantes, `adressesReservees` (Tâche 1).
- Produces : `appliquerOperation(base, acteur, op: Operation, nouvelles: Record<number, number>, aujourdhui, adressesReservees: string[]): Promise<{ personneId: number | null }>` — `RefusDroit` si non gestionnaire ; `nouvelles` = n° de ligne → id créé ; `{ ligne }` absent de `nouvelles` → `DonneeInvalide('Agent de la ligne non créé')` ; refuse toute opération sur le chef de centre ou l'adjoint en fonction ; renvoie l'id créé pour `ajouter`, sinon `null`. Les erreurs des actions remontent telles quelles.

- [ ] **Step 1 : tests qui échouent** : chaque type d'opération écrit ce qu'il faut et laisse son journal ; enchaînement aperçu → toutes les opérations → nouvel aperçu du même fichier sans `N°` pour les arrivées = erreurs « adresse déjà utilisée » et **aucun** départ des nouveaux ; acteur non gestionnaire refusé ; opération sur le chef de centre refusée ; chaque appel ≤ 50 requêtes.
- [ ] **Step 2–4** : échecs, implémenter, tests + `tsc` en cage. **Step 5** : commit `Socle : appliquer une opération d'import`, push.

### Tâche 5 : Appli — écrire et lire le classeur

**Files:** Create `apps/web/src/lib/fichier-effectif/classeur.ts`, `apps/web/src/lib/fichier-effectif/classeur.test.ts` ; Modify `apps/web/package.json` (+ `write-excel-file` 4.1.1, `read-excel-file` 9.3.12, versions fixées), `docs/technique/README.md` (ou la page des dépendances existante) ; `apps/web/src/lib/ui/statut.ts` réutilise `LIBELLES_STATUT` du socle

**Interfaces:**
- Consumes : `DonneesFichier`, `FichierLu`, `Repere` (socle).
- Produces :
  - `ecrireClasseur(donnees: DonneesFichier): Promise<Blob>` — `write-excel-file/universal` ; feuilles `Effectif` (ligne d'en-têtes en gras et figée, colonnes date au format `dd/mm/yyyy`), `Listes` (masquée, une colonne par liste) et `Repère` (masquée, `A1` journal, `B1` personne ; absente si `repere` est null) ; listes déroulantes sur les lignes 2 à 1000 via une « feature » qui insère `<dataValidations>` dans `xl/worksheets/sheet1.xml` à sa place (ordre des éléments OOXML) et masque les feuilles dans `xl/workbook.xml`. Modèle tiré de l'essai : `/tmp/claude-1000/-home-maxvm-projets/d453d9a7-7f1c-42a4-982d-6208397d4160/scratchpad/essai-xlsx/essai.mjs`.
  - `lireClasseur(fichier: Blob): Promise<FichierLu>` — `read-excel-file/universal` ; cellule date → `JJ/MM/AAAA` (UTC), nombre → texte sans décimale, texte coupé ; lignes entièrement vides ignorées ; `numero` = n° réel de la ligne du tableur ; feuille `Effectif` absente → `Error('Feuille « Effectif » introuvable')`.
  - `nomDuFichier(modele: boolean, aujourdhui: string): string` → `effectif-2026-10-27.xlsx` ou `modele-effectif.xlsx`.

- [ ] **Step 1 : tests qui échouent** (Vitest, Node) : aller-retour `lireClasseur(await ecrireClasseur(d))` redonne en-têtes, lignes et repère ; le XML contient une `dataValidation` par colonne à liste et la feuille `Listes` en `state="hidden"` ; fichier sans `Repère` → `repere: null` ; un classeur où la date est une cellule date et un autre où elle est du texte `1/3/2024` → même résultat ; des espaces autour des valeurs sont retirés ; une ligne vide au milieu est sautée et les `numero` suivants restent justes.
- [ ] **Step 2–4** : échecs, implémenter, tests en cage. Vérifier en plus une fois à la main, hors tests, qu'un fichier écrit puis réenregistré par LibreOffice (`soffice --headless --convert-to xlsx`, installé sur la VM) se relit à l'identique. **Step 5** : commit `Appli : écrire et lire le classeur de l'effectif`, push.

### Tâche 6 : Appli — la page « Fichier de l'effectif »

**Files:** Create `apps/web/src/routes/agents/fichier/+page.server.ts`, `+page.svelte`, `donnees/+server.ts`, `apercu/+server.ts`, `operation/+server.ts`, leurs tests ; Modify la page « Agents » des gestionnaires (lien « Fichier de l'effectif »)

**Interfaces:**
- Consumes : `donneesFichier`, `apercuImport`, `appliquerOperation` (socle), `ecrireClasseur`, `lireClasseur`, `nomDuFichier` (Tâche 5), `exigerGestion`.
- Produces :
  - `GET /agents/fichier/donnees?modele=1` → `DonneesFichier` en JSON ;
  - `POST /agents/fichier/apercu` (JSON `FichierLu`) → `Apercu` ;
  - `POST /agents/fichier/operation` (JSON `{ operation: Operation; nouvelles: Record<number, number> }`) → `{ personneId: number | null }`, ou 400 `{ message }` (`DonneeInvalide`) / 403 (`RefusDroit`). Toutes : 403 pour un non-gestionnaire, 415 si le corps n'est pas du JSON.
  - Page : « Télécharger le modèle vierge », « Exporter l'effectif », champ « Importer un fichier » (`.xlsx`), puis l'aperçu dans l'ordre de la spec (départs en tête, avec leur nombre), « Valider » / « Abandonner ». Pendant l'application : progression (« 12 / 48 ») annoncée aux lecteurs d'écran (`aria-live="polite"`), opérations envoyées une à une, et pour une ligne les suivantes sautées après une erreur. Pour finir : le compte rendu (appliquées, en erreur avec le message), et le rappel « Réexportez avant le prochain import ».

- [ ] **Step 1 : tests qui échouent** : routes (gestionnaire, agent ordinaire 403, corps invalide 415, erreur du socle → 400 avec message) ; rendu de l'aperçu (départs en tête avec nombre, erreurs ligne par ligne, lignes périmées, colonnes ignorées, « Valider » absent s'il n'y a aucune opération) ; logique d'application extraite dans une fonction testée `appliquerTout(operations, envoyer): Promise<CompteRendu>` (substitution des ids des arrivées, une erreur saute la suite de sa ligne seulement).
- [ ] **Step 2–4** : échecs, implémenter, tests + `check` en cage. **Step 5** : commit `Agents : la page du fichier de l'effectif`, push.

### Tâche 7 : Accessibilité, parcours en CI, documentation

**Files:** `apps/web/e2e/accessibilite.spec.ts`, docs listées dans la spec (`docs/fonctionnel/fiche-agent.md`, `docs/technique/`, aide `docs/utilisation/importer-l-effectif.md`)

- [ ] **Step 1 : tests** aux deux tailles et deux thèmes : axe sur `/agents/fichier` avant et après dépôt d'un fichier ; parcours super : télécharger le modèle, le remplir (fichier fictif généré dans le test avec `ecrireClasseur`), importer, voir 2 arrivées, valider, voir les agents dans la liste ; exporter, retirer une ligne, réimporter, voir « 1 départ » en tête ; agent ordinaire : `/agents/fichier` → 403.
- [ ] **Step 2** : pousser, regarder la CI, corriger. **Step 3** : docs (aide « Comment importer l'effectif ? », étapes numérotées). Commit, push ; CI verte.
