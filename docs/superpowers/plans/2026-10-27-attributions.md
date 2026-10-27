# Effectif, lot 3 : les responsabilités à l'écran — plan de mise en œuvre

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nommer et retirer des responsabilités depuis la fiche d'un agent et depuis une page « Nominations », et afficher les rôles en cours dans la vue de tous.

**Architecture:** Lectures et écritures dans le socle (règles d'attribution existantes, `finirOuSupprimer` pour « Terminer ») ; l'appli n'appelle que ces fonctions.

**Tech Stack:** SvelteKit 3, Svelte 5, Drizzle (D1 / SQLite en test), Vitest, Playwright + axe (CI).

**Spec:** `docs/superpowers/specs/2026-10-27-attributions-design.md`

## Global Constraints

- Les règles d'attribution du socle (`exigerAttribution`, `attribuer`, `finirAttribution`) restent la seule source de vérité ; aucune règle recopiée côté page.
- « Terminer » : perte du rôle aujourd'hui via `finirOuSupprimer` (fin la veille, ou suppression si début aujourd'hui ou plus tard).
- Doublon refusé : même personne, même responsabilité, même périmètre, périodes qui se chevauchent → `DonneeInvalide('Cette personne tient déjà ce rôle sur cette période')`.
- Fiche : visible des gestionnaires seulement (lot 1). Page « Nominations » : quiconque peut attribuer au moins une responsabilité. Vue de tous : rôles en cours (nom de la responsabilité, et nom de l'équipe ou du comité si périmètre).
- Fondations : composants `#lib/ui`, téléphone et ordinateur à égalité, RGAA AA, français, vouvoiement. Docs listées dans la spec.
- Machine de 2 Go : cage et limite de temps, commit + push à chaque étape verte, Playwright en CI.

## Review Focus

1. Le rapporteur du comité « Amicale » tente de nommer un « Référent engins » (attribué par le chef de centre) ou un membre d'un autre comité, par un formulaire fabriqué → refus, rien d'écrit (Tâches 1 et 3).
2. « Terminer » sur une attribution à venir → elle disparaît (annulée) ; sur une attribution en cours → l'agent n'a plus les droits du rôle dès aujourd'hui (Tâche 1).
3. Nommer deux fois la même personne au même rôle sur des périodes qui se chevauchent → refus clair (Tâche 1).
4. Un agent ordinaire ouvre `/nominations` → 403 ; il ne voit dans la vue de tous que des noms de rôles, jamais de dates ni d'auteur (Tâches 3 et 4).
5. Une attribution dont le comité est dissous ou la responsabilité archivée n'apparaît plus « en cours » (Tâches 1 et 4).

---

### Tâche 1 : Socle — lectures et « Terminer »

**Files:** `packages/socle/src/actions/attributions.ts`, `packages/socle/src/effectif.ts` (ou un nouveau `nominations.ts`), tests correspondants, `index.ts`

**Interfaces (produces):**
- `attributionsDe(base, acteur, personneId, aujourdhui): Promise<{ enCours: LigneAttribution[]; aVenir: LigneAttribution[]; passees: LigneAttribution[] }>` avec `LigneAttribution = { id; responsabilite: { id; nom }; perimetre: { type; id: number | null; nom: string | null }; debut; fin: string | null; saisiePar: string; peutTerminer: boolean }` — gestionnaires seulement (`RefusDroit` sinon) ;
- `ceQueJePeuxAttribuer(base, acteur, aujourdhui): Promise<{ responsabiliteId; nom; portee; perimetres: { type; id: number | null; nom: string }[] }[]>` — responsabilités non archivées et périmètres (comités non dissous, équipes actives) pour lesquels `exigerAttribution` passerait ;
- `titulairesDe(base, acteur, responsabiliteId, aujourdhui)` : attributions en cours et à venir de cette responsabilité, sur les périmètres que l'acteur peut attribuer ;
- `terminerAttribution(base, acteur, attributionId, aujourdhui): Promise<void>` — mêmes droits que `finirAttribution`, `finirOuSupprimer`, journal `terminer_attribution` ;
- `attribuer` refuse le doublon (voir contraintes).

- [ ] **Step 1 : tests qui échouent** : les 5 points de la Review Focus côté socle ; `ceQueJePeuxAttribuer` pour le chef de centre (tout sauf chef de centre), le rapporteur « Amicale » (rôles du comité Amicale seulement), le super (tout), un agent ordinaire (vide) ; `attributionsDe` classe correctement en cours / à venir / passées ; `peutTerminer` faux pour le rôle de chef de centre vu par l'adjoint.
- [ ] **Step 2** : échecs. **Step 3** : implémenter. **Step 4** : tests + `tsc` en cage. **Step 5** : commit `Socle : nominations (lectures, terminer, doublons)`, push.

### Tâche 2 : La carte « Responsabilités » de la fiche

**Files:** `apps/web/src/routes/agents/[id]/+page.server.ts`, `+page.svelte`, tests (`page.server.test.ts`, `page.test.ts`), traduction des erreurs (`#lib/server/formulaire-agent.ts` ou voisin)

- [ ] **Step 1 : tests qui échouent** : `load` renvoie `attributions` et `peutAttribuer` (filtré pour cette personne : périmètre équipe = son équipe par défaut) ; actions `?/attribuer` (succès, refus 403 avec message, doublon sur le champ, fin avant début) et `?/terminer` (exige `confirmation=oui`) ; rendu : trois listes (« En cours », « À venir », « Passées » repliée), bouton « Terminer » seulement si `peutTerminer`.
- [ ] **Step 2** : échecs. **Step 3** : implémenter (`Carte` « Responsabilités », formulaire `Choix` responsabilité + `Choix` périmètre si besoin + dates `Champ type="date"`). **Step 4** : tests + `check` en cage. **Step 5** : commit `Fiche agent : responsabilités (attribuer, terminer)`, push.

### Tâche 3 : La page « Nominations »

**Files:** `apps/web/src/routes/nominations/` (`+page.server.ts`, `+page.svelte`, tests), `apps/web/src/lib/ui/navigation.ts` (+ test) et le `load` du layout racine (entrée « Nominations » si `ceQueJePeuxAttribuer` n'est pas vide)

- [ ] **Step 1 : tests qui échouent** : agent ordinaire → 403 ; rapporteur → seulement ses rôles ; pour chaque rôle, titulaires et formulaire « Nommer » (choix de l'agent parmi les non-partis) ; actions `?/attribuer` et `?/terminer` partagées avec la fiche (même traduction d'erreurs, sans duplication).
- [ ] **Step 2** : échecs. **Step 3** : implémenter. **Step 4** : tests + `check` en cage. **Step 5** : commit `Nominations : la page des rôles à attribuer`, push.

### Tâche 4 : Les rôles dans la vue de tous

**Files:** `packages/socle/src/effectif.ts` (`vueEffectif` : `roles: string[]` par personne, rôles en cours seulement, libellé « Nom » ou « Nom (Équipe 2) » / « Nom (Amicale) »), tests ; `apps/web/src/routes/agents/+layout.svelte` (affichage sous le nom)

- [ ] **Step 1 : tests qui échouent** : rôle en cours présent, à venir absent, passé absent, comité dissous absent ; aucune date ni auteur dans les données de la vue.
- [ ] **Step 2–4** : implémenter, tests + `check` en cage. **Step 5** : commit `Agents : rôles en cours dans la vue de tous`, push.

### Tâche 5 : Accessibilité, parcours en CI, documentation

**Files:** `apps/web/e2e/accessibilite.spec.ts`, docs listées dans la spec

- [ ] **Step 1 : tests** aux deux tailles et deux thèmes : axe sur la fiche avec la carte « Responsabilités » et sur `/nominations` ; parcours super : nommer un agent fictif « Chef d'équipe » de son équipe, le voir dans la vue de tous, terminer, le voir disparaître ; agent ordinaire : `/nominations` → 403.
- [ ] **Step 2** : pousser, regarder la CI, corriger. **Step 3** : docs (dont l'aide « Comment nommer quelqu'un à une responsabilité ? »). Commit, push ; CI verte.
