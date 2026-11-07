# Composition des gardes

> Déjà livré : les règles d'armement par engin (Réglages → « Armement des engins », droit `GERER_LISTES`) et le calcul « FPT armé » du [planning d'été](planning-d-ete.md) : seul le FPT est calculé, car s'il est armé, les autres le sont. Le reste de cette page est à venir.

## À quoi ça sert

Savoir, pour chaque moment de l'astreinte, **quels engins peuvent partir** avec les agents disponibles, et prévenir à l'avance quand un engin ne peut pas partir.

## Les notions

- **Postes d'un engin** (réglés par le centre) : CA tout engins, CA 1 agrès, CE, conducteur, agent. Au départ :
  - VSAV et VTU : 1 CA 1 agrès, 1 CE (qui conduit), 1 agent.
  - FPT : 1 CA tout engins, 2 CE, 1 conducteur, 2 agents.
- **Niveaux** : le centre relie ses aptitudes à cinq niveaux (Chef d'agrès tout engins, Chef d'agrès 1 agrès, Chef d'équipe, Conducteur COD2, Conducteur COD1). Un agent plus qualifié tient un poste en dessous : un CA tout engins tient aussi CA 1 agrès ou CE ; un CA 1 agrès, CE ; un COD2, conducteur. Tout agent tient « agent ».
- **Agents disponibles** à un moment donné : l'équipe d'astreinte, moins les absents, plus les remplaçants et les renforts. Seuls les agents au statut « opérationnel » comptent, et uniquement avec leurs aptitudes **valides à cette date**.

## La règle : un engin à la fois

Chaque engin est testé **séparément**, avec tous les agents disponibles : *ses places peuvent-elles toutes être tenues, chaque agent n'en occupant qu'une ?*

C'est un **OU**, pas un ET. À Laillé, une équipe d'environ 10 personnes peut faire partir le VSAV, ou le FPT, ou le VTU, même si elle ne peut pas armer les trois en même temps.

Un engin indisponible (anomalie bloquante, réparation, prêt) n'est pas testé.

## Ce que voit l'agent

- Pour chaque nuit ou créneau de la semaine : ✓ ou ✗ par engin, et ce qui manque (« FPT : il manque un conducteur COD1 »).
- Les chefs sont prévenus quand un engin surveillé ne peut pas partir, en particulier après une absence ou un remplacement.

## Les règles

- Par défaut, tous les engins du centre sont surveillés. Le centre peut en retirer un.
- Les postes et les niveaux se règlent avec le droit `GERER_LISTES`.
- Le calcul suit les tranches horaires : un agent absent de 6h à 18h ne compte pas sur ce créneau.

## Ce que la fonction ne fait pas

- Elle ne désigne pas qui monte dans quel engin au départ en intervention : c'est le rôle du CTA-CODIS et du chef d'agrès.
- Elle ne cherche pas la meilleure combinaison pour armer plusieurs engins ensemble. Ce sera peut-être une option plus tard.

## Exemple

Pour la nuit de mardi, l'équipe 2 compte 9 agents disponibles, mais son seul conducteur est absent. Résultat : FPT ✗ (« il manque un conducteur »), VSAV ✓ et VTU ✓ (leur CE conduit). Le chef de l'équipe 2 est prévenu, et il cherche un renfort conducteur.
