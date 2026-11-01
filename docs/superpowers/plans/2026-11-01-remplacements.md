# Remplacements, échanges et aptitudes : plan d'exécution

> **Pour les sous-agents :** sous-skill requis, superpowers:executing-plans (ou subagent-driven-development). Les étapes sont des cases à cocher (`- [ ]`).

**But :** un agent se fait remplacer (demande ciblée ou ouverte) ou échange une période ou une manœuvre avec un collègue ; les aptitudes contrôlées décident s'il faut la validation du chef d'équipe ; le planning, l'agenda, la cloche et l'accueil suivent.

**Architecture :**
- **Aptitudes** (`packages/socle/src/aptitudes.ts`) : liste du centre (réglages, `GERER_LISTES`), aptitudes datées des agents (`GERER_ACCES`), colonnes « Aptitude : X » du fichier de l'effectif.
- **Remplacements** (`packages/socle/src/remplacements/`) : `tranches.ts` (calculs purs : découpe des périodes d'astreinte, soustraction), `demandes.ts` (écritures : demander, accepter, valider…), `lectures.ts` (écrans, effets sur le planning et l'agenda, à-décider), `avis.ts` (cloche et téléphone), `moment.ts` (expiration et relance, tâche planifiée).
- **Manœuvres** : la convocation (`manoeuvre.convoques`, recopiée dans `publication.convoques`) accepte une forme à exceptions `{ equipes, ajoutes, retires }` ; `convoque()` et `estConvoque()` prennent l'identifiant de la personne.
- **Appli** : `/remplacements` (Pour moi, Mes demandes, À valider, Historique), `/remplacements/demander`, `/remplacements/manoeuvre`, `/remplacements/[id]`, `/reglages/aptitudes`, section Aptitudes de la fiche agent et de Moi, marques dans le planning.

**Technos :** SvelteKit, Svelte 5, Drizzle sur D1, Vitest, Playwright et axe. Aucune dépendance ajoutée.

**Spec :** [`docs/superpowers/specs/2026-11-01-remplacements-design.md`](../specs/2026-11-01-remplacements-design.md).

## Contraintes globales

- `CLAUDE.md` : français, TDD, code simple, commentaires rares, rien de propre à un centre dans le code.
- Une migration **additive** `0013` (générée par `pnpm --filter @gyro-caserne/socle migrations`, plus les aptitudes par défaut ajoutées à la main pour les bases déjà remplies, comme la `0011`).
- Heure de Paris : moments `AAAA-MM-JJTHH:MM`, comparés comme textes.
- Budget : 45 requêtes D1 par page (`routes/budget.test.ts`, nouvelles pages ajoutées), 100 paramètres liés au plus (listes d'ids en JSON, `json_each`).
- Demande ouverte : **une seule acceptation**, décidée dans l'écriture (`update … where etat = 'attente'`, puis on relit qui l'a eue).
- On ne demande pas une période commencée ; une demande non conclue **expire au début** de sa première période.
- Téléphone d'abord, soigné à 1280, clair et sombre, AA ; états et marques en **texte**, jamais la couleur seule.
- Données fictives seulement.

## Décisions de construction (à valider par le porteur)

