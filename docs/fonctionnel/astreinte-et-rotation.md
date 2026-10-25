# Astreinte et rotation

## À quoi ça sert

Savoir à tout moment qui est d'astreinte ou de garde, pour la semaine en cours comme pour toute l'année.

## Les notions

- **Créneau** : un début, une fin, un **type** et un **titulaire**.
  - Le type est **l'astreinte** (à domicile, avec un délai de départ) ou **la garde postée** (présence au centre).
  - Le titulaire est **une équipe** ou **un agent**.
- **Deux façons de créer les créneaux** :
  1. **Rotation d'équipes** : le centre règle le cycle (jours et heures de prise et de fin, ordre des équipes, une date de référence) et ses **exceptions** (« le vendredi 25 décembre, c'est l'équipe 3 »). C'est le fonctionnement de Laillé : du vendredi 17h30 au vendredi 6h.
  2. **Planning nominatif** : le responsable remplit les créneaux de garde postée à partir des disponibilités déclarées. Il est prévu dans le modèle, mais il sera livré quand un centre en aura besoin.
- **Plafonds** (réglages du centre) : semaines d'astreinte par an, nuits consécutives, heures de garde par an… L'appli **prévient** quand un plafond est dépassé, mais ne bloque pas.

## Ce que voit l'agent

- L'équipe d'astreinte en ce moment et la semaine suivante.
- Ses prochaines semaines d'astreinte.
- Le calendrier de l'année, semaine par semaine, aux couleurs des équipes.

## Les règles

- Les remplacements et les échanges agissent sur les créneaux, quelle que soit la façon dont ces créneaux ont été créés : voir Remplacements et échanges.
- Le nombre d'équipes est libre : l'ordre de rotation suit les équipes du centre.
- Régler le cycle et les exceptions demande le droit `GERER_PLANNING`, donné par défaut au chef de centre.
- Un changement de cycle ne s'applique qu'à partir d'une date choisie. Le passé ne bouge pas.

## Ce que la fonction ne fait pas

- Elle ne remplace pas la disponibilité déclarée au CTA-CODIS, qui fait foi pour l'alerte. L'appli sert à organiser le centre.
- Pas de calcul d'indemnités.

## Exemple

Laillé a 4 équipes, avec une prise le vendredi à 17h30 et une fin le vendredi suivant à 6h. Le vendredi 16 janvier 2026, c'est l'équipe 1. Pour Noël, le chef de centre ajoute une exception : le vendredi 25 décembre, c'est l'équipe 3. La rotation reprend normalement ensuite.
