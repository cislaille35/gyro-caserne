# Refonte du planning et astreinte sur l'Accueil — plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** remettre le planning dans le canevas harmonisé (agent : carte, À venir, vues Semaine · Mois · Année · Équipes ; chef : Préparer l'année en 5 étapes) et mettre la carte astreinte en tête de l'Accueil.

**Architecture :** lot d'interface. Le socle gagne deux lectures sans règle nouvelle (`astreinteDe` pour l'Accueil, la réponse à la prochaine manœuvre dans `planningDe`) et une rangée « Planning N à préparer » dans « À décider ». Le reste est dans `apps/web` : fonctions pures de mise en forme (`lib/planning/*.ts`, testées), petits composants (`lib/planning/*.svelte`), pages rendues côté serveur avec liens et formulaires qui marchent sans JavaScript (état des vues dans l'adresse).

**Tech :** SvelteKit 3 / Svelte 5, Drizzle sur D1, Vitest (rendu `svelte/server`), Playwright + axe.

**Spec :** `docs/superpowers/specs/2026-11-01-refonte-planning-design.md`

## Contraintes globales

- Canevas : `EnTetePage`, `Rangee`, `ListeRangees`, `Vide`, `Visage`, puces comme `FiltresEchanges`, rubriques repliables comme `.repli` des Échanges, jetons `app.css`.
- Couleur d'équipe toujours doublée d'un texte (« Équipe 3 », « Mon astreinte ») ; AA ; clavier ; lecteur d'écran ; `prefers-reduced-motion`.
- Téléphone d'abord (390), soigné à 1280, clair et sombre.
- Garder tout ce qu'apporte le lot Remplacements : « Me faire remplacer » (lien `/remplacements/demander#periode-<debut>`), « X remplace Y », lien Remplacements.
- Budget `apps/web/src/routes/budget.test.ts` (45 requêtes) tenu, Accueil surtout.
- Pas de migration, pas de règle métier nouvelle.
- Code et textes en français, commentaires rares.

## Points d'attention (Review Focus)

1. Agent sans équipe (chef de centre) : carte « Cette semaine : Équipe 2 d'astreinte », vue Équipes par défaut, aucune « Mon astreinte ».
2. Année non publiée / année suivante pas encore publiée en décembre : carte absente ou prochaine astreinte prise dans l'année suivante, phrase « Le planning N n'est pas encore publié ».
3. Pendant l'astreinte, en journée de semaine (hors plage) : « En cours jusqu'à vendredi 6 h » et la prochaine plage « ce soir 18 h – 6 h ».
4. Semaine à cheval sur deux mois / deux années (vue Mois, vue Semaine, flèches) : la bande garde son équipe et son numéro, les flèches passent d'une année à l'autre.
5. Sans JavaScript : vues, flèches, étapes, panneau de manœuvre et choix d'équipe d'une semaine marchent par liens et formulaires.

Chaque point a son test dans la tâche qui porte le code.

---

### Tâche 1 : carte astreinte (socle + brique) et Accueil

**Fichiers :**
- Créer : `packages/socle/src/planning/astreinte.ts` (+ test `astreinte.test.ts`), export dans `packages/socle/src/index.ts`
- Créer : `apps/web/src/lib/planning/astreinte.ts` (+ test), `apps/web/src/lib/planning/CarteAstreinte.svelte`
- Modifier : `apps/web/src/routes/+page.server.ts`, `+page.svelte` (carte en tête, retrait du « Bientôt ici »), `page.test.ts`, `page.server.test.ts`, `budget.test.ts`

**Interfaces :**
- Produit (socle) : `type Astreinte = { debut: string; fin: string; equipe: EquipePlanning; enCours: boolean; mienne: boolean; periodes: PeriodePlanning[] }` ;
  `astreinteDe(base, acteur, maintenant, reglage): Promise<Astreinte | null>` — avec une équipe : sa semaine en cours ou la prochaine (années publiées, l'année en cours et la suivante) ; sans équipe : la semaine en cours (`mienne: false`) ; `null` sans année publiée. Une seule lecture groupée (années, semaines changées des deux années, équipes, affectations).
- Produit (web) : `phraseAstreinte(a: Astreinte, maintenant: string): { titre: string; quand: string; plage: string | null; jours: number }`
  - à venir : titre « Votre équipe est d'astreinte dans 19 jours » / « demain » / « ce soir à 18 h » ; quand « du ven. 20 nov. 18 h au ven. 27 nov. 6 h » ;
  - en cours : titre « Vous êtes d'astreinte jusqu'à vendredi 6 h » ; plage « En ce moment, jusqu'à 6 h » ou « Prochaine plage : ce soir 18 h – 6 h » ;
  - sans équipe : titre « Cette semaine : Équipe 2 d'astreinte ».
- `CarteAstreinte.svelte` props : `{ a: Astreinte; maintenant: string; compacte?: boolean; lien?: string; remplacer?: boolean }` — fond teinté et liseré à la couleur de l'équipe, nom de l'équipe écrit ; pleine : boutons « Me faire remplacer » (`/remplacements/demander#periode-<debut>`) et « Ajouter à mon agenda » (`/moi/agenda`) ; compacte : toute la carte mène au Planning.

- [ ] Tests socle : agent d'équipe (prochaine), pendant sa semaine (`enCours`), sans équipe (semaine en cours, `mienne:false`), non publiée (`null`), fin d'année → semaine de l'année suivante publiée.
- [ ] Tests `phraseAstreinte` : les trois cas ci-dessus, « dans 1 jour » → « demain », journée de semaine pendant l'astreinte → prochaine plage « ce soir 18 h – 6 h ».
- [ ] Rendu Accueil : la carte compacte en tête avec « Équipe 1 » écrit et lien `/planning` ; plus de « Bientôt ici ».
- [ ] Budget : l'Accueil avec planning publié tient 45.
- [ ] `pnpm test` vert ; commit « Accueil : carte astreinte » ; push.

### Tâche 2 : onglet Planning

**Fichiers :**
- Modifier : `packages/socle/src/planning/annee.ts` (`ManoeuvreVue.publicationId`, `prochaine.manoeuvre.reponse`, `prochaine.astreinte.periodes`) + tests socle
- Créer : `apps/web/src/lib/planning/vues.ts` (+ test) ; `VueSemaine.svelte`, `VueMois.svelte`, `VueAnnee.svelte` (remplace `Annee.svelte`, sert aussi la vue Équipes), `BandeSemaine.svelte`
- Modifier : `apps/web/src/routes/planning/+page.server.ts`, `+page.svelte`, tests

**Interfaces :**
- Adresse : `?annee=` (gardé), `?vue=semaine|mois|annee|equipes`, `?semaine=AAAA-MM-JJ` (vue Semaine), `?mois=1..12` (vue Mois). Par défaut : `semaine` avec une équipe, `equipes` sans. La dernière vue est retenue dans `localStorage` (`planning-vue`), relue à l'arrivée sans `vue` dans l'adresse (try/catch).
- `vues.ts` :
  - `phrasePlanning(p: PlanningAgent, maintenant): string` — « Votre équipe est d'astreinte dans 19 jours », « Vous êtes d'astreinte ce soir à 18 h », « Le planning 2027 n'est pas encore publié ».
  - `joursDeLaSemaine(s: SemaineCalculee, reperes): { date, plages: string[], reperes: Repere[] }[]` — 8 jours du vendredi au vendredi.
  - `grilleDuMois(annee, mois, semaines): { date: string | null; semaine: S | null }[][]` — lignes lundi → dimanche.
  - `resumeDuMois(...)`: « 1 astreinte · 1 manœuvre · 1 férié ».
  - `reperesDe(...)` repris d'`Annee.svelte` (férié, vacances, manœuvre, fête, remplacement).
- Le chargement ajoute `remplacementsDe` (personne seulement) pour « À venir » et l'action `repondre` (gestes du mur) pour répondre à la manœuvre.

- [ ] Tests `vues.ts` : grille de novembre 2026 (premier lundi vide, semaines à cheval), résumé, jours de la semaine avec plages « 18 h – 6 h » et « 24 h », phrases.
- [ ] Rendu : en-tête vivant, carte pleine, À venir (manœuvre avec Présent/Absent/Incertain `aria-pressed`, fête, remplacements), puces `aria-current`, chaque vue (Semaine : flèches et « X remplace Y » ; Mois : numéro de semaine et équipe écrits ; Année : mois repliés sauf le courant, résumé, interrupteur « Seulement mes semaines » ; Équipes : chaque semaine nomme son équipe), années ‹ › discrètes, deux colonnes ≥ 1024 px.
- [ ] Chargement : vue par défaut, `?semaine`/`?mois` invalides → courants, action `repondre`.
- [ ] Budget `/planning` tenu.
- [ ] `pnpm test` vert ; commit ; push.

### Tâche 3 : Préparer l'année en 5 étapes

**Fichiers :**
- Créer : `apps/web/src/lib/planning/preparer.ts` (+ test) ; `Etapes.svelte` ; `FormulaireManoeuvre.svelte` (partagé avec la page `manoeuvre`) ; `Panneau.svelte` (feuille du bas / panneau latéral)
- Modifier : `routes/planning/preparer/+page.server.ts`, `+page.svelte`, `manoeuvre/+page.server.ts` (retour vers `&etape=manoeuvres`), `manoeuvre/+page.svelte`, tests

**Interfaces :**
- Adresse : `?annee=&etape=roulement|fetes|manoeuvres|reperes|publier` ; `&manoeuvre=nouvelle|<id>` ouvre le panneau ; `&semaine=<debut>` ouvre le choix d'équipe ; `&proposer=noel|nouvel_an` montre l'échange proposé. Les actions existantes gardent leur nom ; leur formulaire vise `?/<action>&annee=…&etape=…`.
- `preparer.ts` :
  - `ETAPES` (5, libellés « Roulement », « Fêtes », « Manœuvres », « Repères », « Vérifier et publier ») ; `etapeDe(url): Etape`.
  - `deplacer(ordre: number[], i: number, sens: -1 | 1): number[]`.
  - `echangePropose(semaines, fete, attendues, annee): { fete: SemaineCalculee; autre: SemaineCalculee } | null` — la semaine d'une équipe attendue la plus proche de celle de la fête, hors semaine de l'autre fête.
  - `recapitulatif(p: Preparation): string[]`.
- Roulement : boutons « Monter » / « Descendre » (formulaire `deplacer`, sans JS ; avec JS l'ordre change sur place), aperçu des 6 premières semaines recalculé (`calculerAnnee`).
- Publier : grille de semaines (bouton par semaine, « S12 · Équipe 3 »), choix d'équipe = un bouton par équipe postant `semaines`.

- [ ] Tests `preparer.ts` : `deplacer` aux bords, `echangePropose` (Noël hors tour → semaine voisine d'Équipe 3 ; rien si déjà dans le tour).
- [ ] Rendu : progression « Étape 2 sur 5 » avec `aria-current="step"`, Brouillon / Publiée à chaque étape, chaque étape, panneau de manœuvre, choix d'équipe, plus aucune des 52 listes déroulantes.
- [ ] Serveur : `deplacer` enregistre l'ordre ; accepter l'échange change deux semaines.
- [ ] `pnpm test` vert ; commit ; push.

### Tâche 4 : « Planning N à préparer », doc, e2e, captures

**Fichiers :**
- Modifier : `packages/socle/src/casquettes.ts` (`lireADecider` : à partir du 1er octobre, année suivante non publiée → `{ texte: 'Planning 2027 à préparer', lien: '/planning/preparer?annee=2027' }`) + test
- Modifier : `apps/web/e2e/planning.spec.ts`, `accessibilite.spec.ts` (nouvelles adresses : vues, étapes)
- Modifier : `docs/fonctionnel/planning-de-l-annee.md`, `docs/utilisation/voir-mon-planning.md`, `docs/utilisation/preparer-l-annee.md`

- [ ] Test socle : 30 sept. rien ; 1er oct. la rangée ; année suivante publiée → rien.
- [ ] e2e touchés en local (`--workers=1`).
- [ ] Captures 390 / 1280, clair / sombre (script hors dépôt), regardées, corrigées.
- [ ] `pnpm test`, `pnpm check` verts ; commit ; push.