1. **Découpe des périodes** : chaque période d'astreinte est coupée à l'heure de fin du soir (6 h) : nuits de semaine 18 h – 6 h, gardes de 24 h 6 h – 6 h le week-end et les fériés, la première nuit du vendredi 18 h – samedi 6 h. « Le week-end entier » coche toutes les tranches d'un bloc continu. Sans horaire de semaine (astreinte continue) : tranches de 24 h à l'heure de relève.
2. **Qui valide** : les titulaires du rôle système Chef d'équipe de l'équipe d'astreinte du demandeur (celui-ci exclu) ; à défaut, chef de centre et adjoint. Pour un échange, c'est l'équipe du demandeur, quel que soit le sens où une aptitude manque.
3. **Refus du chef ou désistement** : une demande ouverte redevient « en attente » (le remplaçant refusé ou désisté ne la revoit plus) ; une demande ciblée passe « refusée », le demandeur peut l'ouvrir à tous d'un geste.
4. **Annuler** : le demandeur tant que personne n'a accepté (ou refusée) ; après, le remplaçant se désiste ou un valideur annule.
5. **Disponible** : agent avec accès (ni extérieur, ni parti, ni suspendu), ni d'astreinte (son équipe) sur une des périodes, ni remplaçant ni demandeur d'une demande en cours qui la chevauche.
6. **Échange de manœuvre** : à l'acceptation, chacun est convoqué à la place de l'autre ; sa réponse à l'ancienne manœuvre est effacée et il est noté « Présent » à la nouvelle (s'engager est le sens de l'échange).
7. **Relance de la veille** : au passage de 8 h, la veille du début, une fois.
8. **Expiration** : vérifiée à chaque passage de dix minutes de la tâche planifiée ; les écrans ne montrent jamais comme actionnable une demande commencée.
9. **Aptitudes au fichier** : « Oui » ajoute l'aptitude obtenue le jour de l'import ; vide la retire ; les dates se règlent sur la fiche.
10. **Accueil** : une demande reçue s'affiche dans « À ne pas manquer » (Accepter sur sa page) ; une demande à valider dans « À décider » de la casquette Chef d'équipe (ou Le centre pour le chef de centre).
11. **Départ d'un agent** : ses demandes en cours sont annulées ; celles où il remplaçait redeviennent en attente.

## Revue : à surveiller

1. Deux agents acceptent la même demande ouverte au même moment : un seul l'emporte, l'autre lit « Déjà prise » (test tâche 2).
2. Période au changement d'heure (nuit du 24 au 25 octobre 2026) : tranche juste, agenda juste en UTC (test tâches 2 et 4).
3. Agent sans équipe, équipe sans chef, demandeur chef de son équipe : valideurs juste (test tâche 2).
4. Manœuvre modifiée par le chef après un échange : les exceptions restent ; repassée à « toutes les équipes », elles tombent (test tâche 3).
5. Demande commencée : ni acceptable, ni validable, expirée par la tâche planifiée et prévenue une seule fois (test tâche 4).

---

### Tâche 1 : aptitudes

**Fichiers :**
- Créer : `packages/socle/src/aptitudes.ts`, `packages/socle/test/aptitudes.test.ts`, `packages/socle/test/migration-0013.test.ts`, `apps/web/src/routes/reglages/aptitudes/+page.server.ts`, `+page.svelte` (+ tests)
- Modifier : `schema.ts`, `listes.ts`, `jeu-de-depart.ts`, `index.ts`, `fichier-effectif.ts`, `apercu-import.ts`, `appliquer-import.ts` (+ tests), `apps/web/src/routes/agents/[id]/*` (section Aptitudes), `routes/moi/*` (Mes aptitudes), `routes/reglages/ListeReglages.svelte`

**Tables :** `aptitude` (`id`, `nom` unique, `controlee` 0/1, `ordre`, `retiree_le`) ; `aptitude_agent` (`personne_id`, `aptitude_id`, `obtenue_le`, `expire_le` nul ; clé (personne, aptitude)).

**Par défaut :** CA2, CA1, CE, COD1, COD2 (contrôlées) ; INC, SAP, DIV, FDF1, FDF2 (non contrôlées).

**Interfaces (produites) :**
- `type Aptitude = { id; nom; controlee: boolean; ordre }`, `type AptitudeAgent = { aptitudeId; nom; controlee; obtenueLe; expireLe; valide: boolean }`
- `listerAptitudes(base): Promise<Aptitude[]>` (non retirées, par ordre) ; `enregistrerAptitude(base, acteur, { id?, nom, controlee }, maintenant): Promise<number>` ; `retirerAptitude(base, acteur, id, maintenant)` — `GERER_LISTES`, journal.
- `aptitudesDe(base, acteur, personneId, aujourdhui): Promise<AptitudeAgent[]>` — soi-même ou `GERER_ACCES`.
- `donnerAptitude(base, acteur, personneId, { aptitudeId, obtenueLe, expireLe }, maintenant)`, `oterAptitude(base, acteur, personneId, aptitudeId, maintenant)` — `GERER_ACCES` ; journal `cibleType: 'personne'`.
- `validesLe(lignes: { aptitudeId; obtenueLe; expireLe }[], date): Set<number>` — obtenue ≤ date ≤ expiration.
- Fichier : colonnes `Aptitude : <nom>` (« Oui » ou vide), opération d'import `{ type: 'aptitude'; personne: RefPersonne; aptitudeId; oui: boolean }`.

