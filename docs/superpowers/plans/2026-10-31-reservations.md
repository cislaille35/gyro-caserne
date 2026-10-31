# Réservations : plan d'exécution

> **Pour les sous-agents :** sous-skill requis, superpowers:executing-plans (ou subagent-driven-development). Les étapes sont des cases à cocher (`- [ ]`).

**But :** réserver la VL et le matériel de l'amicale dans l'appli, sans double réservation, avec la bonne personne qui tranche et des notifications qui préviennent.

**Architecture :**
- **Socle** (`packages/socle/src/reservations.ts`) : deux tables (`ressource`, `reservation`) et une table d'avis (`avis_reservation`, le fil de la cloche pour le demandeur). La ressource dit qui la gère (un rôle **ou** un comité), sa forme (`jours` + stock, ou `creneau`), si elle est ouverte à la réserve citoyenne. Chaque action est un seul `batch` : réservation, journal, avis et envois au téléphone ensemble.
- **Calcul pur** (`packages/socle/src/reservations-calcul.ts`) : chevauchement et stock restant par jour, partagé par le socle (règle) et l'écran Réserver (disponibilité affichée tout de suite, sans aller-retour).
- **Appli** : `/reservations` rangé sous Caserne ; ressource et calendrier, Réserver, Mes réservations, À valider, Gérer le matériel ; la cloche compte les demandes à trancher ; « À décider » sur les casquettes qui gèrent.

**Technos :** SvelteKit 3, Svelte 5, Drizzle sur D1, Vitest, Playwright et axe. Aucune dépendance ajoutée.

**Spec :** [`docs/superpowers/specs/2026-10-31-reservations-design.md`](../specs/2026-10-31-reservations-design.md) ; s'appuie sur [`2026-10-31-notifications-design.md`](../specs/2026-10-31-notifications-design.md).

## Contraintes globales

