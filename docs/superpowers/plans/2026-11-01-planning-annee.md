# Planning de l'année : plan d'exécution

> **Pour les sous-agents :** sous-skill requis, superpowers:executing-plans (ou subagent-driven-development). Les étapes sont des cases à cocher (`- [ ]`).

**But :** le chef saisit l'année (roulement, semaines, manœuvres, fêtes, vacances) et la publie ; chaque agent lit son année dans l'onglet Planning et l'ajoute une fois à son agenda ; les manœuvres s'annoncent seules sur « Le centre ».

**Architecture :**
- **Calculs purs** (`packages/socle/src/planning/calendrier.ts`) : fériés, semaines d'une année, équipe de chaque semaine, périodes d'astreinte aux vraies heures, équipe de Noël et du Nouvel An, tour des fêtes. Aucune requête.
- **Données** (`packages/socle/src/planning/annee.ts`) : tables de l'année, actions du chef (droit `GERER_PLANNING`), lecture d'une année pour l'agent (droit `VOIR_PLANNING`), équipe de l'agent **à la date** de chaque semaine.
- **Manœuvres** (`packages/socle/src/planning/manoeuvres.ts`) : publication événement + sondage dans **la même publication** (le modèle le permet), auteur `planning` (« Planning du centre »), notifications aux **convoqués** seulement ; tâche de nuit existante (`planifie.ts`).
- **Agenda** (`packages/socle/src/planning/agenda.ts`) : fichier iCalendar (heures en UTC), clé secrète par agent ; route `/agenda/[fichier]`.
- **Appli** : `/planning` (agent), `/planning/preparer` (chef), `/moi/agenda`.

**Technos :** SvelteKit 3, Svelte 5, Drizzle sur D1, Vitest, Playwright et axe. Aucune dépendance ajoutée.

**Spec :** [`docs/superpowers/specs/2026-11-01-planning-annee-design.md`](../specs/2026-11-01-planning-annee-design.md).

## Contraintes globales

- `CLAUDE.md` : français, TDD, code simple, commentaires rares, rien de propre à un centre dans le code (réglages dans `centres/<id>/centre.ts`).
- Migrations **additives** (`pnpm --filter @gyro-caserne/socle migrations`), une seule : `0012` (la `0011` est celle des réservations).
- Heure de Paris partout : dates `AAAA-MM-JJ`, moments `AAAA-MM-JJTHH:MM` (comparables comme textes). UTC seulement dans le fichier d'agenda.
- Année **civile** ; une semaine appartient à l'année où elle **commence** (jour de relève).
- Budget : 45 requêtes D1 par page (`routes/budget.test.ts`, nouvelles pages ajoutées) ; D1 : 100 paramètres liés au plus.
- Lien d'agenda : clé aléatoire de 32 octets (base64url), jamais journalisée, comparée en temps constant ; refusé pour un agent sans accès (parti, suspendu).
- Téléphone d'abord, soigné à 1280, clair et sombre, AA ; l'astreinte de l'agent est dite en **texte** (« Mon astreinte ») en plus de la couleur.
- Données fictives seulement (jeu de départ local : 4 équipes, une année publiée, quelques manœuvres).

## Décisions de construction (à valider par le porteur)

