# Astreinte et rotation

> Déjà livré : la rotation des équipes à la semaine, ses heures (semaine, week-end, fériés) et les semaines changées, réglées dans [Planning de l'année](planning-de-l-annee.md) ; la plaque d'astreinte de l'accueil. À venir : la garde postée, le planning nominatif et les plafonds.

## À quoi ça sert

Savoir à tout moment qui est d'astreinte ou de garde, pour la semaine en cours comme pour toute l'année.

## Les notions

- **Créneau** : un début, une fin, un **type** et un **titulaire**.
  - Le type est **l'astreinte** (à domicile, avec un délai de départ) ou **la garde postée** (présence au centre).
  - Le titulaire est **une équipe** ou **un agent**.
- **Deux façons de créer les créneaux** :
  1. **Rotation d'équipes** : le centre règle le cycle (jours et heures de prise et de fin, ordre des équipes, une date de référence) et ses **exceptions** (« le vendredi 25 décembre, c'est l'équipe 3 »). C'est le fonctionnement de Laillé : du vendredi 18 h au vendredi 6 h. Le cycle (jours, heures, référence) est posé dans `centres/<id>/centre.ts` à l'installation, pas dans l'appli ; l'ordre des équipes de l'année et les semaines changées se règlent dans « Préparer l'année ».
  2. **Planning nominatif** : le responsable remplit les créneaux de garde postée à partir des disponibilités déclarées. Il est prévu dans le modèle, mais il sera livré quand un centre en aura besoin.
- **Heures d'astreinte** : en semaine, seulement les heures réglées par le centre (à Laillé, de 18 h à 6 h) ; le samedi, le dimanche et les jours fériés, 24 h sur 24. Les remplacements se découpent en tranches qui finissent à 6 h : une nuit de semaine, ou une garde de 24 h le week-end et les fériés.
- **Plafonds** (à venir, réglages du centre) : semaines d'astreinte par an, nuits consécutives, heures de garde par an… L'appli **prévient** quand un plafond est dépassé, mais ne bloque pas.

## Ce que voit l'agent

- Sur l'accueil, la plaque d'astreinte aux couleurs de l'équipe : « Mon astreinte en cours », « Ma prochaine astreinte » (avec le compte des jours) ou l'équipe d'astreinte de la semaine.
- Au planning, « Me faire remplacer » et « Ajouter à mon agenda » sous sa plaque.
- Le planning aux couleurs des équipes, en vues « Semaine », « Mois », « Année » et « Équipes ».

## Les règles

- Les remplacements et les échanges agissent sur les créneaux, quelle que soit la façon dont ces créneaux ont été créés : voir [Remplacements et échanges](remplacements-et-echanges.md).
- Le nombre d'équipes est libre : l'ordre de rotation suit les équipes du centre.
- Régler l'ordre des équipes et changer une semaine demande le droit `GERER_PLANNING`, donné par défaut au chef de centre. Une année publiée reste modifiable : chaque changement se voit tout de suite.
- Changer le cycle lui-même (jours, heures) passe par `centres/<id>/centre.ts`, pas par l'appli.

## Ce que la fonction ne fait pas

- Elle ne remplace pas la disponibilité déclarée au CTA-CODIS, qui fait foi pour l'alerte. L'appli sert à organiser le centre.
- Pas de calcul d'indemnités.

## Exemple

Laillé a 4 équipes, avec une prise le vendredi à 18 h et une fin le vendredi suivant à 6h. Le vendredi 16 janvier 2026, c'est l'équipe 1. Pour Noël, le chef de centre change la semaine du 25 décembre : c'est l'équipe 3. La rotation reprend normalement ensuite.
