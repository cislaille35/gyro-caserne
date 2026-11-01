# Composition des gardes

## À quoi ça sert

Savoir, pour chaque moment de l'astreinte, **quels engins peuvent partir** avec les agents disponibles, et prévenir à l'avance quand un engin ne peut pas partir.

## Les notions

- **Places d'un type d'engin** (liste ouverte, réglée par le centre) : chaque place demande une aptitude.
  - VSAV : 1 chef d'agrès (CA1), 1 conducteur (COD1), 1 équipier (SAP).
  - FPT : 1 CA2, 1 conducteur (COD1), 1 chef d’équipe (CE), 3 équipiers (INC).
- **Équivalences d'aptitudes**, réglées par le centre : une aptitude peut en couvrir d'autres. Par exemple, un CA2 peut tenir une place de CA1 ou de CE.
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
- Les places et les équivalences se règlent avec le droit `GERER_LISTES`.
- Le calcul suit les tranches horaires : un agent absent de 6h à 18h ne compte pas sur ce créneau.

## Ce que la fonction ne fait pas

- Elle ne désigne pas qui monte dans quel engin au départ en intervention : c'est le rôle du CTA-CODIS et du chef d'agrès.
- Elle ne cherche pas la meilleure combinaison pour armer plusieurs engins ensemble. Ce sera peut-être une option plus tard.

## Exemple

Pour la nuit de mardi, l'équipe 2 compte 9 agents disponibles, mais le seul COD1 est absent. Résultat : VSAV ✗, FPT ✗ (« il manque un conducteur »), VTU ✓ (le VTU accepte un COD2). Le chef de l'équipe 2 est prévenu, et il cherche un renfort conducteur.
