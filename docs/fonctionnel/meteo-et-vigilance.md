# Météo et vigilance

L'Accueil dit le temps qu'il fait au centre, et prévient quand Météo-France place le département en vigilance orange ou rouge. C'est une information, jamais une décision : l'alerte opérationnelle reste celle du SDIS.

## La météo du centre

- Sous « Bonjour … », une ligne courte : « 12 °C · averses · rafales 45 km/h » (les rafales à partir de 40 km/h), suivie de la mention « Météo : Open-Meteo » (licence CC BY 4.0).
- Derrière l'en-tête, une ambiance animée discrète : pluie, orage, neige, vent (rafales de 60 km/h ou plus), brouillard, chaleur (30 °C ou plus), gel (0 °C ou moins), beau temps ou nuages. Elle disparaît en affichage Sobre ; immobile si le téléphone demande de réduire les animations.
- Gyro s'habille selon le temps : parapluie sous la pluie, orage, bonnet et écharpe pour la neige ou le gel, lunettes de soleil à la chaleur, penché par le vent, dans le brouillard. Les fêtes, la nuit et le p'tit-déj passent avant ; la météo passe avant les calendriers et la saison.
- La position du centre est lue dans `centres/<id>/centre.ts` (`position`). Le relevé est refait toutes les heures. Si Open-Meteo ne répond pas, le dernier relevé reste affiché jusqu'à 6 h, puis plus rien.

## La vigilance Météo-France

- Pour le département du centre en métropole (`departement` dans `centre.ts`, par exemple `35`), aujourd'hui et demain. La vigilance « vagues-submersion » du littoral (zones côtières à part) et l'outre-mer ne sont pas lus.
- Dès l'orange, un bandeau en tête de l'Accueil, une ligne par jour : « Vigilance orange orages, aujourd'hui », « Vigilance rouge vent violent, demain », avec le lien vers vigilance.meteofrance.fr. Le niveau est toujours écrit en toutes lettres.
- Au passage au rouge, tous les agents reçoivent une notification sur leur téléphone (« Vigilance rouge »), une seule fois par épisode : tant que le rouge dure, rien n'est renvoyé.
- Il faut la clé de l'API Vigilance de Météo-France (secret `VIGILANCE_CLE`, voir [installer un centre](../technique/installer-un-centre.md)). Sans elle, tout le reste fonctionne, sans bandeau.

## Exemple

Mardi matin, orages annoncés sur l'Ille-et-Vilaine. L'Accueil montre « Vigilance orange orages, aujourd'hui » en tête, « 17 °C · orage · rafales 70 km/h » sous « Bonjour Alice », et Gyro sous l'orage. Le soir, Météo-France passe le département au rouge pour le lendemain : chaque agent reçoit « Vigilance rouge orages, demain. Suivez les consignes de Météo-France. »