- `CLAUDE.md` : français, TDD, code simple, commentaires rares, rien de propre à un centre (les objets fictifs ne vont qu'aux comptes de test et aux personnes fictives locales).
- Migration **additive** générée par `drizzle-kit` (`pnpm --filter @gyro-caserne/socle migrations`), complétée à la main par des insertions gardées (`EXISTS profil`, `NOT EXISTS …`) comme `0001`.
- D1 : 100 paramètres au plus par requête, pas de colonnes de même nom issues de tables jointes dans un `batch`. Budget : 45 requêtes par page et par geste (`routes/budget.test.ts`) ; le compteur ajouté à la cloche est **une** lecture.
- Heure de Paris partout : jours `AAAA-MM-JJ` (inclus) pour le matériel, `AAAA-MM-JJTHH:MM` (fin exclue) pour un créneau.
- Briques `apps/web/src/lib/ui/` (`Rangee`, `ListeRangees`, `EnTetePage`, `Vide`, `Visage`, `Retour`, `Champ`, `Choix`, `Pastille`), jetons de `app.css`. Téléphone d'abord, soigné à 1280, clair et sombre, AA, clavier, jamais la couleur seule (l'état d'une réservation est toujours écrit).

## Décisions de construction (à présenter au porteur)

- La **forme** porte la règle : `creneau` = acceptée d'office si libre, sinon en attente ; `jours` = toujours en attente. Une autre ressource s'ajoute par une ligne, sans code.
- **Réserve citoyenne** = toute personne au profil de type « extérieur » : elle doit saisir un nom, ne voit et ne réserve que les ressources ouvertes. `RESERVER` est ajouté aux profils « Agent » **et** « Réserve citoyenne » (sinon le compte partagé ne pourrait rien réserver).
- Ajouter du matériel : tout membre d'un comité, pour l'un de ses comités (choix dans le formulaire s'il en a plusieurs) ; modifier, retirer : qui gère la ressource. La VL se renomme, ne se retire pas.
- Bornes : une réservation commence dans moins d'un an et dure 14 jours au plus ; quantité ≥ 1 ; nom 60, mot et motif 200, téléphone 20 caractères.
- Les avis (accord, refus, annulation) et la demande à trancher sont écrits **dans le batch de l'action** : pas d'appel en arrière-plan, rien ne se perd.
- Accepter une VL en conflit avec une réservation acceptée annule celle-ci (son demandeur est prévenu) ; garder l'autre, c'est refuser la demande.
- Le chef de centre ne tranche pas (seul le super administrateur gère tout, comme le dit la spec).

## Review Focus

- Deux demandes de matériel le même jour qui, ensemble, dépassent le stock : la seconde est refusée à la saisie avec le nombre restant (tâche 1).
- Stock baissé sous ce qui est déjà promis : accepter une demande en attente est refusé si le stock ne suffit plus (« Plus assez de … ») ; les demandes déjà acceptées restent (tâche 1).
- Une personne qui perd son rôle de gestionnaire (attribution terminée, rôle archivé, comité dissous) ne voit plus « À valider » ni le compte dans la cloche (tâche 1, `nombreAValider`).
- Annuler après le début de la période : refusé pour le demandeur ; le gestionnaire, lui, peut encore annuler une réservation acceptée (tâche 1).
- Compte partagé de la réserve citoyenne : sans nom, refus ; avec nom, le nom (et non « Estelle Extérieure ») est montré partout, téléphone au gestionnaire et au compte seulement (tâches 1 et 3).

---

### Task 1 : socle des réservations

**Files :**
- Create : `packages/socle/src/reservations.ts`, `packages/socle/src/reservations-calcul.ts`, `packages/socle/test/reservations.test.ts`, `packages/socle/test/reservations-calcul.test.ts`, `packages/socle/test/migration-0011.test.ts`
- Modify : `schema.ts`, `listes.ts` (`FORMES_RESSOURCE`, `ETATS_RESERVATION`), `index.ts`, `jeu-de-depart.ts` (VL, `RESERVER` aux deux profils), `comptes-de-test.ts` (objets fictifs), migration `0011_*` générée puis complétée, `apps/web/scripts/jeu-de-depart.ts` (objets fictifs avec les personnes fictives)

**Interfaces (Produces) :**
- Tables : `ressource(id, nom, forme 'jours'|'creneau', stock int null, icone, ouverte_reserve 0/1, geree_par_responsabilite_id null, geree_par_comite_id null, retiree_le null, cree_le)` avec un contrôle « exactement un gestionnaire » ; `reservation(id, ressource_id, personne_id, nom_demandeur null, telephone null, debut, fin, quantite, mot null, etat 'attente'|'acceptee'|'refusee'|'annulee', cree_le, tranchee_par null, tranchee_le null, motif null)`, index `(ressource_id, etat, debut)` et `(personne_id)`.
- `reservations-calcul.ts` : `chevauche(a: Periode, b: Periode, forme): boolean`, `joursEntre(du, au): string[]`, `restantParJour(stock: number, prises: Prise[], du: string, au: string): { jour: string; restant: number }[]` où `Prise = { debut; fin; quantite; etat }` (seules `attente` et `acceptee` comptent).
- `reservations.ts` :
  - `type Ressource = { id; nom; forme; stock: number | null; icone: NomIcone; ouverteReserve: boolean; gestionnaire: { type: 'role' | 'comite'; id: number; nom: string }; jeGere: boolean }`
  - `type VueReservation = { id; ressourceId; ressource: string; forme; debut; fin; quantite; mot; etat; demandeur: string; telephone: string | null; motif: string | null; creeLe; mienne: boolean; annulable: boolean }` — `demandeur` : `nom_demandeur` s'il existe, sinon « Prénom Nom ».
  - `ressourcesDe(base, acteur, aujourdhui): Promise<{ ressources: Ressource[]; peutReserver: boolean; reserveCitoyenne: boolean; aValider: number; peutGererMateriel: boolean }>` — créneaux d'abord, puis par nom ; retirées exclues ; extérieur : ouvertes seulement.
  - `calendrier(base, acteur, id, du, au, aujourdhui): Promise<{ ressource: Ressource; reservations: VueReservation[] }>` (attente et acceptée qui touchent `[du, au]`).
  - `reserver(base, acteur, id, d: { debut: string; fin: string; quantite?: number; mot?: string; nomDemandeur?: string; telephone?: string }, maintenant): Promise<{ id: number; etat: 'attente' | 'acceptee' }>`
  - `accepter(base, acteur, id, maintenant)`, `refuser(base, acteur, id, motif: string | null, maintenant)`, `annuler(base, acteur, id, mot: string | null, maintenant)`
  - `mesReservations(base, acteur, maintenant): Promise<{ aVenir: VueReservation[]; passees: VueReservation[] }>` (passées : 30 dernières)
  - `aValider(base, acteur, aujourdhui): Promise<{ demande: VueReservation; conflits: VueReservation[] }[]>` ; `nombreAValider(base, acteur, aujourdhui): Promise<number>` (une requête)
  - `ressourcesAGerer(base, acteur, aujourdhui): Promise<{ ressources: Ressource[]; comites: { id: number; nom: string }[] }>`, `ajouterRessource(base, acteur, { nom, stock, icone, comiteId }, maintenant): Promise<number>`, `modifierRessource(base, acteur, id, { nom, stock?, icone }, maintenant)`, `retirerRessource(base, acteur, id, maintenant)`
  - `effacerVieillesReservations(base, avant: string)` (fin avant `avant`)
  - SQL interne `gere(personneId, ressource, aujourdhui)` : la personne a accès et tient en cours le rôle gestionnaire (non archivé, bon type de périmètre) ou un rôle de portée comité dans le comité gestionnaire. Super administrateur : tout.

- [ ] **Step 1 : tests du calcul** (`reservations-calcul.test.ts`) : `restantParJour(12, [{debut:'2026-11-12',fin:'2026-11-14',quantite:5,etat:'acceptee'},{debut:'2026-11-13',fin:'2026-11-13',quantite:4,etat:'attente'},{… quantite:9, etat:'refusee'}], '2026-11-11','2026-11-14')` → `[12, 7, 3, 7]` ; `chevauche` créneaux bout à bout (`10:00-12:00` et `12:00-14:00`) → faux ; jours `12-14` et `14-15` → vrai.
- [ ] **Step 2 : tests du socle** (`reservations.test.ts`, base de test + jeu de départ, Alice agent, Romain membre de l'Amicale, Rémi référent engins, Estelle réserve citoyenne) :
  - jeu de départ : une ressource « VL », `creneau`, ouverte, gérée par « Référent engins » ; `RESERVER` dans les profils Agent et Réserve citoyenne ;
  - VL libre → `acceptee` ; chevauchant une attente ou une acceptée → `attente` ;
  - matériel → `attente` ; dépassement → `DonneeInvalide('Il reste 3 bancs le 13 nov.')` (le moins restant sur la période, nom de la ressource en minuscule) ;
  - fin ≤ début, plus de 14 jours, début passé ou à plus d'un an, quantité < 1 → `DonneeInvalide` ;
  - sans `RESERVER` (profil vidé) → `RefusDroit` ; extérieur sur le matériel → `RefusDroit` ; extérieur sans nom → `DonneeInvalide('Nom du demandeur obligatoire')` ;
  - accepter/refuser : seul qui gère (Romain pour les bancs, pas Rémi ; Rémi pour la VL ; super pour tout) ; accepter une VL en conflit annule l'acceptée qui chevauche (`etat 'annulee'`, `motif` « Créneau donné à une autre demande ») ; stock baissé → accepter refusé ;
  - annuler : demandeur avant le début seulement ; gestionnaire sur une acceptée, avec son mot en `motif` ; n'importe quelle session du compte partagé ;
  - `retirerRessource` : plus de demande possible, réservations à venir annulées ; la VL ne se retire pas ;
  - `nombreAValider` : 2 pour Romain avec 2 demandes de bancs, 0 pour Rémi, 0 après la fin de son attribution ;
  - `mesReservations` du compte partagé : toutes les siennes, avec `nomDemandeur` ; `telephone` visible du gestionnaire, `null` pour un autre agent dans `calendrier`.
- [ ] **Step 3 : test de migration** (`migration-0011.test.ts`) : sur une base en 0010 avec les profils et « Référent engins », 0011 ajoute la VL et `RESERVER` aux deux profils ; rejouée sur une base vide, elle n'ajoute rien ; pas de doublon.
- [ ] **Step 4 : lancer** `pnpm --filter @gyro-caserne/socle test` → échecs attendus (fonctions absentes).
- [ ] **Step 5 : implémenter** schéma, migration générée + insertions gardées, calcul, actions (chaque écriture et son journal en un `batch`), jeu de départ, objets fictifs (« Bancs » 12, « Tables » 6, « Barnum » 1, gérés par l'Amicale) dans `chargerComptesDeTest` et le script local.
- [ ] **Step 6 : lancer** `pnpm --filter @gyro-caserne/socle test` → vert.
- [ ] **Step 7 : commit + push** « Réservations : le socle (ressources, réservations, règles, droits) ».

### Task 2 : notifications des réservations

**Files :** Modify `schema.ts` (table `avis_reservation`, dans la même migration 0011 si non publiée, sinon 0012), `notifications.ts`, `reservations.ts`, `index.ts`, `apps/web/src/planifie.ts`, `apps/web/src/routes/+layout.server.ts`, `apps/web/src/routes/notifications/+page.server.ts` et `+page.svelte` ; tests associés.

**Interfaces :**
- `avis_reservation(id, personne_id, reservation_id → reservation cascade, quoi 'acceptee'|'refusee'|'annulee', cree_le, lue_le)`.
- `LigneFil` devient une union : `… | { id; type: 'reservation'; reservationId; quoi; ressource: string; quand: string; motif: string | null; creeLe; lue }` ; `filDeNotifications` les fusionne (même `batch`) ; `enTeteDe().nonLues` compte les deux tables (une requête).
- `mettreEnFile(base, ids: number[] | SQL, lieu, donnees, maintenant)` exporté ; lieu `reservations` (seul « tout » le coupe).
- `marquerAvisLus(base, moi, maintenant)` (écriture à mettre dans le `batch` de `mesReservations`).

- [ ] **Step 1 : tests** : une demande de bancs met en file un envoi par appareil de chaque membre de l'Amicale (« Demande de réservation · Bancs », url `/reservations/a-valider`), aucun pour Rémi ni pour le demandeur ; une VL acceptée d'office n'envoie rien ; une VL en attente envoie au référent engins ; accord, refus, annulation par un gestionnaire : un avis et un envoi au demandeur (« Bancs : demande acceptée », url `/reservations/miennes`) ; annulation par le demandeur : rien ; « tout » coupé : avis écrit, aucun envoi ; `filDeNotifications` rend l'avis, `nonLues` le compte ; `mesReservations` le marque lu ; layout : cloche = non-lues + signalements + `nombreAValider` ; page /notifications : rangée « 2 demandes de réservation à valider » vers `/reservations/a-valider`, ligne d'avis vers `/reservations/miennes` ; nuit : réservations finies depuis plus d'un an effacées.
- [ ] **Step 2 : lancer** les tests → rouge.
- [ ] **Step 3 : implémenter.**
- [ ] **Step 4 : lancer** `pnpm test` → vert ; budget de `/notifications` tenu.
- [ ] **Step 5 : commit + push** « Réservations : notifications ».

### Task 3 : écrans agent

**Files :** Create `apps/web/src/routes/reservations/+page.server.ts|svelte`, `reservations/[id]/+page.server.ts|svelte` (calendrier), `reservations/[id]/reserver/+page.server.ts|svelte`, `reservations/miennes/+page.server.ts|svelte`, `apps/web/src/lib/reservations.ts` (textes : période lisible, état en mots, mois et semaine affichés), `lib/server/formulaire-reservation.ts` (lecture du formulaire, phrases d'erreur) ; tests `page.test.ts` / `page.server.test.ts` de chaque page. Modify `caserne/+page.svelte|server.ts` (rangée « Réservations »), `lib/ui/navigation.ts` (`/reservations` sous Caserne).

- [ ] **Step 1 : tests** :
  - `/reservations` : « Mes réservations » en tête, puis VL, puis le matériel (« 12 en stock ») ; rangée « À valider · 2 » pour qui gère ; « Gérer le matériel » pour un membre de comité ; extérieur : la VL seule ; sans droit : `Vide` qui l'explique ;
  - `/reservations/[id]?jour=` : semaine (téléphone, liste de 7 jours) et mois (ordinateur, grille), liens précédent/suivant, chaque jour dit ce qui est pris, par qui, son état écrit, et « Reste 7 sur 12 » ; bouton « Réserver » ; 404 sur une ressource retirée ou invisible ;
  - `/reservations/[id]/reserver` : matériel (du, au, quantité, mot) ou créneau (début, fin, mot) ; compte partagé : nom obligatoire et téléphone ; disponibilité calculée dans la page avec `restantParJour`/`chevauche` (« Disponible », « Il en reste 3 le 13 nov. », « Créneau déjà demandé : votre demande attendra le référent ») ; action `?/reserver` → redirection vers `/reservations/miennes` avec la phrase de réussite (« Réservée » / « Demande envoyée ») ; refus du socle redit dans le formulaire, valeurs gardées ;
  - `/reservations/miennes` : à venir et passées, état écrit, motif, « Annuler » (confirmation sans JavaScript dans la carte, comme les signalements) ; marque les avis lus.
- [ ] **Step 2 : lancer** → rouge. **Step 3 : implémenter.** **Step 4 : lancer** `pnpm test` → vert (pages ajoutées au budget).
- [ ] **Step 5 : commit + push** « Réservations : écrans de l'agent ».

### Task 4 : écrans des gestionnaires et « À décider »

**Files :** Create `reservations/a-valider/+page.server.ts|svelte`, `reservations/materiel/+page.server.ts|svelte` (liste, ajouter, modifier stock et nom, retirer) ; tests. Modify `packages/socle/src/casquettes.ts` (compte et contenu « À décider » des casquettes `role:` et `comite:` qui gèrent une ressource, lu dans le `batch` existant), `routes/+page.svelte` (liste « À décider » aussi pour ces casquettes), tests casquettes et accueil.

- [ ] **Step 1 : tests** : À valider liste les demandes (ressource, période, quantité, demandeur, téléphone, mot), « Accepter » et « Refuser » (motif facultatif) d'un geste ; VL en conflit : la réservation acceptée qui chevauche est montrée, « Garder cette demande » / « Garder l'autre » ; casquette Amicale de Romain : `compte` 2 et « À décider » « Bancs · 3 du 12 au 14 nov. · Alice Test » vers `/reservations/a-valider` ; casquette Référent engins idem pour la VL ; l'accueil choisit d'office la casquette qui attend ; Gérer le matériel : ajouter (nom, stock, icône, comité si plusieurs), modifier, retirer avec confirmation ; refus du socle redits.
- [ ] **Step 2 : lancer** → rouge. **Step 3 : implémenter.** **Step 4 : lancer** `pnpm test` → vert, budget tenu (accueil, À valider et chaque geste).
- [ ] **Step 5 : commit + push** « Réservations : à valider, à décider, gérer le matériel ».

### Task 5 : doc, e2e, captures

**Files :** Create `apps/web/e2e/reservations.spec.ts`, `docs/utilisation/reserver-la-vl-ou-du-materiel.md`, `docs/utilisation/valider-une-reservation.md`. Modify `docs/fonctionnel/reservations.md` (réécrite d'après la spec), `docs/technique/socle.md` (tables et règles), `docs/fonctionnel/notifications.md`, index des dossiers de doc, `apps/web/e2e/accessibilite.spec.ts` (pages ajoutées).

- [ ] **Step 1 : e2e** : l'agent `test@exemple.fr` réserve la VL demain 9 h–12 h (acceptée), la voit dans Mes réservations, l'annule ; le super administrateur ajoute « Bancs » (stock 12) ; l'agent en demande 3 ; le super l'accepte depuis À valider ; axe sans violation sur chaque page, aux deux tailles.
- [ ] **Step 2 : lancer** `pnpm exec playwright test e2e/reservations.spec.ts --workers=1` en cage → vert.
- [ ] **Step 3 : doc** à jour.
- [ ] **Step 4 : captures** 390 et 1280, clair et sombre, des nouvelles pages (hors dépôt), regardées et corrigées.
- [ ] **Step 5 : commit + push** « Réservations : doc et tests de bout en bout ».
