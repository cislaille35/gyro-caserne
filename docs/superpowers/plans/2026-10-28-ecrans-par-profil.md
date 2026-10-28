# Écrans par profil, étape 1 — plan de mise en œuvre

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Avec ce qui existe déjà : la navigation en quatre onglets et la cloche, les casquettes de l'accueil, les paquets de droits et les modèles, et la refonte de Réglages, Nominations, Agents et de la fiche.

**Architecture:** Les paquets sont une **présentation** des droits du socle (table domaine → niveaux, dans l'appli) ; aucun droit existant ne change. Le socle gagne deux colonnes optionnelles (`modele`, `icone`) sur `responsabilite`, une liste de modèles, une lecture des casquettes et la modification des droits d'un profil. Livré en **trois PR** successives : A (coquille, accueil), B (paquets, Réglages), C (Agents, fiche, Nominations).

**Tech Stack:** SvelteKit 3, Svelte 5, Drizzle (D1 / SQLite en test), Vitest, Playwright + axe (CI).

**Spec:** `docs/superpowers/specs/2026-10-27-ecrans-par-profil-design.md` (maquettes : `docs/superpowers/specs/2026-10-27-ecrans-par-profil/*.dc.html` ; en cas d'écart, la spec prime).

## Global Constraints

- **Aucun droit existant ne change** (profils et rôles du jeu de départ) ; migrations **additives seulement** (nouvelles colonnes nullables, aucune donnée transformée).
- Fondations de l'interface : jetons de `apps/web/src/app.css`, composants `#lib/ui`, téléphone d'abord et ordinateur à égalité, RGAA AA, jamais la couleur seule, cibles ≥ 44 px, vouvoiement, Gyro reste sur l'accueil, « réduire les animations » respecté.
- **Fond crème** : `--fond` clair `#f6f3ef` (sombre : inchangé `#11171f`), cartes `--surface` blanches, bord doux `--trait-doux: #e3ddd5` (sombre : `#2b3642`), rayons des cartes 16 px.
- **Pas de fausses données** : une page dont la fonction n'existe pas montre `Vide` avec une phrase vraie (« Le planning arrive bientôt. »).
- Urgent : orange `--statut-alerte-*` (à faire), rouge `--rouge` (bloquant), toujours avec un texte qui dit quoi faire.
- Libellés exacts : onglets « Accueil », « Planning », « Caserne », « Échanges » ; cloche « Notifications » ; « Moi » ; « Revenir au modèle » ; « Tout revenir » ; « Personnalisé » ; « Sur mesure » ; « Enregistrer ».
- Machine de 2 Go : cage et limite de temps, commit + push à chaque étape verte, Playwright en CI, PR en brouillon dès le premier push.

## Review Focus

1. Une personne avec un seul rôle ne voit pas la rangée de casquettes ; une personne qui en cumule quatre voit les quatre, sans débordement à 390 px (Tâche 3).
2. Un rôle dont les droits ne tombent sur aucun niveau (données existantes) affiche « Sur mesure » et ne perd aucun droit à l'enregistrement si on ne touche pas ce domaine (Tâches 5 et 6).
3. Le référent technique ouvre un rôle qui porte un droit de pouvoir : lecture seule, aucune case d'administration cochable, refus serveur si formulaire fabriqué (Tâche 6).
4. Navigation au clavier : groupes repliables, sélecteur à niveaux et barre d'actions utilisables au clavier et annoncés aux lecteurs d'écran (Tâches 1 et 6).
5. Un agent ordinaire ouvre `/reglages/...` ou `/caserne` par l'adresse : 403 sur Réglages, Caserne sans les entrées de gestion (Tâches 2 et 6).

---

## Partie A — coquille et accueil (branche `fonction/coquille-profils`, PR 1)

### Tâche 1 : Jetons chaleureux et composants communs

**Files:** `apps/web/src/app.css`, `apps/web/src/jetons.test.ts`, Create `apps/web/src/lib/ui/Groupe.svelte`, `Pastille.svelte`, `BarreActions.svelte`, `Initiales.svelte`, `IconeRole.svelte`, `icones-roles.ts` ; tests dans `apps/web/src/lib/ui/composants.test.ts` ; `docs/technique/interface.md`

**Interfaces (produces):**
- `Groupe.svelte` : props `{ titre: string; resume?: string; ouvert?: boolean (bindable, défaut false); niveauTitre?: 2 | 3; children: Snippet }` — bouton `aria-expanded` + `aria-controls`, chevron décoratif, contenu masqué (`hidden`) quand fermé.
- `Pastille.svelte` : props `{ ton: 'ok' | 'info' | 'alerte' | 'danger' | 'neutre'; children: Snippet }`.
- `BarreActions.svelte` : props `{ message?: string; children: Snippet }` — collée en bas (`position: sticky`), `message` dans un `role="status"`.
- `Initiales.svelte` : props `{ prenom: string; nom: string; taille?: number }` — rond décoratif (`aria-hidden`).
- `icones-roles.ts` : `export const ICONES_ROLES = { etoile, casque, camion, croix, cle, ballon, livre, groupe, coeur, outil } as const` (tracés SVG des maquettes) ; `export type IconeRole = keyof typeof ICONES_ROLES`.
- `IconeRole.svelte` : props `{ icone: IconeRole; taille?: number }` — tuile colorée décorative, couleur par icône (contrastes AA clair et sombre).

- [ ] **Step 1 : tests qui échouent** : jetons (`--fond` clair `#f6f3ef`, contraste AA de `--doux` sur `--fond` et de chaque couleur d'icône sur sa tuile, clair et sombre) ; `Groupe` fermé : contenu absent du flux accessible, `aria-expanded="false"`, ouverture au clic et à la touche Entrée ; `BarreActions` annonce son message ; `Pastille` rend son texte.
- [ ] **Step 2–4** : échecs, implémenter, tests + `check` en cage. **Step 5** : commit `Interface : jetons chaleureux et composants communs`, push, PR brouillon.

### Tâche 2 : Navigation en quatre onglets, cloche et « Moi »

**Files:** `apps/web/src/lib/ui/navigation.ts` (+ test), `Coquille.svelte` (+ `coquille.test.ts`), `apps/web/src/routes/+layout.server.ts`, `+layout.svelte` ; Create `routes/planning/+page.svelte`, `routes/echanges/+page.svelte`, `routes/notifications/+page.svelte`, `routes/moi/+page.svelte`, `routes/caserne/+page.server.ts`, `+page.svelte` (+ tests)

**Interfaces (produces):**
- `entreesNavigation(connecte: boolean): EntreeNavigation[]` → connecté : Accueil `/`, Planning `/planning`, Caserne `/caserne`, Échanges `/echanges` ; sinon Connexion, Affichage.
- En-tête de la coquille : lien « Notifications » (`/notifications`, icône cloche, `aria-label` avec le nombre quand il y en aura) et « Moi » (`/moi`).
- `aria-current="page"` sur l'onglet dont la page courante descend (`/agents/12` → Caserne ; `/reglages` → Caserne ; `/profil`, `/affichage` → Moi).
- `/caserne` : cartes « Agents » (tous), « Nominations » (si `peutNominations`), « Réglages » (si `peutReglages`) ; « Engins », « Comités » en `Vide` tant qu'absents.
- `/moi` : « Mon profil » (personne seulement), « Affichage », « Se déconnecter ».
- `/planning`, `/echanges`, `/notifications` : `Vide` avec une phrase vraie.

- [ ] **Step 1 : tests qui échouent** : `entreesNavigation(true)` = les 4 onglets dans l'ordre ; onglet actif pour `/agents/12` = Caserne ; `/caserne` d'un agent ordinaire sans Nominations ni Réglages, d'un chef de centre avec les deux ; `/moi` du super administrateur sans « Mon profil ».
- [ ] **Step 2–4** : échecs, implémenter, tests + `check` en cage. **Step 5** : commit `Interface : quatre onglets, cloche et Moi`, push.

### Tâche 3 : Les casquettes de l'accueil

**Files:** Create `packages/socle/src/casquettes.ts` (+ `packages/socle/test/casquettes.test.ts`), `index.ts` ; `apps/web/src/routes/+page.server.ts`, `+page.svelte` (+ tests), Create `apps/web/src/lib/ui/Casquettes.svelte`

**Interfaces (produces):**
- Create `packages/socle/src/icones.ts` : `export const NOMS_ICONES = ['etoile', 'casque', 'camion', 'croix', 'cle', 'ballon', 'livre', 'groupe', 'coeur', 'outil'] as const` ; un test de l'appli vérifie que les clés de `ICONES_ROLES` (Tâche 1) sont exactement `NOMS_ICONES`.
- `export type Casquette = { id: string; nom: string; icone: (typeof NOMS_ICONES)[number]; compte: number }` avec `id` = `'centre' | 'astreinte' | 'equipe:<equipeId>' | 'role:<responsabiliteId>' | 'comite:<comiteId>'`.
- `casquettesDe(base, acteur, aujourdhui): Promise<Casquette[]>` — « Le centre » pour chef de centre, adjoint et super administrateur ; « Mon astreinte » pour toute personne ; « Chef d'équipe · Équipe N » par attribution chef d'équipe en cours ; une par autre responsabilité en cours de portée centre (son nom) ; une par comité dont la personne est membre ou rapporteur (nom du comité). Ordre : centre, chef d'équipe, astreinte, référents, comités. `compte` : nombre d'éléments « À décider » de la casquette (0 si rien n'existe encore). Lectures groupées (≤ 50 requêtes).
- `aDecider(base, acteur, aujourdhui): Promise<{ texte: string; lien: string }[]>` pour « Le centre » : équipes actives sans chef d'équipe en cours, responsabilités non archivées sans titulaire (hors système), agents non partis sans grade ou sans date d'entrée (« N fiches à compléter »).
- Accueil `/` : `?casquette=<id>` choisit ; par défaut la première avec `compte > 0`, sinon la principale (centre, sinon chef d'équipe, sinon astreinte). Rangée affichée seulement si ≥ 2 casquettes (`Casquettes.svelte` : `role="tablist"`, compteur dans le libellé accessible). Contenu : « Le centre » → « À décider » + raccourcis Agents, Nominations, Réglages ; « Mon astreinte » et « Chef d'équipe » → `Vide` (« Votre astreinte s'affichera ici avec le planning. ») ; rôle → ce que le rôle permet (paquets en phrases) ; comité → membres et rapporteur. Gyro et « Bonjour » restent en tête.

- [ ] **Step 1 : tests qui échouent** : agent sans rôle → `[astreinte]` et pas de rangée ; chef de centre → centre en premier ; personne chef d'équipe + référent pharmacie + membre de l'Amicale → 4 casquettes dans l'ordre ; attribution passée ou comité dissous → absent ; `aDecider` : équipe sans chef, rôle sans titulaire, fiche sans grade ; requêtes ≤ 50 pour 150 agents ; accueil choisit la casquette par défaut selon les comptes.
- [ ] **Step 2–4** : échecs, implémenter, tests socle + appli + `check` en cage. **Step 5** : commit `Accueil : les casquettes`, push.

### Tâche 4 : Partie A — accessibilité, parcours, doc, PR

**Files:** `apps/web/e2e/accessibilite.spec.ts`, `docs/technique/interface.md`, `docs/utilisation/` (aide « Comment passer d'un rôle à l'autre ? »)

- [ ] **Step 1** : axe aux deux tailles et deux thèmes sur `/`, `/caserne`, `/moi`, `/planning`, `/echanges`, `/notifications` ; clavier : ouvrir un `Groupe`, changer de casquette ; « réduire les animations » respecté.
- [ ] **Step 2** : pousser, CI verte. **Step 3** : relecture, compte rendu, PR prête pour le porteur.

## Partie B — paquets de droits et Réglages (branche `fonction/paquets-droits`, PR 2)

### Tâche 5 : Socle — modèles, icône, droits d'un profil

**Files:** `packages/socle/src/schema.ts` + migration générée (`pnpm migrations`), Create `packages/socle/src/modeles.ts`, `packages/socle/src/actions/responsabilites.ts`, Create `packages/socle/src/actions/profils.ts`, tests, `index.ts`

**Interfaces (produces):**
- Colonnes nullables `responsabilite.modele text`, `responsabilite.icone text` (migration additive, aucune mise à jour de lignes).
- `export const MODELES: { id: string; nom: string; nature: 'fonction' | 'mission'; portee: 'centre' | 'equipe' | 'comite'; icone: string; droits: Droit[] }[]` — au moins : `referent_materiel` (« Référent matériel », mission, centre, `camion`, `TRAITER_ANOMALIE` + `GERER_FICHES`), `referent_pharmacie` (« Référent pharmacie », mission, centre, `croix`, `GERER_STOCK`), `referent_technique` (« Référent technique », fonction, centre, `cle`, `GERER_LISTES` + `GERER_COMITES`), `membre_comite` (mission, comite, `groupe`, aucun), `rapporteur_comite` (mission, comite, `livre`, `ATTRIBUER_RESPONSABILITE`), `vierge` (« Vierge », mission, centre, `outil`, aucun).
- `creerResponsabilite(..., donnees & { modele?: string; icone?: string })` : `modele` inconnu → `DonneeInvalide('Modèle inconnu')` ; `icone` hors `NOMS_ICONES` (Tâche 3) → `DonneeInvalide('Icône inconnue')`. `modifierResponsabilite` accepte `icone`. `listerResponsabilites` renvoie `modele: string | null`, `icone: string | null`.
- `listerProfils(base, acteur, aujourdhui)` et `modifierDroitsProfil(base, acteur, profilId, droits: Droit[], aujourdhui)` : réservé au chef de centre, à l'adjoint et au super administrateur (`GERER_ACCES` sur le centre ou super) ; droits de pouvoir refusés sur un profil (`DonneeInvalide('Un profil ne donne pas de droit de pouvoir')`) ; journal `modifier_droits_profil` ; périmètre centre.

- [ ] **Step 1 : tests qui échouent** : création depuis un modèle garde `modele` ; icône inconnue refusée ; responsabilités existantes ont `modele` et `icone` nuls après migration (base de test) ; profil : chef de centre modifie, référent technique refusé, droit de pouvoir refusé, journal écrit.
- [ ] **Step 2–4** : échecs, implémenter, tests + `tsc` en cage. **Step 5** : commit `Socle : modèles, icônes et droits des profils`, push, PR brouillon.

### Tâche 6 : Paquets de droits et pages de Réglages

**Files:** Create `apps/web/src/lib/paquets.ts` (+ test) ; `apps/web/src/lib/droits.ts` (libellé `GERER_FICHES` : « Gérer les fiches de prise de garde ») ; `apps/web/src/routes/reglages/+page.server.ts`, `+page.svelte` (liste par thème), Create `routes/reglages/roles/[id]/+page.server.ts`, `+page.svelte`, `routes/reglages/roles/nouveau/…`, `routes/reglages/profils/[id]/…`, `routes/reglages/comites/…` ; Create `apps/web/src/lib/ui/SelecteurNiveaux.svelte` ; tests ; `apps/web/src/lib/server/formulaire-reglages.ts`

**Interfaces:**
- Consumes : Tâche 5 ; composants de la Tâche 1.
- Produces (`paquets.ts`) :
  - `DOMAINES: { id: 'planning' | 'engins' | 'stock' | 'reservations' | 'messagerie'; nom: string; niveaux: { libelle: string; droits: Droit[]; phrase: string }[] }[]` — exactement le tableau de la spec (cumulatif : le niveau n contient les droits des niveaux < n) ; `ADMINISTRATION: { droit: Droit; libelle: string }[]` (4 cases).
  - `niveauxDe(droits: Droit[]): Record<DomaineId, number | 'sur_mesure'>` — plus haut niveau exactement couvert ; `'sur_mesure'` si les droits du domaine ne correspondent à aucun niveau.
  - `appliquerNiveaux(droits: Droit[], choix: Partial<Record<DomaineId, number>>): Droit[]` — remplace les droits des seuls domaines choisis, garde tous les autres droits (salons, administration, sur mesure non touchés).
  - `estPersonnalise(droits: Droit[], modele: string | null): boolean`.
- `/reglages` : groupes repliables « Chef de centre et adjoint » (rôles `chef_centre`, `chef_centre_adjoint`), « Chefs d'équipe » (portée équipe), « Référents » (portée centre, hors système), « Comités » (comités non dissous, leurs membres et rapporteur), « Profils » (Agent, Réserve citoyenne…) ; chaque ligne : `IconeRole` (icône du rôle, sinon celle de son modèle, sinon par thème), nom, résumé (titulaires, « Aucun titulaire » en `Pastille ton="alerte"`, « Personnalisé ») ; « + Nouveau rôle » ; archivés repliés.
- `/reglages/roles/nouveau` : choisir un modèle (cartes), puis nom, portée (préremplie), qui attribue ; création avec les droits du modèle.
- `/reglages/roles/[id]` : en-tête (icône, nom, portée, qui attribue, pastilles « Modèle : … » et « Personnalisé ») ; un `Groupe` par domaine (résumé = niveau ; `SelecteurNiveaux` = groupe de boutons radio) avec « Revenir au modèle » quand le domaine diffère ; « Administration de l'appli » à part (cases cochables seulement si l'acteur gère le pouvoir) ; « Détail droit par droit » replié ; `BarreActions` « Enregistrer » / « Tout revenir » avec « N domaine(s) modifié(s), pas encore enregistré(s) ». Rôle système : tout en lecture seule. Sur ordinateur (≥ 1024 px) : liste et page côte à côte, domaines en deux colonnes. Fonctionne sans JavaScript (formulaire classique) ; le message « non enregistré » est un plus avec JavaScript.
- `/reglages/profils/[id]` : même page, domaines seulement, base = rien ; enregistrement par `modifierDroitsProfil`.

- [ ] **Step 1 : tests qui échouent** : `niveauxDe` pour chaque rôle du jeu de départ (chef d'équipe → planning « Valider les remplacements », référent engins → engins « Gérer », chef de centre → planning « Sur mesure »…) ; `appliquerNiveaux` ne touche pas les autres domaines ni les droits de salon ; enregistrement d'un rôle « Sur mesure » sans toucher le domaine → droits inchangés (Review Focus 2) ; référent technique sur un rôle à droit de pouvoir → lecture seule + refus serveur (Review Focus 3) ; agent ordinaire → 403 ; création depuis `referent_pharmacie` ; « Revenir au modèle » rend les droits du modèle.
- [ ] **Step 2–4** : échecs, implémenter, tests + `check` en cage. **Step 5** : commit `Réglages : paquets de droits, modèles et rôles par thème`, push.

### Tâche 7 : Partie B — accessibilité, parcours, doc, PR

**Files:** `apps/web/e2e/accessibilite.spec.ts`, `docs/fonctionnel/acces-et-attributions.md`, `docs/technique/socle.md`, `docs/technique/interface.md`, `docs/utilisation/creer-un-comite-ou-une-responsabilite.md`

- [ ] **Step 1** : axe aux deux tailles et deux thèmes sur `/reglages`, `/reglages/roles/nouveau`, `/reglages/roles/[id]`, `/reglages/profils/[id]` ; parcours super : créer « Référent pharmacie » depuis le modèle, passer Stock à « Rien de plus », voir « Personnalisé », « Revenir au modèle », enregistrer ; clavier sur le sélecteur à niveaux (Review Focus 4).
- [ ] **Step 2** : pousser, CI verte. **Step 3** : relecture, compte rendu, PR.

## Partie C — Agents, fiche et Nominations (branche `fonction/ecrans-gestion`, PR 3)

### Tâche 8 : La liste des agents par équipe

**Files:** `apps/web/src/routes/agents/+layout.server.ts`, `+layout.svelte`, `+page.svelte`, tests ; `packages/socle/src/effectif.ts` si une lecture manque (chef d'équipe en cours par équipe, fiche incomplète)

**Interfaces:** gestionnaires : `Groupe` par équipe active (liseré de la couleur de l'équipe, résumé « 8 agents · chef : A. Martin » ou « sans chef d'équipe » en alerte), puis « Sans équipe », « Extérieurs », « Partis » (replié) ; ligne : `Initiales`, nom, grade, `Statut` seulement hors « opérationnel », rôles en cours en petit ; filtres en pastilles (`aria-pressed`) : Tous, À compléter (sans grade ou sans date d'entrée), Indisponibles (statut ni opérationnel ni parti), Partis ; recherche gardée. Vue de tous (non-gestionnaires) : même présentation, sans statut ni filtres de gestion (règles du lot 1 inchangées).

- [ ] **Step 1 : tests qui échouent** : groupes et résumés ; filtre « À compléter » ; agent ordinaire ne voit ni statut ni e-mail ; chef d'équipe absent → résumé en alerte.
- [ ] **Step 2–4**, **Step 5** : commit `Agents : liste par équipe et filtres`, push, PR brouillon.

### Tâche 9 : La fiche d'un agent en blocs

**Files:** `apps/web/src/routes/agents/[id]/+page.svelte` (+ tests) ; le serveur et ses actions ne changent pas

**Interfaces:** en-tête (`Initiales`, nom, grade, équipe, `Statut`, rôles en cours avec `IconeRole`, « Appeler » `tel:` si téléphone, « Écrire » `mailto:`) ; `Groupe` « Identité et contact », « Parcours », « Équipe et statut », « Rôles » (la carte du lot 3), « Départ du centre » (bord rouge) — résumé visible fermé ; le bloc qui porte une erreur de formulaire s'ouvre seul ; les formulaires et confirmations existants gardés.

- [ ] **Step 1 : tests qui échouent** : résumés fermés ; erreur sur l'e-mail → « Identité et contact » ouvert ; pas de lien « Appeler » sans téléphone.
- [ ] **Step 2–4**, **Step 5** : commit `Agents : la fiche en blocs`, push.

### Tâche 10 : Nominations en cartes

**Files:** `apps/web/src/routes/nominations/+page.svelte` (+ tests) ; le serveur et ses actions ne changent pas

**Interfaces:** une carte par rôle (icône, nom, périmètre) ; titulaires en pastilles avec bouton « Retirer <nom> » (= action `?/terminer`, avec confirmation) ; « Aucun titulaire » en alerte ; « Nommer » ouvre un panneau (élément `<dialog>` ou section dépliée, focus géré) : agent, périmètre si besoin, début aujourd'hui par défaut, « changer les dates » replié ; recherche d'un rôle ou d'un agent.

- [ ] **Step 1 : tests qui échouent** : pastilles et bouton « Retirer » nommé ; rôle sans titulaire ; panneau : champs et date par défaut ; erreurs serveur affichées dans le panneau.
- [ ] **Step 2–4**, **Step 5** : commit `Nominations : cartes et panneau Nommer`, push.

### Tâche 11 : Partie C — accessibilité, parcours, doc, PR

**Files:** `apps/web/e2e/accessibilite.spec.ts`, `docs/fonctionnel/fiche-agent.md`, `docs/utilisation/` (aides touchées), `docs/fonctionnel/README.md` (ne plus dire « Aucune fonction n'est encore livrée »)

- [ ] **Step 1** : axe aux deux tailles et deux thèmes sur `/agents`, `/agents/[id]`, `/nominations` ; parcours : filtrer « À compléter », ouvrir une fiche, nommer puis retirer depuis Nominations ; clavier dans le panneau Nommer.
- [ ] **Step 2** : pousser, CI verte. **Step 3** : relecture, compte rendu, PR.
