# Nature des rôles, carte d'un comité, icônes — plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** la nature (fonction ou mission) agit sur la vacance et le rangement ; la carte d'un comité sépare ses parties ; 12 icônes de plus.

**Architecture :** on lit `responsabilite.nature`, déjà en base. Pas de migration. Le socle expose la nature ; l'appli range et affiche.

**Tech Stack :** SvelteKit 2 / Svelte 5, drizzle + D1, vitest.

**Spec :** `docs/superpowers/specs/2026-11-17-nature-des-roles-design.md`

## Global Constraints

- Charte (`.claude/skills/charte-gyro/SKILL.md`) lue avant tout écran ; icônes à l'encre, sans couleur ni tuile.
- Français partout ; commentaires rares et courts ; TDD ; doc dans la même PR.
- Commandes : `export PATH="$HOME/.local/lib/node/bin:$PATH"` ; toujours `timeout 400 systemd-run --user --scope -q -p MemoryMax=1500M pnpm exec vitest run <fichiers>` ; un seul à la fois ; jamais Playwright en local.

## Review Focus

- Un rôle de nature « fonction » sans `systeme` (référent technique) : rangé avec les fonctions, vacance en alerte.
- Agent avec seulement des missions (ou seulement des fonctions) : pas d'intertitre « Fonctions »/« Missions » sur sa fiche.
- Comité sans membre, sans mur, sans bien : aucun intertitre vide ; « Aucun membre pour l'instant » reste.
- Icône inconnue enregistrée en base : `iconeDuRole` retombe comme aujourd'hui.
- Lecteurs d'écran : chaque nouvelle icône a son nom dans `NOMS_ICONES` (roles.ts).

---

### Task 1 : vacance selon la nature (socle + réglages)

**Files :** `packages/socle/src/casquettes.ts` (~l. 200, requête « hors système et hors comités » ; `sansTitulaire`), `packages/socle/test/casquettes.test.ts`, `apps/web/src/routes/reglages/ListeReglages.svelte`, `apps/web/src/routes/reglages/page.test.ts`.

- [ ] Test socle : une mission sans titulaire n'est plus dans les choses à traiter ; une fonction hors système sans titulaire (référent technique) y reste (`« Référent technique : aucun titulaire »`). Adapter le test existant `Référent habillement : aucun titulaire` (mission → absent).
- [ ] Code : filtrer `eq(responsabilite.nature, 'fonction')` dans la requête de `sansTitulaire`.
- [ ] Test réglages : « À pourvoir » en `--statut-alerte-fond` pour une fonction, en neutre pour une mission (`nature` dans le jeu d'essai `role()`).
- [ ] Code : `ton={r.nature === 'fonction' ? 'alerte' : 'neutre'}`. Tests au vert, commit.

### Task 2 : fonctions et missions séparées

**Files :** `packages/socle/src/qui-fait-quoi.ts` (+ son test), `apps/web/src/routes/comites/+page.svelte` (+ `page.test.ts`), `apps/web/src/routes/agents/[id]/+page.svelte` (+ test de la page ; `attributionsDe` doit rendre `responsabilite.nature`).

- [ ] Socle : `QuiFaitQuoi` gagne `nature: 'fonction' | 'mission'` sur `RoleTenu` et `equipes[]` ; `referents` est remplacé par `fonctions: RoleTenu[]` (centre, hors système, fonction) et `missions: RoleTenu[]` (centre, hors système, mission). Rôles de portée équipe autres que chef de garde : rangés selon leur nature. Test d'abord.
- [ ] « Comités et référents », colonne de droite : titre de section « Fonctions » (chef de centre et adjoint, chefs de garde, autres fonctions) puis « Missions » ; une partie vide n'apparaît pas. Test d'abord.
- [ ] Fiche d'un agent, bloc « Rôles » : fonctions puis missions, avec intertitres seulement si l'agent a les deux. Test d'abord. Commit.

### Task 3 : carte d'un comité en trois parties

**Files :** `apps/web/src/routes/comites/+page.svelte`, `page.test.ts`.

- [ ] Test : dans une carte, intertitres « Membres » puis lien du mur puis « À réserver », dans cet ordre ; aucun intertitre pour une partie vide.
- [ ] Code : intertitres dans la même carte (`ListeRangees`), sans nouvelle carte ; style par jetons d'`app.css`. Commit.

### Task 4 : 12 icônes de plus

**Files :** `packages/socle/src/icones.ts` (`NOMS_ICONES`), `apps/web/src/lib/ui/icones-roles.ts` (`ICONES_ROLES`), `apps/web/src/routes/reglages/roles.ts` (`NOMS_ICONES` lus), tests existants des icônes et de `ChoixIcone`.

- [ ] Test : les listes du socle, de l'appli et des noms lus ont les mêmes 26 clés ; noms : `barbecue` Barbecue, `musique` Musique, `sifflet` Sifflet, `trophee` Trophée, `calendrier` Calendrier, `secourisme` Secourisme, `photo` Appareil photo, `ordinateur` Ordinateur, `drapeau` Drapeau, `haltere` Haltère, `megaphone` Mégaphone, `euro` Euro.
- [ ] Tracés : grille 24 × 24, trait 1,8, même famille que les 14 actuels ; vérifier le rendu par une capture (ChoixIcone, téléphone clair). Commit.

### Task 5 : doc, vérification

- [ ] Doc : `docs/fonctionnel/acces-et-attributions.md` (nature, vacance, icônes), page « Comités et référents » dans `docs/fonctionnel/`, `docs/technique/socle.md` (`quiFaitQuoi`), `docs/technique/interface.md`, guide `docs/utilisation/creer-un-comite-ou-une-responsabilite.md` (que choisir : fonction ou mission).
- [ ] Types : `pnpm exec tsc --noEmit` (socle) et `pnpm exec svelte-check` (web), en cage mémoire. Tests touchés au vert. Commit, push.