1. **Horaires** : nouveau réglage `astreinte.semaine = { debut: '18:00', fin: '06:00' }` ; sans lui, l'astreinte est continue. Samedi, dimanche et fériés : 24 h sur 24. Laillé passe de 17 h 30 à **18 h** (spec). Le centre `exemple` prend 4 équipes et le rythme de Laillé.
2. **Jour de relève férié ou de week-end** : l'équipe sortante reste jusqu'à l'heure de relève (sinon la journée ne serait tenue par personne).
3. **Noël** = équipe d'astreinte le 25 décembre à 12 h ; **Nouvel An** = le 31 décembre à 23 h.
4. **Tour des fêtes** : l'équipe attendue est celle qui a tenu la fête il y a le plus longtemps (ou jamais) ; sinon un avertissement, sans blocage. Historique : saisi par le chef, complété par les années déjà dans l'appli.
5. **Fériés** : les 11 fériés nationaux (pas ceux d'Alsace-Moselle).
6. **Sondage petit-déjeuner** : ferme le vendredi précédant la manœuvre à **18 h** ; si ce moment est passé, au début de la manœuvre.
7. **Relance** : le mercredi précédant la manœuvre d'au moins 2 jours, une seule fois, aux convoqués sans réponse ; rattrapée la nuit suivante si une nuit a sauté ; jamais si la manœuvre a été publiée le jour même.
8. **Modifier ou annuler** une manœuvre déjà publiée met à jour la publication **tout de suite** (pas à la nuit) et prévient les convoqués. Une manœuvre non publiée est simplement supprimée.
9. **Clé d'agenda** gardée en clair (il faut pouvoir réafficher le lien) ; seule la comparaison est protégée.
10. Voir le planning demande `VOIR_PLANNING` (déjà donné au profil Agent).

## Revue : à surveiller

1. Changement d'heure (fin mars, fin octobre) : une période de nuit à cheval reste juste en heure de Paris et en UTC dans l'agenda (test dans la tâche 3).
2. Agent qui change d'équipe en cours d'année : ses semaines suivent l'affectation **à la date** de la relève (test tâche 1).
3. Année sans roulement ou non publiée : l'agent voit le vide soigné, l'agenda ne contient rien de cette année, la nuit ne publie rien (tests tâches 1, 3, 4).
4. Manœuvre modifiée puis annulée après publication : une seule publication, mise à jour, marquée « Annulée » ; la nuit ne la republie pas (test tâche 4).
5. Lien d'agenda deviné, changé ou d'un agent parti : 404 sans détail (test tâche 3).

---

### Tâche 1 : socle du planning (calculs, tables, actions)

**Fichiers :**
- Modifier : `packages/centre/src/index.ts` (+ test), `centres/laille/centre.ts`, `centres/exemple/centre.ts`
- Créer : `packages/socle/src/planning/calendrier.ts`, `packages/socle/src/planning/annee.ts`, `packages/socle/test/planning-calendrier.test.ts`, `packages/socle/test/planning-annee.test.ts`
- Modifier : `packages/socle/src/schema.ts`, `packages/socle/migrations/0012_*.sql` (générée), `packages/socle/src/index.ts`, `apps/web/src/routes/echanges/**/page.server.test.ts` (4 équipes)

**Réglage du centre :** `astreinte.semaine?: { debut: 'HH:MM'; fin: 'HH:MM' }`, validé par `erreursCentre`.

**Tables :**
- `annee_planning` : `annee` (clé), `ordre` (JSON, ids d'équipes, la première tient la première semaine), `publiee_le` (nul tant que non publiée).
- `semaine_changee` : `debut` (date de relève, clé), `equipe_id` → equipe.
- `manoeuvre` : `id`, `debut` (`AAAA-MM-JJTHH:MM`), `theme`, `lieu`, `convoques` (JSON `"tous"` ou ids), `petit_dejeuner` (0/1), `annulee_le`, `publication_id` → publication (`set null`), `relance_le`.
- `vacances_scolaires` : `id`, `nom`, `debut`, `fin`.
- `garde_fete` : `annee`, `fete` (`noel` | `nouvel_an`), `equipe_id` ; clé (annee, fete).
- `cle_agenda` : `personne_id` (clé) → personne, `cle`, `cree_le`.
- `publication.annulee_le` (nouvelle colonne nulle).

**Interfaces (produites) :**
- `feries(annee: number): { date: string; nom: string }[]`
- `type Reglage = Centre['astreinte']`
- `semainesDe(annee, reglage): { debut: string; numero: number }[]` — relèves de l'année ; `numero` = semaine ISO du jour de relève.
- `equipeDeLaSemaine(i: number, debut: string, ordre: number[], changees: Map<string, number>): number`
- `periodesDeLaSemaine(debut: string, reglage, feriesDates: Set<string>): { debut: string; fin: string }[]` — moments Paris, fusionnées.
- `equipeA(moment: string, semaines: SemaineCalculee[]): number | null` avec `SemaineCalculee = { debut; numero; equipeId; periodes }`.
- `fetes(annee, semaines): { noel: number | null; nouvelAn: number | null }`
- `tourDesFetes(historique: { annee; fete; equipeId }[], equipes: number[], annee): { noel: number[]; nouvelAn: number[] }` — équipes attendues.
- `preparerAnnee(base, acteur, annee, aujourdhui)` → `{ annee, publiee, ordre, semaines, manoeuvres, vacances, feries, fetes: { noel, nouvelAn, attendues, historique }, equipes }` (droit `GERER_PLANNING`).
- Actions (droit `GERER_PLANNING`, une ligne de journal chacune) : `reglerRoulement(base, acteur, annee, ordre: number[], maintenant)`, `changerSemaines(base, acteur, annee, choix: Record<string, number>, maintenant)` (ne garde que les écarts au roulement), `enregistrerManoeuvre(base, acteur, donnees: { id?; debut; theme; lieu; convoques; petitDejeuner }, maintenant): Promise<number>`, `supprimerManoeuvre(base, acteur, id, maintenant)`, `ajouterVacances` / `retirerVacances`, `noterFete(base, acteur, annee, fete, equipeId | null, maintenant)`, `publierAnnee(base, acteur, annee, maintenant)`.
- `planningDe(base, acteur, annee, maintenant, reglage)` → `{ publiee: false } | { publiee: true, annee, equipes, semaines: (SemaineCalculee & { mienne: boolean })[], manoeuvres, vacances, feries, fetes, monEquipe: number | null, prochaine: { astreinte, manoeuvre, fete } }` (droit `VOIR_PLANNING`).

- [ ] **Étape 1 : tests d'abord** — `planning-calendrier.test.ts` : fériés 2026 (Pâques le 5 avril, lundi 6 avril, Ascension 14 mai, Pentecôte 25 mai) ; 2027 commence le vendredi 1ᵉʳ janvier ; périodes d'une semaine ordinaire (vendredi 18 h → lundi 6 h, puis lundi, mardi, mercredi, jeudi 18 h → 6 h) ; jeudi férié (mercredi 18 h → vendredi 6 h d'un tenant) ; vendredi 25 décembre 2026 : la semaine sortante va jusqu'à 18 h, Noël = son équipe ; réglage sans `semaine` : une seule période ; tour des fêtes (jamais tenue = attendue). `planning-annee.test.ts` : un agent sans `GERER_PLANNING` est refusé ; roulement + changement d'une semaine ; agent qui change d'équipe le 1ᵉʳ juillet ; non publiée = `{ publiee: false }` pour l'agent ; prochaine astreinte et prochaine manœuvre ; agent sans équipe : `monEquipe` nul.
- [ ] **Étape 2 :** `pnpm --filter @gyro-caserne/socle test` échoue.
- [ ] **Étape 3 :** code, migration générée, export dans `index.ts`, centres mis à jour.
- [ ] **Étape 4 :** `pnpm test` vert.
- [ ] **Étape 5 :** commit « Planning : socle de l'année » + push.

### Tâche 2 : écrans (Préparer l'année, onglet Planning)

**Fichiers :**
- Créer : `apps/web/src/routes/planning/preparer/+page.server.ts`, `+page.svelte`, `planning/preparer/manoeuvre/+page.server.ts`, `+page.svelte` (nouvelle ou `?id=`), `apps/web/src/lib/planning/*.svelte` (Annee, Semaine), `apps/web/src/lib/planning/dates.ts` (+ tests)
- Modifier : `apps/web/src/routes/planning/+page.server.ts`, `+page.svelte`, `pages-a-venir.test.ts`, `budget.test.ts`, `e2e/accessibilite.spec.ts` (nouvelles pages)

**Écrans :**
- `/planning?annee=&vue=moi|equipes` : en haut, cartes « Ma prochaine astreinte », « Ma prochaine manœuvre », garde de fête ; bascule « Mon année » / « Toutes les équipes » (liens, `aria-current`) ; l'année = 12 sections (h2 mois) contenant une liste de semaines (numéro, dates, équipe en pastille couleur + nom, « Mon astreinte », fériés, vacances, manœuvres). Une colonne au téléphone, grille 3 colonnes à partir de 1024 px. Vide : « Le planning de l'année n'est pas encore publié. » Bouton « Préparer l'année » si `GERER_PLANNING`.
- `/planning/preparer?annee=` : Roulement (ordre par listes déroulantes), Semaines (par mois, une liste déroulante par semaine, « Changée » en texte), Manœuvres (liste + « Ajouter »), Noël et Nouvel An (équipes calculées, avertissement, historique), Repères (fériés, vacances), Publier. Année courante et suivante.

- [ ] **Étape 1 : tests d'abord** — `planning/page.server.test.ts` (non publiée → vide ; publiée → semaines et prochaine ; refus sans `VOIR_PLANNING`), `planning/page.test.ts` (rendu : « Mon astreinte » en texte, vide soigné), `planning/preparer/page.server.test.ts` (refus 403 pour un agent ; chaque action enregistre ; publication), budget (`/planning` et `/planning/preparer` sous 45).
- [ ] **Étape 2 :** échec constaté. **Étape 3 :** code. **Étape 4 :** `pnpm test` vert.
- [ ] **Étape 5 :** commit « Planning : préparer l'année et onglet Planning » + push.

### Tâche 3 : abonnement d'agenda

**Fichiers :**
- Créer : `packages/socle/src/planning/agenda.ts`, `packages/socle/test/planning-agenda.test.ts`, `apps/web/src/routes/agenda/[fichier]/+server.ts` (+ test), `apps/web/src/routes/moi/agenda/+page.server.ts`, `+page.svelte` (+ tests)
- Modifier : `apps/web/src/routes/moi/+page.svelte` (rangée « Ajouter à mon agenda »), `packages/socle/src/actions/personnes.ts` (départ : clé effacée)

**Interfaces :**
- `monLienAgenda(base, acteur, maintenant): Promise<string>` — crée la clé au premier appel ; rend `"<id>-<clé>"`.
- `changerLienAgenda(base, acteur, maintenant): Promise<string>`
- `agendaDe(base, fichier: string, maintenant, reglage): Promise<string | null>` — nul si clé fausse, agent sans accès ; sinon le texte iCalendar (lignes CRLF, pliées à 75 octets) : périodes d'astreinte (`Astreinte · Équipe 2`), manœuvres où il est convoqué (thème, lieu), gardes de fêtes ; années publiées seulement ; `UID` stable.
- `egaux(a: string, b: string): boolean` — temps constant.
- Route : `GET /agenda/<id>-<clé>.ics` → `text/calendar; charset=utf-8`, `Cache-Control: private, max-age=900` ; 404 sinon.

- [ ] **Étape 1 : tests d'abord** — fichier valide (`BEGIN:VCALENDAR`, `DTSTART:20261106T170000Z` pour vendredi 6 novembre 18 h), passage à l'heure d'hiver (25 octobre 2026), clé fausse ou changée → nul, agent parti → nul, manœuvre annulée absente, page `/moi/agenda` (lien, « Changer le lien »).
- [ ] **Étapes 2-4 :** échec, code, vert.
- [ ] **Étape 5 :** commit « Planning : abonnement d'agenda » + push.

### Tâche 4 : manœuvres publiées par la tâche de nuit

**Fichiers :**
- Créer : `packages/socle/src/planning/manoeuvres.ts`, `packages/socle/test/planning-manoeuvres.test.ts`
- Modifier : `packages/socle/src/actions/publications.ts` (`auteurVu` : « Planning du centre » ; vue : `annulee`), `apercus.ts`, `notifications.ts` (`notifierConvoques`, nom de l'auteur), `planning/annee.ts` (modifier/annuler une manœuvre publiée), `apps/web/src/planifie.ts` (+ test), `apps/web/src/lib/ui/Publication.svelte` (« Annulée », pas de réponse)

**Interfaces :**
- `nuitDuPlanning(base, maintenant: string): Promise<{ publiees: number; relances: number }>` — manœuvres non annulées d'années publiées, à 14 jours ou moins et pas commencées, sans publication → publication événement sur `centre` (auteur `planning`, texte = thème, `debut`, `lieu`, `convoques`, sondage « Petit-déjeuner ? » Oui / Non si demandé) + notification aux convoqués ; relance (décision 7).
- `notifierConvoques(base, publicationId, maintenant, { titre: string; seulementSansReponse: boolean }): Promise<void>` — fil + file, convoqués (`estConvoque`) du jour.
- `mercrediDeRelance(date: string): string`, `clotureSondage(debut: string, maintenant: string): string`.

- [ ] **Étape 1 : tests d'abord** — publiée à J-14 et pas à J-15 ; année non publiée : rien ; une seule fois ; convoqués seulement notifiés (équipe 1 convoquée : Bruno de l'équipe 2 non) ; sondage fermant le vendredi 18 h ; relance le mercredi aux sans-réponse ; modification après publication : publication mise à jour + notification ; annulation : `annulee_le`, la nuit ne republie pas ; auteur affiché « Planning du centre ».
- [ ] **Étapes 2-4 :** échec, code, vert.
- [ ] **Étape 5 :** commit « Planning : manœuvres annoncées la nuit » + push.

### Tâche 5 : jeu de départ, doc, e2e, captures

**Fichiers :**
- Modifier : `packages/socle/src/jeu-de-depart.ts` ou `apps/web/scripts/jeu-de-depart.ts` (année courante publiée, 4 manœuvres fictives, avec les fictifs seulement), `docs/fonctionnel/astreinte-et-rotation.md`, `docs/fonctionnel/README.md`, `docs/utilisation/` (« Préparer l'année », « Ajouter le planning à mon agenda », « Voir mon planning »), `docs/technique/socle.md`, `docs/decisions/0013-planning-de-l-annee.md`
- Créer : `apps/web/e2e/planning.spec.ts`

- [ ] **Étape 1 :** e2e : le super administrateur prépare et publie, l'agent voit son année, ouvre « Ajouter à mon agenda », sans violation axe (téléphone et ordinateur).
- [ ] **Étape 2 :** `pnpm exec playwright test e2e/planning.spec.ts --workers=1` en cage, vert.
- [ ] **Étape 3 :** captures 390 et 1280, clair et sombre (script local non commité), regardées et corrigées.
- [ ] **Étape 4 :** commit « Planning : doc, e2e » + push.
