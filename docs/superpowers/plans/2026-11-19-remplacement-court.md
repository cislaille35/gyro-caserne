# Remplacement court — plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** demander un remplacement de 2 ou 3 h dans son astreinte du jour, conclu dès qu'un disponible accepte, refusable par le chef de garde (si une aptitude contrôlée manque) ou par le demandeur jusqu'au début.

**Architecture :** un nouveau genre `court` dans `demande_remplacement` (GENRES_DEMANDE, listes.ts:96), une seule période `{ debut, fin }` incluse dans une tranche d'astreinte du demandeur. On réutilise les demandes ouvertes (`demanderRemplacement`, `accepterDemande`, `requeteConclues`/`effectifs`), le contrôle des aptitudes (`manque`, contexte.ts) et les urgences (`avisUrgence`, urgences.ts).

**Tech Stack :** SvelteKit 2 / Svelte 5, drizzle + D1, vitest.

**Spec :** `docs/superpowers/specs/2026-11-19-remplacement-court-design.md`

## Global Constraints

- Durée **2 h ou 3 h** ; début au **quart d'heure** ; la plage tient entière dans une tranche d'astreinte du jour du demandeur ; début possible déjà passé de la tranche, mais pas avant « maintenant » arrondi au quart d'heure suivant.
- Toujours ouverte à tous les disponibles (pas de cible, pas d'échange).
- Conclue à la première acceptation ; refus possible par le chef de garde (seulement si une aptitude contrôlée manque) ou par le demandeur, **jusqu'au début** ; **sans refus, elle tient**.
- Refus → l'état revient à « refusée après coup », le titulaire reste d'astreinte ; urgence au demandeur (refus du chef) et avis au remplaçant ; la demande ne repart pas.
- Rien ne change pour les genres existants.
- Migration additive seulement (CHECK de `genre`/`etat` : reconstruire comme 0022 si nécessaire, rowid recopié, test de migration).
- Calcul : mêmes lectures qu'une demande ouverte ; budgets de requêtes verts sans relever les plafonds.
- Charte (`.claude/skills/charte-gyro/SKILL.md`), RGAA, téléphone d'abord ; aucun marqueur d'interface générée (consigne du porteur).
- Machine : `export PATH="$HOME/.local/lib/node/bin:$PATH"` ; `timeout 400 systemd-run --user --scope -q -p MemoryMax=1500M pnpm exec vitest run <fichiers>`, un à la fois ; jamais Playwright ni la suite complète en local ; svelte-check une fois à la fin (`NODE_OPTIONS=--max-old-space-size=1350`).

## Review Focus

- Plage à cheval sur deux tranches, ou qui dépasse la fin de l'astreinte : refusée avec un message clair.
- Demande déjà commencée : plus d'acceptation, plus de refus ; elle expire à son début si personne ne l'a prise (titulaire prévenu).
- Deux acceptations simultanées : une seule l'emporte (comme les demandes ouvertes).
- Refus après le début (horloge) : refusé par le socle même si le bouton est encore affiché.
- Chef de garde demandeur ou remplaçant : le refus revient au chef de centre / adjoint (règle `valideurs` existante).

---

### Task 1 : socle — demander et accepter un remplacement court

**Files :** `packages/socle/src/listes.ts`, `schema.ts` + migration + test de migration, `remplacements/demandes.ts`, `remplacements/contexte.ts`, `test/remplacements-court.test.ts`.

**Interfaces :**
- Produces : `demanderRemplacementCourt(base, acteur, d: { debut: string; duree: 2 | 3; mot?: string | null }, maintenant, reglage): Promise<number>` ; `accepterDemande` renvoie `'conclue'` pour un court (jamais `'a_valider'`) et prévient le chef de garde : simple avis si rien ne manque, urgence (`avisUrgence`) avec les aptitudes manquantes sinon.

- [ ] Tests : durée hors {2, 3} → `DonneeInvalide` ; début pas au quart d'heure → refus ; plage hors d'une tranche du demandeur du jour → refus ; début passé → refus ; création → destinataires = disponibles (comme une demande ouverte) ; acceptation → `conclue`, `effectifs()` montre le remplaçant sur la seule plage ; aptitude manquante → urgence au chef de garde avec le nom de l'aptitude.
- [ ] Code, migration (genre `court`, état `refusee_apres` si l'état n'existe pas déjà). Commit.

### Task 2 : socle — refus après coup et délais

**Files :** `remplacements/demandes.ts`, `remplacements/moment.ts`, `remplacements/avis.ts`, tests.

**Interfaces :**
- Produces : `refuserApresCoup(base, acteur, id, maintenant, reglage): Promise<void>` (chef de garde valideur si une aptitude manque, ou demandeur ; avant le début seulement).

- [ ] Tests : le demandeur refuse avant le début → état `refusee_apres`, titulaire responsable, remplaçant prévenu ; le chef refuse (aptitude manquante) → idem + urgence au demandeur ; le chef sans aptitude manquante → `RefusDroit` ; après le début → refus ; non prise au début → `expiree` (règle existante de `remplacementsDuMoment`) ; pas de relance de la veille pour un court.
- [ ] Code. Commit.

### Task 3 : écrans

**Files :** `apps/web/src/routes/remplacements/demander/*` (ou nouvelle étape « Court »), `routes/remplacements/[id]/*`, plaque d'astreinte (accueil, planning), tests de page.

- [ ] Parcours : « Me faire remplacer » propose « Quelques heures » quand l'agent est d'astreinte aujourd'hui ; il choisit l'heure de début (sélecteur natif, pas de 15 min, bornes de la tranche) et 2 h ou 3 h ; récapitulatif « Remplacement de 20 h à 22 h, ouvert à tous les disponibles » ; envoyer.
- [ ] Page de la demande : pour le demandeur et le chef (si aptitude manquante), « Refuser ce remplaçant » en action grave confirmée, tant que la plage n'a pas commencé.
- [ ] Planning, plaque d'astreinte, vue du chef de garde : « Marc de 20 h à 22 h » ; agenda du téléphone (.ics) : l'événement du remplaçant sur la plage.
- [ ] Tests de rendu et de formulaires ; captures téléphone clair (parcours et page de la demande). Commit.

### Task 4 : doc et vérification

- [ ] `docs/fonctionnel/remplacements-et-echanges.md` (section « Remplacement court », exemple de 20 h à 22 h), guide `docs/utilisation/` « Me faire remplacer quelques heures », `docs/technique/socle.md`, décision `docs/decisions/0039-remplacement-court.md`.
- [ ] e2e court (`apps/web/e2e/remplacement-court.spec.ts`) : demander 2 h, un autre compte accepte, le planning montre la plage ; non lancé en local.
- [ ] `tsc` socle, svelte-check à 0 ; tests touchés verts ; push.
