# Notifications des chefs — plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** urgences au téléphone des chefs, suivi du centre lu dans le journal, « Modifié par… », nomination prévenue, e-mail au référent.

**Architecture :** tout passe par l'existant : `ligneJournal` (packages/socle/src/journal.ts), `mettreEnFile` et `enTeteDe` (notifications.ts), `envoyerCourriel` (apps/web/src/lib/server/courriel.ts), le réveil (apps/web/src/planifie.ts). Une migration additive au plus (dernière visite du suivi, coupure e-mail).

**Tech Stack :** SvelteKit 2 / Svelte 5, drizzle + D1, vitest.

**Spec :** `docs/superpowers/specs/2026-11-19-notifications-des-chefs-design.md`

## Global Constraints

- Lire CLAUDE.md et `.claude/skills/charte-gyro/SKILL.md` avant tout écran. Français partout, TDD, doc dans la même PR.
- **Calcul** : aucune requête de plus sur une page ordinaire. Les envois partent dans le batch de l'action ou au réveil. Le compteur du suivi tient dans le batch d'`enTeteDe`. Les tests de budget (requêtes comptées) restent verts sans relever les plafonds ; le réveil est mesuré au banc existant avant et après (chiffres dans la PR).
- Destinataires des urgences : chef de centre et adjoint en fonction, sauf l'auteur du geste ; lieu de coupure `urgences` ; « tout » le coupe aussi.
- Migration : `drizzle-kit generate` (ou `--custom`), additive, testée comme `test/migration-0028.test.ts`.
- Machine : `export PATH="$HOME/.local/lib/node/bin:$PATH"` ; `timeout 400 systemd-run --user --scope -q -p MemoryMax=1500M pnpm exec vitest run <fichiers>`, un à la fois ; jamais Playwright ni la suite complète en local ; svelte-check une fois à la fin (`NODE_OPTIONS=--max-old-space-size=1350`).

## Review Focus