- [ ] **Étape 1 : tests d'abord** — refus sans `GERER_LISTES` / `GERER_ACCES` ; nom en double refusé ; aptitude expirée non valide ; agent voit les siennes, pas celles d'un autre ; export avec colonne « Aptitude : CA2 » ; import « Oui » ajoute, vide retire, autre valeur en erreur ; migration 0013 : base remplie reçoit les 10 aptitudes, base vide rien, rejouée sans doublon ; pages réglages et fiche (rendu, actions).
- [ ] **Étape 2 :** échec constaté. **Étape 3 :** code, migration, écrans. **Étape 4 :** `pnpm test` vert.
- [ ] **Étape 5 :** commit « Aptitudes : liste du centre, fiche, fichier » + push.

### Tâche 2 : socle des remplacements et des échanges de périodes

**Fichiers :**
- Créer : `packages/socle/src/remplacements/tranches.ts`, `demandes.ts`, `lectures.ts`, `avis.ts`, tests `remplacements-tranches.test.ts`, `remplacements.test.ts`
- Modifier : `schema.ts`, `listes.ts`, `index.ts`

**Tables :**
- `demande_remplacement` : `id`, `genre` (`remplacement` | `echange` | `manoeuvre`), `demandeur_id`, `cible_id`, `periodes` (JSON), `periodes_cible` (JSON, échange), `manoeuvre_id`, `manoeuvre_cible_id`, `equipe_id`, `debut` (premier début), `mot`, `etat` (`attente` | `a_valider` | `conclue` | `refusee` | `annulee` | `expiree`), `remplacant_id`, `manque` (JSON des aptitudes manquantes), `cree_le`, `acceptee_le`, `tranchee_par`, `tranchee_le`, `motif`, `relance_le`.
- `destinataire_remplacement` : `demande_id`, `personne_id`, `refuse_le` ; clé (demande, personne).
- `avis_remplacement` : `id`, `personne_id`, `demande_id` (cascade), `quoi`, `cree_le`, `lue_le`.

**Interfaces (produites) :**
- `tranchesDe(periodes: Periode[], reglage): Periode[]` ; `soustraire(periodes, retirees): Periode[]` ; `chevauche(a, b): boolean`.
- `mesPeriodes(base, acteur, maintenant, reglage): Promise<{ semaine: string; equipeId; tranches: (Periode & { prise: boolean })[] }[]>` — ses semaines à venir des années publiées (12 semaines au plus).
- `demanderRemplacement(base, acteur, { periodes: Periode[]; cibleId: number | null; mot?: string }, maintenant, reglage): Promise<number>`
- `proposerEchange(base, acteur, { periodes; cibleId; periodesCible; mot? }, maintenant, reglage): Promise<number>`
- `accepterDemande(base, acteur, id, maintenant, reglage): Promise<'conclue' | 'a_valider'>` ; `refuserDemande` (destinataire) ; `ouvrirATous` ; `annulerDemande` ; `desister` ; `valider` ; `refuserValidation(base, acteur, id, motif, maintenant)`.
- `disponibles(base, periodes, demandeurId, maintenant, reglage): Promise<{ id; prenom; nom; aptitudes: boolean }[]>` — ceux qui ont les aptitudes contrôlées du demandeur d'abord.
- `manqueDe(base, demandeurId, remplacantId, date): Promise<string[]>` — noms des aptitudes contrôlées valides du demandeur que l'autre n'a pas.
- Avis : `quoi` parmi `recue`, `acceptee`, `refusee`, `a_valider`, `validee`, `refus_chef`, `desistement`, `expiree`, `annulee`, `relance`, `informe` ; chaque avis écrit aussi un envoi au téléphone (lieu `remplacements`, seul « tout » le coupe).

