# Préparer l'année suivante (lot 3 du planning)

Cadré et validé par le porteur.

## But

Dans Préparer l'année, pour une année sans roulement, « **Partir d'une proposition** » pré-remplit l'année **en brouillon**. Le chef retouche, puis publie comme aujourd'hui. Droit : `GERER_PLANNING`. Mêmes fonctions au téléphone et à l'ordinateur.

## La proposition

1. **Roulement** : continue celui de l'année précédente, sans rupture à la relève de janvier. L'appli ajuste la fin d'année (semaines changées) pour donner Noël et le Nouvel An aux équipes dont c'est le tour, d'après l'historique (`fetes`, équipe qui l'a tenue il y a le plus longtemps ou jamais). Si plusieurs réglages sont possibles, celui qui change le moins de semaines. Si les deux fêtes sont impossibles à satisfaire, l'appli le dit clairement et garde le meilleur compromis.
2. **Manœuvres** : reprises de l'année précédente, à la même place dans le mois (le 2e dimanche de mars reste le 2e dimanche de mars), même heure, thème, lieu, petit-déjeuner ; mêmes équipes, ou le même tour de rôle quand c'est un roulement évident ; les annulées ne sont pas reprises. Modifiables ; rien n'est annoncé avant la publication de l'année (mécanique existante).
3. **Repères** : fériés calculés (existant) ; vacances scolaires à saisir ou importer : pas de reprise, un rappel dans le résumé si aucune période n'est saisie.
4. **État des équipes**, en tête : effectif à la date de début d'année et armement du FPT seule (`armement.ts`) : « Équipe 3 : 6 agents, il manque 1 CE ». **On signale seulement** : aucun déplacement d'agent proposé ; lien vers Agents et Nominations.
5. **Résumé avant d'accepter** : « 52 semaines · Noël : Équipe 2 · Nouvel An : Équipe 4 · 11 manœuvres reprises · Équipe 3 incomplète ». Accepter écrit le brouillon d'un seul bloc.

## Refus et cas limites

- L'année a déjà un roulement : refus, rien n'est écrasé, message clair (y compris deux acceptations simultanées).
- L'année précédente n'a pas de planning : le roulement de base (référence du centre), sans manœuvres.

## Écran

Un panneau ouvert par l'adresse (`?proposition=1`), sur le canevas existant : état des équipes, roulement et fêtes, manœuvres repliées, résumé, « Accepter ». Pas de migration : tout tient dans `annee_planning`, `semaine_changee` et `manoeuvre`.

## Choix à faire valider (les plus simples)

- Ajuster la fin d'année, c'est **échanger** des semaines entre équipes : chaque équipe garde son nombre de semaines. Écraser une semaine changerait moins de lignes, mais serait injuste.
- Une équipe ne tient pas les deux fêtes, sauf si elles tombent dans la même semaine.
- Ordre de priorité : fêtes dans le tour, puis pas de semaines de suite pour une équipe, puis le moins de semaines changées, puis le plus près des fêtes.
- Compromis : le réglage qui s'écarte le moins du tour ; à égalité, Noël passe avant le Nouvel An.
- Dernière semaine changée : si le roulement redonnerait la même équipe à la relève de janvier, on passe à la suivante.
- « Tour de rôle évident » : la suite des équipes convoquées (hors « tout le centre ») se répète à l'identique, vue au moins deux fois.
- Une manœuvre 5e dimanche d'un mois qui n'en a que 4 cette année-là : le dernier dimanche.
- Une manœuvre dont les équipes n'existent plus : tout le centre. Une date déjà passée (année en cours) : pas reprise.
- Une équipe archivée sort du roulement ; une équipe nouvelle s'ajoute à la fin.
