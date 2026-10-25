# Disponibilités et absences

## À quoi ça sert

Savoir qui sera vraiment là pendant l'astreinte, pour que la composition des gardes soit juste et que les chefs voient les manques à l'avance.

## Les notions

- **Absence** : un agent d'astreinte ne sera pas là. On la déclare par dates, par semaines ou par tranche horaire. Son **motif** (liste ouverte : absence, vacances, formation…) n'est visible que par l'agent et par ceux qui ont le droit `VOIR_MOTIFS_ABSENCE` sur son équipe.
- **Renfort prévu** : un agent qui n'est pas d'astreinte se déclare disponible sur une tranche (« mardi de 19h à 6h »). Il compte alors dans la composition de ce créneau.

## Ce que voit l'agent

- Ses absences et ses renforts à venir, qu'il peut modifier ou supprimer.
- Les renforts prévus sur la semaine de son équipe.

## Les règles

- Une absence retire l'agent de la composition sur la tranche concernée. Un renfort l'y ajoute.
- Les chefs d'équipe sont prévenus quand une absence rend un engin surveillé incapable de partir : voir Composition des gardes.
- Partout, l'écran affiche : **« Indicatif pour l'organisation du centre. La disponibilité qui fait foi reste celle déclarée au CTA. »**

## Ce que la fonction ne fait pas

- **Pas de statut « disponible maintenant » en temps réel** : c'est le rôle de l'outil du CTA-CODIS, et le doubler créerait une double saisie et des écarts.
- Pas de calcul d'indemnités, ni de suivi des conventions avec les employeurs.

## Exemple

Paul, de l'équipe 3, n'est pas d'astreinte cette semaine, mais il est libre mardi soir. Il déclare un renfort de 19h à 6h. La nuit de mardi, l'équipe d'astreinte manquait d'un conducteur : avec Paul, qui est COD1, le VSAV peut partir. Le chef d'équipe voit le renfort dans la composition.
