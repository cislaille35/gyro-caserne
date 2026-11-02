# 0016 — Météo et vigilance

- **Contexte** : le MVP avait une météo qui faisait vivre l'Accueil ; la vigilance Météo-France est utile à des pompiers ([la spec](../superpowers/specs/2026-11-02-meteo-design.md)).
- **Choix** :
  - **Open-Meteo** (`/v1/forecast`, choix automatique du meilleur modèle, Météo-France en France) : gratuit, sans clé, 10 000 appels par jour pour un usage non commercial, licence CC BY 4.0 (mention « Météo : Open-Meteo » avec lien sur l'Accueil). Nous en faisons 24 par jour.
  - **Aucun nouveau déclencheur planifié** : la tâche de chaque minute regarde toutes les dix minutes (à 5, 15, 25…) si le relevé a plus d'une heure. En cas d'échec, l'ancien relevé est gardé et redemandé dix minutes plus tard ; au-delà de 6 h, plus rien n'est affiché.
  - **Une table `releve`** (migration `0016`, additive) : une ligne par source (`meteo`, `vigilance`), données en JSON. L'Accueil la lit en une requête.
  - **Vigilance** : API `DPVigilance/v1/cartevigilance/encours` du portail Météo-France (licence Etalab 2.0), clé en en-tête `apikey`, secret `VIGILANCE_CLE`. Format lu d'après le descriptif technique de Météo-France (`product.periods[]` : `echeance` J ou J1, `timelaps.domain_ids[]` : `domain_id`, `max_color_id` de 1 vert à 4 rouge, `phenomenon_items[]` : `phenomenon_id` de 1 à 9, `phenomenon_max_color_id`) et des exemples publics (forum Home Assistant France). Sans échéance J ou J1, ou au moindre écart, rien n'est affiché ; une réponse refusée (clé invalide : 401) est notée dans les journaux du worker, sans la clé. À vérifier avec une vraie clé. Métropole seulement ; les zones côtières (vagues-submersion) ne sont pas lues.
  - **Rouge** : un envoi au téléphone de tous les agents ayant accès (pas de ligne dans la cloche), une fois par épisode (`rouge` gardé dans le relevé).
  - **Gyro** : `tenueDuMoment(date, ambiance)` ; la météo passe après les fêtes, la nuit et le p'tit-déj, avant les calendriers et la saison. Orage → la tenue « orage », brouillard → « brouillard » (tenues existantes).
- **Pourquoi** : gratuit, aucune dépendance, une lecture de plus sur l'Accueil, un seul déclencheur planifié comme avant.
- **Validé par** : spec validée par le porteur ; décisions de mise en œuvre à valider (PR #39).
