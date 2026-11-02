# Météo et vigilance — design

Date : 2026-11-02. Validé par le porteur dans la conversation. Lot d'ambiance, petit et indépendant.

## Pourquoi

Le MVP avait une météo qui faisait vivre l'Accueil (ambiance animée, Gyro qui change de tenue). On la reprend, et on prépare la vigilance Météo-France, utile pour des pompiers.

## Ce qu'on fait

1. **Source** : Open-Meteo (gratuit, sans clé ; modèles Météo-France possibles), position du centre lue dans `centres/<id>/centre.ts` (`position`, déjà présente), jamais en dur. Mention visible « Météo : Open-Meteo » (licence CC-BY).
2. **Mise à jour** : une fois par heure, **sans nouveau déclencheur planifié** (l'offre gratuite en limite le nombre) : la tâche qui tourne chaque minute (file des notifications) fait la mise à jour quand la dernière donnée a plus d'une heure. Donnée rangée en base. Si l'API ne répond pas, on garde la dernière donnée (moins de 6 h) ou rien.
3. **Accueil** : à côté de « Bonjour … », une ligne courte (« 12 °C · averses · rafales 45 km/h ») ; une **ambiance animée discrète** reprise du MVP (`cis-laille/src/lib/components/MeteoAnim.svelte`, `src/lib/meteo.ts` : 9 ambiances — clair, nuageux, pluie, orage, neige, vent ≥ 60 km/h, brouillard, chaleur ≥ 30 °C, gel ≤ 0 °C), coupée si « réduire les animations » ou affichage Sobre.
4. **Gyro** : `tenueDuMoment` (`apps/web/src/lib/gyro/moment.ts`) gagne une entrée météo : pluie → parapluie, orage → inquiet, neige ou gel → hiver, chaleur → été, vent → vent (tenues existantes ; en créer seulement si une manque). Les autres moments (anniversaire, fête…) gardent leur priorité actuelle ; la météo passe avant la tenue par défaut.
5. **Jamais** d'animation ni d'humour sur un écran d'urgence ; la météo est une information, jamais une décision.

## Vigilance Météo-France (socle seulement — porteur)

- Socle prêt : lecture de la vigilance du département du centre (`centre.ts` : département, ex. `35`), niveau et phénomènes pour aujourd'hui et demain ; **bandeau en tête de l'Accueil dès l'orange** (« Vigilance orange orages, aujourd'hui »), lien vers vigilance.meteofrance.fr ; **notification à tous au passage au rouge** (une fois par épisode).
- La clé du portail Météo-France (API Vigilance, gratuite, licence Etalab 2.0) est un **secret** (`VIGILANCE_CLE`, jamais dans le dépôt). **Sans clé, tout fonctionne sans le bandeau.** Le porteur créera le compte plus tard : Claude le lui rappellera.
- Le format exact de l'API n'étant pas vérifiable sans clé : lecture isolée dans une fonction testée sur un exemple de réponse documenté (citer la source dans la doc), tolérante (en cas de doute, rien n'est affiché).

## Contraintes

Budget de requêtes de l'Accueil tenu (une lecture). Téléphone et ordinateur identiques en fonctions. AA : l'ambiance est décorative (`aria-hidden`), la ligne météo et le bandeau sont du texte ; jamais la couleur seule pour la vigilance (le mot « orange » / « rouge » écrit).

## Hors périmètre

Scène du camion du MVP, prévisions sur plusieurs jours, météo dans le planning.
