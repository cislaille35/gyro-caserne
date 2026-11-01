# Planning d'été, fichier du planning et chef de garde : plan d'exécution

**But :** le chef prépare l'année dans un fichier ; le rôle « Chef d'équipe » devient « Chef de garde » ; le centre règle l'armement de ses engins ; les agents donnent leurs vacances ; l'appli propose l'été (FPT armé), le chef ajuste et publie ; planning, agenda et remplacements suivent.

**Spec :** [`2026-11-01-planning-ete-design.md`](../specs/2026-11-01-planning-ete-design.md). Méthode allégée (`CLAUDE.md`).

## Contraintes

- Une migration `0014` additive, plus le libellé du rôle (`update responsabilite set nom = 'Chef de garde' where systeme = 'chef_equipe' and nom = 'Chef d’équipe'`). L'identifiant interne reste `chef_equipe`.
- Budget : 45 requêtes D1 par page, 100 paramètres liés au plus (listes en JSON). Heure de Paris, moments `AAAA-MM-JJTHH:MM`.
- Téléphone et ordinateur identiques en fonctions : les nouveaux écrans entrent dans `lib/parite.test.ts`.
- Données fictives. Aucune dépendance ajoutée (XLSX : `write-excel-file` et `read-excel-file`, déjà là).

## Tables (0014)

- `reglage_armement` : une ligne par engin (`engin`, `ordre`, `postes` JSON `{ ca2, ca1, ce, cod1, agent }`) ; `niveau_aptitude` : le niveau (`ca2`, `ca1`, `ce`, `cod1`, `cod2`) relié à une aptitude du centre.
- `ete` : `annee`, `debut` et `fin` (jours de relève, première et dernière semaine), `date_limite`, `publiee_le`, `rappel_mois_le`, `rappel_semaine_le`.
- `reponse_ete` (`annee`, `personne_id`, `tout_ete`, `modifiee_le`) ; `vacances_agent` (`id`, `personne_id`, `annee`, `debut`, `fin`).
- `plage_ete` : `annee`, `debut`, `fin`, `ajoutes` et `retires` (JSON d'identifiants) : écarts à l'équipe de base de la semaine, comme la convocation d'une manœuvre.
- `avis_ete` : la cloche (`rappel`, `renfort`, `retire`, `vacances_changees`) avec texte et lien.

## Tâches

1. **Fichier du planning** — `packages/socle/src/planning/fichier.ts` (données, aperçu, application en un batch), `lib/planning/classeur.ts` (écriture/lecture XLSX), écran `/planning/preparer/fichier` (exporter, importer, aperçu, valider). Onglets Semaines, Manœuvres, Vacances scolaires ; Été branché à la tâche 5. Tests : aller-retour, aperçu (« 3 semaines changées… », tour des fêtes), manœuvre annoncée retirée → annulée, erreurs avec la ligne.
2. **Chef de garde** — libellé partout (jeu de départ, `commun.ts`, casquettes, textes, doc, tests), migration `0014` (test de migration).
3. **Armement** — `packages/socle/src/armement.ts` : réglages (lecture, enregistrement, `GERER_LISTES`), calcul pur `fptArme(presents)` (six postes distincts, couverture vers le bas, affectation par recherche exhaustive : six postes au plus), écran `/reglages/armement`.
4. **Vacances des agents** — `packages/socle/src/planning/ete.ts` : période d'été et date limite (Préparer l'année, étape « Été »), `Moi → Mes vacances` (`/moi/vacances`), qui a répondu (chef), rappels un mois puis une semaine avant la date limite (tâche du matin), à ceux sans réponse.
5. **Proposition et publication** — plages (`tranchesDe`) de chaque semaine d'été ; proposition : équipe de base moins vacances, renforts pris parmi les non-vacanciers qui ont le niveau manquant, les moins sollicités d'abord ; plages impossibles signalées. Tableau `/planning/ete` (jours, présents, « FPT armé : oui / non »), ajouter/retirer, publier. Effets : `astreintesDe`, `planningDe`, `astreinteDe`, `agendaDe` lisent la répartition publiée (`personnesDeSemaine`) ; un agent en vacances n'est jamais disponible ; conflits avec les remplacements conclus signalés ; avis aux agents touchés ; changement de vacances après publication → avis au chef. Onglet Été du fichier.
6. **Doc, e2e, captures** — `docs/fonctionnel/planning-d-ete.md`, `docs/utilisation/donner-mes-vacances.md`, décision, `docs/technique/socle.md` ; e2e accessibilité des nouveaux écrans ; captures 390 clair / 1280 sombre.

Puis : revue unique (modèle le plus capable), une vague de corrections, PR prête, CI complète, compte rendu.
