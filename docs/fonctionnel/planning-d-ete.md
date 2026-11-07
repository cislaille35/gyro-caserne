# Planning d'été

## À quoi ça sert

L'été, beaucoup d'agents partent en vacances. Les chefs gardaient autant que possible les équipes de base et comblaient les manques par des agents d'autres équipes, à la main, dans un tableau. L'appli le fait avec eux : chacun donne ses vacances, l'appli propose une répartition qui **arme le FPT** sur chaque plage, le chef l'ajuste et la publie.

## Les étapes

L'écran de l'été (chef, Planning → Préparer l'année → « Été ») commence par un **résumé** (« Proposé · 10 semaines · FPT armé partout · 4 agents en vacances · 3 sans réponse ») et suit quatre étapes, avec une barre de progression : **Période → Vacances → Répartition → Publier**. Le bouton « Publier l'été » est à la dernière étape, en bas de l'écran ; avant, « Publier › » y conduit.

1. **Période** : une phrase (« Du ven. 25 juin au jeu. 2 sept. · vacances avant le 15 mai ») ; « Modifier » ouvre un panneau. Par défaut, de la dernière relève de juin à la dernière d'août, en semaines d'astreinte entières, et le 15 mai. « Ouvrir la saisie des vacances » ouvre l'été.
2. **Vacances** : les agents donnent leurs vacances dans Moi → « Mes vacances » (des périodes du… au…, ou « Je suis disponible tout l'été »). Rappel un mois puis une semaine avant la date limite, seulement à ceux qui n'ont rien saisi. Le chef voit trois rangées avec leur compte, qu'on déplie pour les noms : **Ont répondu** (avec des vacances), **Sans réponse**, **Disponibles tout l'été**. « Relancer » envoie tout de suite un rappel aux seuls sans-réponse, une fois par jour au plus. Sans réponse, un agent compte comme disponible.
3. **Répartition** : « Proposer la répartition » calcule plage par plage (nuits de semaine 18 h – 6 h, 24 h le week-end et les fériés) l'équipe de la semaine moins les agents en vacances. Si le FPT n'est pas armé, l'appli ajoute un renfort pris parmi les agents qui ne sont pas en vacances, **ceux qui ont le moins été en renfort cet été d'abord**, tant qu'un renfort comble une place. Une rangée par semaine, avec son état écrit (« ✓ FPT armé 7/7 » ou « ⚠ 2 plages à revoir ») ; les semaines à revoir viennent en tête. Les remplacements à revoir sont repliés au-dessus, avec leur nombre (« ⚠ 9 remplacements à revoir »), et rappelés à l'étape Publier. Une plage s'ouvre dans un panneau : chaque présent avec son **poste** (CA tout engins, conducteur, CE, agent ; « En plus » s'il n'en tient aucun ; les renforts marqués), ce qui manque en tête (« Il manque : 1 CE »), et « Ajouter un agent » propose d'abord **ceux qui peuvent combler le manque**. « Recalculer la proposition » est dans « Plus d'actions » et demande confirmation : il efface les ajustements.
4. **Publier** : un récapitulatif, puis « Publier l'été ». Le planning de chacun (vues, carte de l'Accueil), son agenda et les remplacements suivent la répartition. Les renforts sont prévenus (« Vous êtes en renfort du Groupe B la semaine du vendredi 9 juillet »). Un agent en vacances n'apparaît pas d'astreinte.

## Sur l'Accueil

Pour le chef de centre et son adjoint (casquette « Le centre »), une rangée de « À décider » mène à l'écran de l'été :

- « Été 2027 à ouvrir » : du 1er mars à la fin d'août, tant que l'été de l'année n'est pas ouvert ;
- « Été 2027 : 3 plages à revoir » : proposé, pas encore publié, et des plages où le FPT n'est pas armé ;
- « Été 2027 à publier » : la date limite des vacances est passée et l'été n'est pas publié.

L'été déjà ouvert pour l'an prochain (dès l'automne) compte de la même façon. Publié : plus de rangée.

## Groupes A, B, C, D

**À la publication de l'été**, les agents lisent **Groupe A, B, C, D** au lieu d'« Équipe N » sur les semaines d'été : planning de chacun (semaine, mois, année), carte astreinte de l'Accueil, agenda, notifications de renfort. Le chef les voit **dès la proposition** dans le tableau de l'été et l'onglet « Été » du fichier. Hors été, rien ne change.

La correspondance est fixe : les équipes actives, **dans l'ordre du roulement du centre** (Équipe 1 → Groupe A, Équipe 2 → Groupe B…). L'équipe de base reste utilisée en interne pour construire la proposition ; les autres écrans (préparer l'année, effectif, remplacements, prise de garde) gardent le nom des équipes.

## Armer le FPT

Les règles d'armement sont dans Réglages → « Armement des engins » (droit `GERER_LISTES`) : une rangée par engin (« VSAV · 3 postes : CA 1 agrès, CE, agent ») ; « Modifier » ouvre un panneau avec des boutons − et + par poste. La correspondance des aptitudes est repliée en dessous.

| Engin | Équipage par défaut |
|---|---|
| VSAV | 1 CA 1 agrès + 1 CE + 1 agent (le CE conduit) |
| VTU | comme le VSAV |
| FPT | 1 CA tout engins + 1 conducteur (COD1 au moins) + 2 CE + 2 agents |

- Une personne tient **un seul poste** ; l'appli cherche la meilleure répartition des présents sur les postes.
- Un agent **plus qualifié tient un poste en dessous** : un CA tout engins peut être CA 1 agrès ou CE, un CA 1 agrès peut être CE, un COD2 tient le poste COD1 ; tout le monde peut être agent.
- Les aptitudes du centre sont reliées à chaque niveau (CA2, CA1, CE, COD2, COD1 par défaut) : les noms varient d'un centre à l'autre.
- Seul le **FPT** est calculé : s'il est armé, les autres le sont. VSAV et VTU sont enregistrés pour plus tard.
- Un agent inapte temporaire peut être présent mais ne tient aucun poste.

## Après la publication

- Un changement du chef vaut tout de suite ; seul l'agent touché est prévenu.
- Un agent peut encore changer ses vacances : le chef de centre et son adjoint sont prévenus (« Romain Martin a changé ses vacances : à revoir »). La proposition automatique ne se relance plus.
- Les remplacements déjà conclus sont gardés ; l'écran de l'été signale ceux que la répartition contredit.
- Celui qui valide un remplacement reste le chef de garde de l'équipe de la semaine, même pour un renfort. Un agent en vacances n'est jamais proposé comme remplaçant.

## Le fichier

L'onglet « Été » du fichier du planning (voir [Planning de l'année](planning-de-l-annee.md)) donne la répartition : une ligne par agent, avec son groupe, une colonne par plage (« 25/06 nuit »), « X » s'il est présent. Relu, il ajoute et retire comme à l'écran.

## Exemple

Équipe 2, semaine du vendredi 25 juin : Gina est en vacances toute la semaine, Bruno (le seul CA tout engins de l'équipe) le lundi. L'appli retire Gina de chaque plage et Bruno du lundi ; elle ajoute un agent par plage, chaque fois celui qui a le moins servi (Alice, puis le chef, puis Hugo…), et le lundi Alice, CA tout engins de l'Équipe 1. Toutes les plages sont armées ; le chef publie, Alice est prévenue de ses trois nuits en renfort.