- Chef qui fait lui-même le geste (rend l'engin indisponible, nomme) : il ne reçoit ni urgence ni ligne de suivi pour son propre geste.
- Aucun référent nommé (habillement, anomalies, ressource gérée par personne) : le chef et l'adjoint restent prévenus au téléphone et par e-mail, comme aujourd'hui.
- Destinataire sans adresse valide ou envoi Brevo en échec : la demande est créée quand même, rien ne remonte à l'agent.
- Import du fichier de l'effectif ou du planning : aucune notification de nomination, aucune rafale.
- Agent effacé ou parti cité dans le journal : le suivi affiche « Ancien agent », sans erreur.

---

### Task 1 : l'appli signe « Planning », « Modifiée par… »

**Files :** `packages/socle/src/actions/publications.ts:~280`, `notifications.ts:~352`, `planning/manoeuvres.ts` (`manoeuvreChangee`), `apps/web/src/lib/ui/Publication.svelte`, `apps/web/src/routes/notifications/+page.svelte`, leurs tests.

- [ ] Test : une publication d'auteur `planning` rend l'icône calendrier et « Planning », jamais un `Visage` ; idem dans la cloche.
- [ ] Test : après `manoeuvreChangee(base, id, maintenant, par)` la publication porte « Modifiée par Claire Martin, le 18/11 à 19 h 02 » et la notification « Manœuvre modifiée par Claire Martin : Feux » (« annulée par » pour une annulation).
- [ ] Code : `manoeuvreChangee` gagne `par: Acteur` ; les appels (planning/preparer/manoeuvre, fichier/appliquer) le passent ; journal `modifier_manoeuvre` / `annuler_manoeuvre`. Le nom affiché vient de ce journal, lu dans la requête de la publication. Commit.

### Task 2 : journal complété et page « Suivi du centre »

**Files :** créer `packages/socle/src/suivi.ts` (+ `test/suivi.test.ts`), `apps/web/src/routes/suivi/+page.server.ts|svelte` (+ tests), `notifications.ts` (`enTeteDe`, `filDeNotifications`), `schema.ts` + migration.

**Interfaces :**
- Produces : `ACTIONS_SUIVI: readonly string[]` ; `suiviDuCentre(base, acteur, aujourdhui, { avant?: number }): Promise<{ lignes: LigneSuivi[]; suite: number | null }>` (25 lignes par page) ; `LigneSuivi = { id: number; quand: string; qui: string; phrase: string; lien: string | null }` ; `marquerSuiviVu(base, acteur, maintenant)` ; `enTeteDe` renvoie en plus `suivi: number` (nouveautés, 0 hors chefs).

- [ ] Test : `ACTIONS_SUIVI` contient exactement la liste de la spec (planning et manœuvres, nominations et retraits, réglages, fiches des agents, décisions sur les demandes, remplacements validés) et exclut `creer_conversation`, `modifier_mon_profil`, `publier`, `reserver`, `supprimer_commentaire`.
- [ ] Test : `suiviDuCentre` refuse tout autre que chef de centre, adjoint, super administrateur (`RefusDroit`) ; ordonne du plus récent ; une phrase par action, avec le nom de l'auteur ; « Ancien agent » pour un agent effacé.
- [ ] Test : `enTeteDe` compte les lignes du suivi plus récentes que la dernière visite, hors celles de l'acteur, **sans requête de plus** (test de budget existant).
- [ ] Code : journal ajouté là où il manque (habillement : prise, traitement, refus, livraison ; anomalies : signalée, indisponible, remise en service, close ; remplacements : validé, refusé par le chef ; planning de l'année : publier, modifier). Dernière visite : colonne `suivi_vu_le` sur `personne` (super administrateur : pas de compteur). Ligne de cloche « Suivi du centre : N nouveautés depuis votre dernière visite » vers `/suivi`, sans envoi au téléphone. Entrée « Suivi du centre » dans Caserne pour les chefs. Commit.

### Task 3 : les chefs ne reçoivent plus les demandes d'un référent nommé

**Files :** `anomalies-avis.ts` (`quiTraite`), `habillement.ts` (destinataires ~l. 53), `reservations.ts` (gestionnaires ~l. 59), tests.

- [ ] Test, par sujet : avec un référent nommé, le chef et l'adjoint ne sont plus destinataires d'envoi au téléphone ; sans référent, ils le restent. Le chef de garde reste prévenu des anomalies comme aujourd'hui.
- [ ] Code : retirer chef et adjoint des destinataires quand au moins un référent nommé (rôle hors système tenant le droit, ou gestionnaire de la ressource) existe. Même lecture, pas de requête de plus. Commit.

### Task 4 : urgences

**Files :** `notifications.ts` (lieu `urgences`), `anomalies.ts` (passage à indisponible), `prises.ts`, fiche d'un engin (`engins.ts`), `remplacements/moment.ts` (relance de la veille), créer `packages/socle/src/urgences.ts` (+ test), `apps/web/src/planifie.ts`, `apps/web/src/routes/moi/notifications/*`.

**Interfaces :**
- Produces : `avisUrgence(base, ids: number[] | SQLWrapper, donnees: DonneesPush, maintenant, si?)` (écritures pour un batch, lieu `urgences`) ; `chefsDuCentre(base, aujourdhui)` (sous-requête des chef et adjoint en fonction) ; `equipeSansChefDemain(base, maintenant): Promise<number>` (appelée au réveil, une alerte par relève).

- [ ] Tests : engin rendu indisponible (anomalie, prise de garde, fiche) → urgence « <engin> indisponible » au chef et à l'adjoint, sauf l'auteur, lien vers l'engin ; relance de la veille → aussi au chef et à l'adjoint ; la veille de la relève à 8 h, équipe d'astreinte sans chef de garde en cours → urgence « <équipe> sans chef de garde demain », une seule fois (marque posée) ; `tout` ou `urgences` coupés → rien n'est mis en file.
- [ ] Test de budget du réveil : sans rien à signaler, aucune requête de plus qu'avant (le calcul d'astreinte n'est lu que la veille de la relève après 8 h).
- [ ] Code + « Mes notifications » : « Urgences du centre » en premier pour les chefs, avec sa phrase ; si « tout » est coupé : « Vous ne recevrez plus les urgences du centre (engin indisponible…) ». Commit.

### Task 5 : nomination prévenue

**Files :** `actions/attributions.ts` (`attribuer`, `terminer`/`finir`), `notifications.ts`, tests.

- [ ] Test : `attribuer` (fiche, Nominations) → l'agent nommé reçoit « Vous êtes nommé <rôle> » (+ périmètre) au téléphone et dans la cloche ; l'import du fichier de l'effectif ne l'envoie pas ; un retrait ne prévient pas l'agent ; nomination et retrait apparaissent dans le suivi (Task 2).
- [ ] Code : écriture dans le batch d'`attribuer` ; lieu `nominations`. Commit.

### Task 6 : e-mail au référent

**Files :** `apps/web/src/lib/server/courriel.ts`, créer `apps/web/src/lib/server/courriel-demandes.ts` (+ test), les routes qui créent une demande d'habillement, de réservation à valider, une anomalie (et la prise de garde), `moi/notifications`, schéma (coupure e-mail : une ligne de `coupure` avec le lieu `courriel`, sans migration si la table le permet).

**Interfaces :**
- Produces : `envoyerDemandeParCourriel(env, base, ids: number[], m: { titre: string; texte: string; url: string })` : lit adresses et coupures en une requête, envoie après la réponse (`enArrierePlan`), n'échoue jamais.

- [ ] Tests : un e-mail par destinataire de la notification (Task 3 appliquée), texte simple « titre, deux lignes, lien absolu » ; coupure `courriel` respectée ; échec Brevo journalisé (`resumeErreur`) sans faire échouer la demande ; pas d'e-mail pour la suite d'une demande.
- [ ] Code : « Recevoir les demandes par e-mail » dans « Mes notifications », coché par défaut, pour qui gère quelque chose. Commit.

### Task 7 : doc, mesure, vérification

- [ ] Doc : `docs/fonctionnel/notifications.md` (urgences, suivi, chefs et référents, e-mail), `acces-et-attributions.md` (nomination), `salons.md` (Planning, Modifiée par), `docs/technique/socle.md` et `interface.md`, guide `docs/utilisation/` « Recevoir les urgences du centre » ; décision `docs/decisions/0038-notifications-des-chefs.md` (choix A suivi, A e-mail, retrait des chefs, tout coupe les urgences).
- [ ] Banc du réveil et de l'en-tête avant/après ; chiffres dans le compte rendu.
- [ ] `tsc` (socle), `svelte-check` (web) à 0 ; tests touchés verts ; push.