- [ ] **Étape 1 : tests d'abord** — tranches d'une semaine ordinaire (vendredi 18 h – samedi 6 h, samedi 6 h – dimanche 6 h, dimanche 6 h – lundi 6 h, puis nuits) et d'un jeudi férié ; nuit du changement d'heure ; demande ciblée : seul le collègue la reçoit, il accepte → conclue, chef informé ; refus → `refusee`, `ouvrirATous` → destinataires = disponibles ; ouverte : deux acceptations simultanées (`Promise.all`) → une seule gagne ; aptitude contrôlée manquante → `a_valider`, valideurs = chef d'équipe ; demandeur chef de son équipe → chef de centre ; refus du chef → rouverte, remplaçant prévenu ; désistement → rouverte, titulaire prévenu ; période commencée refusée ; échange : chacun disponible sur les périodes de l'autre, aptitudes dans les deux sens.
- [ ] **Étapes 2-4 :** échec, code, `pnpm test` vert.
- [ ] **Étape 5 :** commit « Remplacements : demandes, acceptation, validation » + push.

### Tâche 3 : échanges de manœuvres

**Fichiers :** modifier `planning/annee.ts` (`Convoques`, `convoque`, `exigerManoeuvre`, `vueManoeuvre`), `murs.ts` (`estConvoque`), `notifications.ts`, `a-ne-pas-manquer.ts`, `actions/publications.ts`, `actions/interactions.ts`, `planning/agenda.ts`, `remplacements/demandes.ts` ; tests `planning-annee`, `murs`, `remplacements`.

**Interfaces :**
- `type Convoques = 'tous' | number[] | { equipes: number[]; ajoutes: number[]; retires: number[] }`
- `convoque(convoques, equipeId: number | null, personneId: number): boolean` ; `estConvoque(a, cle, convoques, personneId)`.
- `proposerEchangeManoeuvre(base, acteur, { manoeuvreId; cibleId; manoeuvreCibleId; mot? }, maintenant): Promise<number>` — refusé si l'une convoque toutes les équipes, si l'un n'y est pas convoqué ou l'est aux deux, si commencée ou annulée. À l'acceptation : exceptions écrites dans la manœuvre et sa publication, réponses reprises (décision 6), chefs d'équipe informés.

- [ ] **Étape 1 : tests d'abord** — convoqué par exception ajoutée, non convoqué par exception retirée ; échange accepté : agenda et « Ma prochaine manœuvre » suivent ; manœuvre modifiée (équipes) garde les exceptions, « tous » les efface ; refus si « tous ».
- [ ] **Étapes 2-4.** **Étape 5 :** commit « Remplacements : échanges de manœuvres » + push.

### Tâche 4 : effets (planning, agenda, cloche, accueil, tâche planifiée, départ)

**Fichiers :** modifier `planning/annee.ts` (`planningDe` gagne `remplacements`), `planning/agenda.ts`, `notifications.ts` (fil, non-lues, tout lu, ménage, départ), `a-ne-pas-manquer.ts` (`remplacements`), `casquettes.ts` (à décider), `actions/personnes.ts` (départ), `apps/web/src/planifie.ts` ; créer `remplacements/moment.ts`.

**Interfaces :**
- `remplacementsConclus(base, du, au): Promise<{ debut; fin; titulaireId; remplacantId; titulaire: string; remplacant: string }[]>` (lectures.ts).
- `PlanningAgent` publié gagne `remplacements: { debut; fin; titulaire; remplacant; moi: 'cede' | 'prend' | null }[]`.
- Agenda : périodes cédées retirées des astreintes, « Remplacement de <Prénom Nom> » ajouté au remplaçant.
- `LigneFil` gagne `LigneRemplacement = { id; type: 'remplacement'; demandeId; quoi; texte; creeLe; lue }` ; `marquerAvisRemplacementLus(base, moi, maintenant)`.
- `nombreRemplacementsAValider(base, acteur, maintenant): Promise<number>` (cloche) ; `ANePasManquer.remplacements: { id; titre; sous }[]` ; `ContenuCasquette` `equipe` gagne `aDecider`.
- `remplacementsDuMoment(base, maintenant): Promise<{ expirees: number; relances: number }>` — appelé à chaque passage dont la minute finit par 0 ; relance la veille à partir de 8 h.

