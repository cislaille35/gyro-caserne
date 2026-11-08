# Habillement : plan de construction

> Exécuté en natif par Claude, tâche par tâche, en TDD. Review « base » après la tâche 1, review finale unique à la fin.

**But :** chaque demande de tenue a son suivi, visible de l'agent, traité par le référent habillement depuis sa casquette.

**Conception :** [`docs/superpowers/specs/2026-11-08-habillement-design.md`](../specs/2026-11-08-habillement-design.md) (validée le 08/11/2026).

**Modèles suivis :** anomalies (étapes, fil `anomalie_suivi`, `avis_anomalie`, `À décider`), avis d'été et de remplacement (cloche, `/notifications/ouvrir`, pastille), `casquettes.ts`, `modeles.ts`, `lib/paquets.ts`, conservation des publications (décision 0023).

## Règles de tout le lot

- Règles « Interface » de `CLAUDE.md` ; téléphone d'abord ; AA, clavier.
- Offre gratuite : chaque nouvelle page dans `budget.test.ts` ; hors habillement, aucune requête de plus (le compte de la cloche et de la pastille entre dans la requête existante).
- Données fictives relançables sans doublon.

## Points à surveiller (review)

1. Deux référents prennent la même demande au même instant : un seul gagne (écriture conditionnelle sur l'étape).
2. Geste sur une demande déjà avancée (double clic, vieil onglet) : refus propre, pas d'état incohérent.
3. Un agent ouvre la demande d'un autre par son adresse : 404 s'il n'est ni référent, ni chef, ni adjoint.
4. Le référent part (fin d'attribution) : la demande prise par lui reste reprenable, et « aucun référent » se recalcule.
5. Un texte vide ou très long : refusé ou borné (2 000 caractères).

---

### Tâche 1 : le droit `GERER_HABILLEMENT` et la migration 0022 (seule, review « base »)

- `listes.ts` : `GERER_HABILLEMENT` après `GERER_STOCK`. Libellé dans `apps/web/src/lib/droits.ts`.
- Jeu de départ : le droit, verrouillé, au chef de centre et à l'adjoint ; rôle « Référent habillement » (mission, centre, attribué par le comité du centre, modèle `referent_habillement`, droit `GERER_HABILLEMENT`).
- `pnpm --filter @gyro-caserne/socle migrations` → 0022 : reconstruction de `profil_droit` et `responsabilite_droit` (nouvelle table, copie, suppression, renommage ; `PRAGMA defer_foreign_keys = on` pour D1), puis les mêmes ajouts que le jeu de départ pour les bases déjà remplies. SQL relu à la main.
- Test `packages/socle/test/migration-0022.test.ts` : base à 0021 avec profils, rôles et droits variés ; toutes les lignes (rowid compris) identiques après ; schéma (colonnes, clés, `CHECK`, index) identique hormis la liste ; `GERER_HABILLEMENT` accepté, un droit inconnu refusé ; ajouts relançables.

### Tâche 2 : le socle des demandes (`packages/socle/src/habillement.ts`, migration 0023)

- Tables `demande_habillement` (texte, demandeur, étape, issue, mot, pris par, dates), `habillement_fil` (quoi, texte, par, le), `avis_habillement` (comme `avis_anomalie`).
- Étapes `demandee`, `prise`, `question`, `traitee`, `livree`, `refusee`, `annulee` ; issues `stock`, `commande`.
- Gestes : `demanderTenue`, `prendreEnCompte`, `reprendre`, `poserQuestion`, `repondre` (aussi précision libre), `traiter`, `livrer`, `annuler` ; chacun conditionnel sur l'étape et le droit, en un batch avec le fil et l'avis.
- Qui agit : `GERER_HABILLEMENT` sur le centre. Référents nommés : titulaires d'un rôle hors système qui le porte ; sans eux, chef et adjoint.
- Lectures : `mesDemandes`, `toutesLesDemandes`, `uneDemande` (avec le fil, marque lus ses avis), `habillementADecider`.
- Conservation 24 mois dans la tâche de nuit ; données fictives.

### Tâche 3 : cloche, pastille, `/notifications/ouvrir`

- `avis_habillement` dans le fil, le compte non lu (même requête), l'ouverture et la pastille ; lieu de coupure « habillement ».

### Tâche 4 : les écrans

- Caserne → Habillement ; `/habillement` (demander + mes demandes), `/habillement/[id]` (fil, gestes), `/habillement/toutes` (en cours puis terminées).
- Casquettes : « À décider » du référent (ou « Le centre »), « Ce que ce rôle permet », modèle et icône, domaine « Habillement » des paquets, page « Comités et référents ».
- `budget.test.ts` pour chaque page.

### Tâche 5 : comptes de test, doc, captures, review finale

- Comptes de test : un référent habillement fictif, demandes à plusieurs étapes.
- Doc : `fonctionnel/habillement.md`, deux pages d'utilisation, technique, décision 0025, `comites-et-referents.md`.
- Captures téléphone clair / ordinateur sombre, review finale, CI complète.
