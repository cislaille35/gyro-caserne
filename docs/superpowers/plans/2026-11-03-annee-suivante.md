# Préparer l'année suivante : plan d'exécution

**Spec :** [`2026-11-03-annee-suivante-design.md`](../specs/2026-11-03-annee-suivante-design.md). Méthode allégée (`CLAUDE.md`).

## Tâches

1. **Calculs purs** (`packages/socle/src/planning/suivante.ts`, tests `planning-suivante.test.ts`) : ordre qui continue, réglage des fêtes (échanges, le moins de semaines, compromis), place dans le mois, tour de rôle.
2. **Socle** : `proposerAnnee` (lecture, état des équipes) et `accepterProposition` (un seul batch, journal, refus si déjà un roulement).
3. **Écran** : action `proposition`, bouton et panneau (`lib/planning/PropositionAnnee.svelte`), résumé (`lib/planning/preparer.ts`), parité, budget.
4. **Doc et e2e** : fonctionnel, utilisation, technique ; `planning.spec.ts`, `accessibilite.spec.ts` (CI seulement).
5. **Captures** (390 clair, 1280 sombre), revue unique, une vague de corrections.
6. **Vérification complète** en CI (`gh workflow run verifier.yml`), compte rendu dans la PR.