- [ ] **Étape 1 : tests d'abord** — « X remplace Y » sur la bonne période ; agenda du titulaire sans la nuit cédée, du remplaçant avec ; cloche du chef compte la demande à valider jusqu'à la décision ; expirée une seule fois et prévenue ; relance unique la veille ; départ.
- [ ] **Étapes 2-4.** **Étape 5 :** commit « Remplacements : planning, agenda, cloche, accueil » + push.

### Tâche 5 : écrans

**Fichiers :** créer `apps/web/src/routes/remplacements/+page.server.ts`, `+page.svelte`, `demander/*`, `manoeuvre/*`, `[id]/*`, `apps/web/src/lib/remplacements/*.svelte` (CarteDemande), `lib/remplacements/textes.ts` (libellés de tranches et d'états, + tests) ; modifier `routes/planning/+page.svelte` (« Me faire remplacer », « Remplacements »), `lib/planning/Annee.svelte` (marques), `routes/moi/+page.svelte`, `routes/+page.svelte` et `lib/ui/ANePasManquer.svelte`, `routes/notifications/+page.svelte` (lignes de remplacement, « À valider »), `routes/+layout.server.ts` (cloche), `budget.test.ts`, `e2e/accessibilite.spec.ts`.

**Écrans :**
- `/remplacements?onglet=pour-moi|miennes|a-valider|historique` : onglets en liens (`aria-current`), « À valider » seulement pour un valideur ; cartes avec état en texte, périodes en clair (« Nuit du lundi 9 novembre, 18 h – 6 h »), Accepter / Refuser, avertissement d'aptitude avant d'accepter (« Il vous manque CA1 : le chef d'équipe devra valider »).
- `/remplacements/demander?semaine=` : tranches à cocher par semaine (« Tout le week-end »), « Ouverte à tous » ou « À un collègue » (liste), ou « Échanger avec un collègue » qui affiche ses périodes à cocher (`?echange=<id>`), mot facultatif.
- `/remplacements/manoeuvre` : ma manœuvre, le collègue et sa manœuvre.
- `/remplacements/[id]` : détail, disponibles (avec aptitudes d'abord) pour le demandeur, gestes selon l'état, rappel « Mettez à jour votre disponibilité dans l'appli du SDIS » une fois conclue.

- [ ] **Étape 1 : tests d'abord** — `page.server.test.ts` de chaque page (refus d'un inconnu, actions, messages), `page.test.ts` (états en texte, vide soigné), libellés de tranches, budget sous 45.
- [ ] **Étapes 2-4.** **Étape 5 :** commit « Remplacements : écrans » + push.

### Tâche 6 : doc, jeu fictif, e2e, captures

**Fichiers :** `docs/fonctionnel/remplacements-et-echanges.md` (réécrit), `docs/fonctionnel/fiche-agent.md`, `docs/utilisation/me-faire-remplacer.md`, `accepter-un-remplacement.md`, `valider-un-remplacement.md`, `echanger-une-manoeuvre.md`, `saisir-les-aptitudes.md`, `docs/utilisation/README.md`, `docs/decisions/0014-remplacements.md`, `docs/technique/socle.md` ; `packages/socle/src/remplacements/fictif.ts` (aptitudes fictives, une demande ouverte) appelé par `scripts/jeu-de-depart.ts` et les comptes de test ; `apps/web/e2e/remplacements.spec.ts`.

- [ ] **Étape 1 :** e2e — Alice demande une nuit ouverte, Bruno l'accepte, le planning l'écrit ; axe sans violation sur chaque page.
- [ ] **Étape 2 :** doc et décisions.
- [ ] **Étape 3 :** captures 390 et 1280, clair et sombre, regardées et corrigées.
- [ ] **Étape 4 :** `pnpm test`, `pnpm check` verts ; commit « Remplacements : doc, e2e » + push.
