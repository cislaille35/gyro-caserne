# Échanges chaleureux — plan d'exécution

> **Pour les sous-agents :** sous-skill requis : superpowers:subagent-driven-development (ou superpowers:executing-plans). Étapes à cocher (`- [ ]`).

**But :** une page Échanges rangée en sections et colorée, des murs qui disent qui les voit, des publications plus vivantes, des sondages datés.

**Architecture :** le socle (`packages/socle`) gagne deux colonnes de sondage, une icône de comité, les aperçus de la liste et de quoi enrichir les publications (audience, rôle et couleur de l'auteur, comptes de lecture). L'appli (`apps/web`) refait la liste, le mur, la carte de publication et met le formulaire sur sa propre page.

**Technos :** SvelteKit 3, Svelte 5, Drizzle sur D1, Vitest (`node:sqlite` dans le socle), Playwright + axe pour l'accessibilité.

**Spec :** [`docs/superpowers/specs/2026-10-29-echanges-chaleureux-design.md`](../specs/2026-10-29-echanges-chaleureux-design.md). Maquettes : `docs/superpowers/specs/2026-10-29-echanges-chaleureux/*.dc.html` (styles inline à reprendre en CSS avec les jetons de `apps/web/src/app.css`).

## Contraintes globales

- `CLAUDE.md` du dépôt : français partout, TDD, code simple, commentaires rares, rien de propre à un centre, aucune dépendance ajoutée.
- Budget : 45 requêtes au plus par page (`apps/web/src/routes/budget.test.ts`). Un `base.batch([...])` compte pour 1.
- Pas de colonnes de même nom issues de tables jointes dans un `batch` (D1 n'en garde qu'une).
- Migrations **additives** seulement : `pnpm --filter @gyro-caserne/socle exec drizzle-kit generate` après modification de `schema.ts`. Jamais de réécriture d'une migration déjà fusionnée (0000 à 0003).
- RGAA AA : cibles de 44 px ; contrastes AA en clair et en sombre ; aucune information portée par la seule couleur ; « réduire les animations » respecté ; animation décorative de moins de 2 s, une à la fois, seulement au niveau Vivant.
- Niveaux de vie : `locals.affichage.niveau` (`sobre` | `equilibre` | `vivant`) ; `gyroSelonNiveau(niveau)` dans `apps/web/src/lib/gyro/niveau.ts` donne `{ visible, anime }`.
- Commandes lourdes en cage : `systemd-run --user --scope -q -p MemoryMax=1100M -p MemorySwapMax=900M timeout 900 <cmd>`, `PATH=$HOME/.local/lib/node/bin:$PATH`. Pour `pnpm check` du web : `NODE_OPTIONS=--max-old-space-size=950`.
- Commit et push à chaque étape verte. La PR est ouverte en brouillon dès le premier push.

## Points de vigilance

1. **Sondage sans dates** (publié avant ce lot) : il reste ouvert, s'affiche sans dates et n'est jamais « Fermé ». Test dans la tâche 1.
2. **Vote à la seconde de clôture** : refusé dès `maintenant >= cloture` (à la minute, comme les événements). Test dans la tâche 1.
3. **Mur sans aucune publication** : la tuile affiche « Rien de publié pour l'instant » sans planter, et la carte « Le centre » existe quand même. Test dans la tâche 3.
4. **Auteur parti ou super administrateur** : visage gris avec initiales (« SA » pour le super administrateur), pas de rôle, pas d'erreur. Test dans la tâche 4.
5. **Super administrateur sans fiche** sur la liste : pas de section « Mes groupes » vide. Tout ce qu'il voit va dans « Supervision », et « Aujourd'hui » n'affiche que les anniversaires. Test dans la tâche 5.

---

### Tâche 1 : sondage daté (socle)

**Fichiers :**
- Modifier : `packages/socle/src/schema.ts` (table `publication`), `packages/socle/src/actions/publications.ts` (`exigerSondage`, `publier`, vue du sondage), `packages/socle/src/actions/interactions.ts` (`voter`), `packages/socle/src/a-ne-pas-manquer.ts` (sondages), `packages/socle/src/comptes-de-test.ts` (dates aux deux sondages de démo)
- Créer : la migration générée `packages/socle/migrations/0004_*.sql`
- Tests : `packages/socle/test/actions-publications.test.ts`, `actions-interactions.test.ts`, `a-ne-pas-manquer.test.ts`, `migration-0004.test.ts` (sur le modèle de `migration-0002.test.ts`)

**Interfaces :**
- Produit :
  - `DonneesPublication.sondage` devient `{ question: string; reponses: string[]; ouverture: string; cloture: string }` (dates `AAAA-MM-JJTHH:MM`, heure de Paris) ;
  - colonnes `sondageOuverture: text('sondage_ouverture')` et `sondageCloture: text('sondage_cloture')`, facultatives ;
  - `PublicationVue.sondage` gagne `ouverture: string | null`, `cloture: string | null`, `etat: 'avenir' | 'ouvert' | 'ferme'`. Quand `etat === 'ferme'`, `resultats` est donné à tous.

- [ ] **Étape 1 : tests qui échouent.**
  - `publier` refuse : sans `ouverture` ou `cloture` → `DonneeInvalide('Dates du sondage manquantes')` ; `cloture <= ouverture` → `'Clôture avant l’ouverture'` ; `cloture > ouverture + 365 jours` → `'Clôture dans plus d’un an'` ; sur un événement, `cloture > evenement.debut` → `'Clôture après le début de l’événement'`.
  - `lireMur` : un sondage avec `ouverture` dans le futur → `etat 'avenir'`, `resultats` à `null` même pour l'auteur ; après la clôture → `etat 'ferme'`, `resultats` pour un lecteur qui n'a pas voté.
  - `voter` refuse avant l'ouverture (`'Sondage pas encore ouvert'`) et dès `maintenant.slice(0,16) >= cloture` (`'Sondage fermé'`). Comme `voter` reçoit aujourd'hui `aujourdhui`, sa signature devient `voter(base, acteur, id, reponse, maintenant: string)` ; adapter les appels dans `apps/web/src/lib/server/gestes-mur.ts` et `comptes-de-test.ts`.
  - Sondage ligne en base sans dates (insérée directement) : `etat 'ouvert'`, vote accepté.
  - `aNePasManquer` : un sondage pas encore ouvert ou fermé n'est pas listé.
  - Migration 0004 : appliquée sur une base en 0003 avec un sondage, elle garde la ligne et laisse les deux colonnes nulles.
- [ ] **Étape 2 :** lancer les tests ciblés (`npx vitest run test/<fichier>` dans `packages/socle`) et vérifier qu'ils échouent pour la bonne raison.
- [ ] **Étape 3 :** implémenter, puis générer la migration. L'état se calcule ainsi : `ouverture === null` donne « ouvert » ; `maintenant < ouverture` donne « avenir » ; `maintenant >= cloture` donne « fermé ». La comparaison se fait sur 16 caractères.
- [ ] **Étape 4 :** tous les tests du socle et `tsc --noEmit` passent.
- [ ] **Étape 5 :** commit « Sondages datés : ouverture et clôture ».

### Tâche 2 : icône de comité (socle et Réglages)

**Fichiers :**
- Modifier : `packages/socle/src/schema.ts` (`comite.icone: text('icone')`), `packages/socle/src/actions/comites.ts` (`creerComite`, `modifierComite`, `listerComites`), `packages/socle/src/icones.ts`, `apps/web/src/routes/reglages/comites/[id]/+page.svelte` et `+page.server.ts`, `nouveau/` (même chose), `packages/socle/src/index.ts`
- Créer : la migration `0005_*.sql`
- Tests : `packages/socle/test/actions-comites.test.ts`, `icones.test.ts`, `apps/web/src/routes/reglages/comites/[id]/page.server.test.ts`

**Interfaces :**
- Produit : `iconeDuComite(c: { icone: string | null; theme: string }): NomIcone`. L'icône choisie si elle est dans `NOMS_ICONES`, sinon `coeur` pour le thème `amicale`, `etoile` pour `centre`, `groupe` pour les autres. Export depuis l'index. `modifierComite(..., champs: { nom?; theme?; icone?: NomIcone | null })`, même droit qu'aujourd'hui.
- Consomme : `ChoixIcone.svelte` (déjà dans `apps/web/src/routes/reglages/`).

- [ ] **Étape 1 : tests qui échouent.** `iconeDuComite` (les 4 cas) ; `modifierComite` enregistre `icone` et refuse une icône inconnue (`DonneeInvalide('Icône inconnue')`) ; l'action du formulaire Réglages enregistre l'icône choisie.
- [ ] **Étape 2 :** vérifier l'échec.
- [ ] **Étape 3 :** implémenter, générer la migration et ajouter le choix de l'icône sur les pages du comité (« Icône du mur », avec `ChoixIcone`).
- [ ] **Étape 4 :** les tests du socle, des réglages et `tsc` passent.
- [ ] **Étape 5 :** commit « Comités : une icône pour leur mur ».

### Tâche 3 : aperçus de la liste (socle)

**Fichiers :**
- Créer : `packages/socle/src/apercus.ts`, `packages/socle/test/apercus.test.ts`
- Modifier : `packages/socle/src/index.ts`

**Interfaces :**
- Consomme : `mursEtAppartenances`, `estMembre` (`murs.ts`), `auteurVu` (`actions/publications.ts`), `iconeDuComite` (tâche 2).
- Produit :

```ts
export type Apercu = {
	cle: CleMur;
	// Membre naturel (estMembre) ; faux pour un mur seulement supervisé.
	membre: boolean;
	icone: NomIcone | 'maison' | null; // null pour une équipe (on affiche son numéro)
	couleur: string | null; // couleur de l'équipe, sinon null
	numero: number | null; // ordreRotation de l'équipe
	derniere: { auteur: string; texte: string; creeLe: string } | null; // auteur « Prénom », texte sur une ligne, 80 caractères au plus
};
export async function apercusDesMurs(base: Base, acteur: Acteur, aujourdhui: string): Promise<Apercu[]>;
```

  Deux requêtes au plus : celle de `mursEtAppartenances`, puis un `batch` qui lit la dernière publication de chaque mur (`id in (select max(id) from publication where mur in (...) group by mur)`), le prénom des auteurs, les couleurs et numéros des équipes et les icônes des comités.

- [ ] **Étape 1 : tests qui échouent.** L'ordre suit celui de `mursDe`. Un mur vide a `derniere === null`. Le texte est tronqué à 80 caractères avec « … ». Le super administrateur a `membre: false` partout. Le chef de centre est `membre: true` sur Le centre et Vie du centre, `false` sur une équipe dont il n'est pas membre. Une équipe a sa couleur et son numéro. Un comité a `iconeDuComite`. `base.requetes` augmente de 2 au plus.
- [ ] **Étape 2 :** vérifier l'échec.
- [ ] **Étape 3 :** implémenter.
- [ ] **Étape 4 :** les tests et `tsc` passent.
- [ ] **Étape 5 :** commit « Aperçus des murs pour la liste ».

### Tâche 4 : publications enrichies et audience du mur (socle)

**Fichiers :**
- Modifier : `packages/socle/src/actions/publications.ts` (`lireMur`, `vuesDe`, `PublicationVue`), `packages/socle/src/murs.ts` (compte des membres)
- Tests : `packages/socle/test/actions-publications.test.ts`

**Interfaces :**
- Produit :
  - `lireMur` renvoie en plus `audience: number`, le nombre de membres naturels du mur ce jour-là. C'est la règle de `suiviPublication` : des agents ni partis, ni suspendus, ni extérieurs ; pour une équipe, ses membres en cours et son chef ; pour un comité, ses membres en cours.
  - `PublicationVue.auteur` devient `{ prenom; nom; couleur: string | null; role: string | null }` :
    - `couleur` : celle de l'équipe en cours de l'auteur ;
    - `role` : le premier rôle tenu parmi « Chef de centre », « Chef de centre adjoint » (affiché « Adjoint ») et « Chef d'équipe », sinon `null`.
  - `PublicationVue.priseDeConnaissance` devient `{ le: string | null; faites: number; attendues: number }` : le nombre de membres naturels qui ont confirmé, sur `audience`.
  - `PublicationVue.evenement.presents` : les 3 premiers présents, `{ prenom: string; nom: string; couleur: string | null }[]`.
- Tout passe dans le `batch` de lectures de `vuesDe` et dans celui de `lireMur` : `lireMur` reste à 3 requêtes (test existant).

- [ ] **Étape 1 : tests qui échouent.**
  - `audience` vaut 3 sur un mur d'équipe de 2 membres et 1 chef ; sur Le centre, elle compte les agents avec accès, sans les extérieurs.
  - `auteur.role === 'Chef de centre'` et `auteur.couleur` égale celle de son équipe.
  - Le super administrateur comme auteur donne `{ prenom: 'Super', nom: 'administrateur', couleur: null, role: null }`.
  - `faites` et `attendues` sur une annonce dont 1 lecteur sur 3 a confirmé.
  - `presents` est limité à 3.
  - Nombre de requêtes de `lireMur` inchangé.
- [ ] **Étape 2 :** vérifier l'échec.
- [ ] **Étape 3 :** implémenter. Mettre en commun avec `suiviPublication` la lecture des membres naturels, en une fonction de `murs.ts` qui rend des lectures à placer dans un batch : pas de copie de la règle.
- [ ] **Étape 4 :** tous les tests du socle et `tsc` passent, y compris ceux de l'appli qui lisent `PublicationVue` (`pnpm --filter @gyro-caserne/web test`).
- [ ] **Étape 5 :** commit « Publications : auteur, audience et comptes de lecture ».

### Tâche 5 : la liste Échanges (appli)

**Fichiers :**
- Modifier : `apps/web/src/routes/echanges/+layout.server.ts` et `+layout.svelte`, `apps/web/src/routes/echanges/+page.svelte`
- Créer : `apps/web/src/lib/ui/PastilleMur.svelte` (icône ou numéro sur la teinte du mur, 48 px ou 28 px)
- Tests : `apps/web/src/routes/echanges/layout.server.test.ts`, `layout.test.ts`, `apps/web/src/lib/ui/composants.test.ts`

**Interfaces :**
- Consomme : `apercusDesMurs` (tâche 3), `aNePasManquer` (déjà chargé : `nouveautes`, `annonces`, `evenements`), `anniversairesDuJour`, `gyroSelonNiveau`, le composant `Gyro`.
- Produit : `data.sections` de la mise en page, `{ centre: TuileMur | null; groupes: TuileMur[]; autres: TuileMur[]; supervision: TuileMur[] }`, et `data.aujourdhui`, `{ anniversaires: { prenom; nom }[]; evenement: { id; cle; titre; debut } | null }`. `TuileMur` = `Apercu & { nom; type; lectureSeule; nouveautes: number; aConfirmer: number }`.
  - `groupes` : l'équipe de la personne, puis Vie du centre, puis les comités avec nouveautés.
  - `autres` : les comités sans nouveauté, seulement s'il y en a plus de deux ; sinon ils restent dans `groupes`.
  - `supervision` : les murs où `membre === false`, hors Le centre et Vie du centre.

- [ ] **Étape 1 : tests qui échouent.**
  - `load` range les sections comme ci-dessus. Le super administrateur a `groupes` vide et tout dans `supervision` (vigilance 5).
  - `aConfirmer` sur Le centre égale le nombre d'annonces de `aNePasManquer` venues de `centre`.
  - `aujourdhui.evenement` est le premier événement convoqué sans réponse.
  - Le rendu montre, dans l'ordre, « Aujourd'hui au centre » (seulement s'il y a une ligne), « Le centre », « Mes groupes », « Autres comités » (dans un `<details>`), « Supervision » (dans un `<details>`).
  - Le badge « Officiel » est écrit en texte. Une tuile sans publication affiche « Rien de publié pour l'instant » (vigilance 3).
  - Au niveau Sobre, aucun Gyro.
  - Le bouton « Écrire » mène à `/echanges/publier`. « Souhaiter » mène à `/echanges/publier?mur=vie&texte=Joyeux%20anniversaire%20<prénom>%20!`.
  - Le budget de `/echanges` reste ≤ 45.
- [ ] **Étape 2 :** vérifier l'échec.
- [ ] **Étape 3 :** implémenter selon la maquette 1. La phrase d'en-tête :
  - au niveau Vivant, une variante parmi 3 choisie par le jour de l'année : « Le café est encore chaud. », « Rien ne vous a échappé : Gyro veille. », « La caserne bavarde, voici l'essentiel. » ;
  - précédée de « N nouveautés depuis votre dernière visite. » (« Rien de neuf depuis votre dernière visite. » si N = 0) ;
  - aux niveaux Équilibré et Sobre, cette première phrase seule.
- [ ] **Étape 4 :** les tests du web (`pnpm --filter @gyro-caserne/web test`) et `pnpm check` (en cage) passent.
- [ ] **Étape 5 :** commit « Échanges : liste rangée en sections, tuiles colorées ».

### Tâche 6 : le mur et ses cartes (appli)

**Fichiers :**
- Modifier : `apps/web/src/routes/echanges/[mur]/+page.svelte` et `+page.server.ts`, `apps/web/src/routes/echanges/[mur]/[id]/+page.svelte`, `apps/web/src/lib/ui/Publication.svelte`
- Créer : `apps/web/src/lib/ui/Visage.svelte` (initiales sur couleur, texte foncé ou clair selon la luminance pour un contraste AA, `aria-hidden`), `apps/web/src/lib/ui/TuileDate.svelte`, `apps/web/src/lib/ui/Sondage.svelte` (sorti de `Publication.svelte`)
- Tests : `apps/web/src/lib/ui/composants.test.ts`, `apps/web/src/routes/echanges/[mur]/page.test.ts` (ou le test de page existant)

**Interfaces :**
- Consomme : `lireMur` (tâche 4 : `audience`, `auteur.couleur`, `auteur.role`, `priseDeConnaissance.faites/attendues`, `evenement.presents`), `PublicationVue.sondage.etat/ouverture/cloture` (tâche 1), `apercusDesMurs` pour l'icône et la couleur du mur (ou les mêmes règles), `gyroSelonNiveau`.
- Produit : la phrase d'audience, `phraseAudience(type, nom, audience): string`, dans `apps/web/src/lib/murs.ts` (créer). Elle sert aussi à la tâche 7 :
  - `centre` et `vie` : « Visible par tous les agents du centre (N) » ;
  - `equipe` : « Visible par les N membres de l'équipe 1, le chef et l'adjoint » ;
  - `comite` : « Visible par les N membres de l'Amicale, le chef et l'adjoint ».

  Toujours dans ce fichier, `phraseDuMur(type, nom)` donne les phrases de la spec (« Les infos officielles du chef et de l'adjoint »…).

- [ ] **Étape 1 : tests qui échouent.**
  - `phraseAudience` (4 cas, singulier « le membre » quand N = 1) et `phraseDuMur`.
  - La bande du mur montre le nom, la phrase et l'audience en texte.
  - Une annonce à confirmer montre « 12 sur 38 ont confirmé » et le bouton « J'ai pris connaissance ».
  - Un événement montre la tuile date en texte lisible (`aria-label` « jeudi 5 novembre ») et les trois boutons avec `aria-pressed` et leur mot.
  - Un bravo montre « Applaudir » à la place de « J'aime », et Gyro (tenue `victoire`) seulement si `gyroSelonNiveau(niveau).visible`.
  - Un sondage montre « Ouvre le … », « Ouvert » ou « Fermé » et ses dates ; fermé, il montre les résultats et aucun bouton de vote.
  - L'auteur super administrateur s'affiche sans planter (vigilance 4).
  - Le formulaire n'est plus en bas du mur : un lien « Publier dans <mur> » mène à `/echanges/publier?mur=<cle>`, seulement si `mur.peutPublier`.
- [ ] **Étape 2 :** vérifier l'échec.
- [ ] **Étape 3 :** implémenter selon la maquette 2. Les confettis du bravo sont un SVG décoratif immobile, absent au niveau Sobre. Au niveau Vivant, Gyro s'anime une fois à l'arrivée, comme `GyroDuMoment` (5 s au plus, arrêté par « réduire les animations »).
- [ ] **Étape 4 :** les tests du web et `pnpm check` passent.
- [ ] **Étape 5 :** commit « Murs : bande d'audience et cartes par type ».

### Tâche 7 : la page Publier (appli)

**Fichiers :**
- Créer : `apps/web/src/routes/echanges/publier/+page.server.ts`, `+page.svelte`, `page.server.test.ts`
- Modifier : `apps/web/src/lib/ui/FormulairePublication.svelte` (choix du mur, genre en 4 tuiles, dates du sondage), `apps/web/src/lib/server/formulaire-mur.ts` (`Valeurs.ouverture`, `Valeurs.cloture`, `Valeurs.mur` ; messages d'erreur des nouveaux refus), `apps/web/src/routes/echanges/[mur]/+page.server.ts` (l'action `publier` y est retirée)

**Interfaces :**
- Consomme : `mursDe` (pour ne garder que les murs où `peutPublier`), `publier` (tâche 1 : dates du sondage obligatoires), `phraseAudience` et l'audience. Pour l'audience des murs proposés, une seule lecture groupée : ajouter à `murs.ts` `audiences(base, cles, aujourdhui): Promise<Map<CleMur, number>>`, sur la même règle que la tâche 4.
- Produit : `GET /echanges/publier?mur=<cle>&texte=<texte>`, qui préremplit le mur et le texte (ce dernier tronqué à 4000 caractères). L'action `?/publier` redirige en 303 vers `/echanges/<cle>#publication-<id>` en cas de succès, et réaffiche les valeurs et erreurs en cas de refus.

- [ ] **Étape 1 : tests qui échouent.**
  - Seuls les murs où l'on peut publier sont proposés. Avec un `mur` inconnu ou interdit en paramètre, aucun mur n'est présélectionné.
  - « Annonce » n'apparaît que si le mur choisi est modéré par la personne. Le formulaire sans JavaScript montre « Annonce » avec la mention « réservé aux modérateurs du mur », et le refus serveur donne un message clair.
  - L'ouverture est préremplie avec maintenant et la clôture avec maintenant + 7 jours (début de l'événement pour un événement).
  - Les refus de la tâche 1 donnent chacun un message sur le champ `sondage`.
  - Succès : redirection vers le mur.
  - Un envoi trop lourd donne 413, comme aujourd'hui.
  - Budget ≤ 45.
- [ ] **Étape 2 :** vérifier l'échec.
- [ ] **Étape 3 :** implémenter selon la maquette 3. La phrase « Visible par … » sous le choix du mur change avec le choix (en JavaScript ; sans JavaScript, elle est affichée sous chaque choix). Le bouton dit « Publier dans <mur> » (sans JavaScript : « Publier »).
- [ ] **Étape 4 :** les tests du web et `pnpm check` passent.
- [ ] **Étape 5 :** commit « Publier : une page à part, le choix du mur et des sondages datés ».

### Tâche 8 : ordinateur, accessibilité, doc

**Fichiers :**
- Modifier : `apps/web/src/routes/echanges/+layout.svelte` (trois colonnes à 1280 px et plus), `apps/web/e2e/accessibilite.spec.ts` (pages `/echanges`, un mur de chaque sorte, `/echanges/publier`, aux deux tailles), `docs/fonctionnel/salons.md`, `docs/utilisation/` (créer `comment-creer-un-sondage.md`), `docs/technique/` (migrations 0004 et 0005, nouvelles fonctions du socle)

**Interfaces :**
- Consomme : `data.aujourdhui` (tâche 5) et les 3 prochains événements convoqués (`aNePasManquer().evenements.slice(0, 3)`).

- [ ] **Étape 1 : tests qui échouent.** Accessibilité Playwright sur ces pages, à 390 et 1280 px, en clair et en sombre, au niveau Vivant et avec « réduire les animations ». La colonne « À venir » est présente à 1280 px.
- [ ] **Étape 2 :** vérifier l'échec en local s'il est rapide ; sinon pousser et lire la CI.
- [ ] **Étape 3 :** implémenter selon la maquette 5. Entre 1024 et 1279 px, la colonne de droite passe au-dessus du mur.
- [ ] **Étape 4 :** la CI est au vert.
- [ ] **Étape 5 :** commit « Échanges à l'ordinateur, accessibilité et doc ».
