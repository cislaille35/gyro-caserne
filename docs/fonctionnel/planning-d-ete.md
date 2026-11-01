# Planning d'été

## À quoi ça sert

L'été, beaucoup d'agents partent en vacances. Les chefs gardaient autant que possible les équipes de base et comblaient les manques par des agents d'autres équipes, à la main, dans un tableau. L'appli le fait avec eux : chacun donne ses vacances, l'appli propose une répartition qui **arme le FPT** sur chaque plage, le chef l'ajuste et la publie.

## Les étapes

1. **Ouvrir l'été** (chef, Planning → Préparer l'année → « Été ») : la période, en semaines d'astreinte entières (par défaut de la dernière relève de juin à la dernière d'août), et la date limite (par défaut le 15 mai).
2. **Vacances des agents** : Moi → « Mes vacances » : des périodes du… au…, ou « Je suis disponible tout l'été ». Rappel un mois puis une semaine avant la date limite, seulement à ceux qui n'ont rien saisi. Le chef voit qui a répondu ; sans réponse, un agent compte comme disponible.
3. **Proposer** : plage par plage (nuits de semaine 18 h – 6 h, 24 h le week-end et les fériés), l'équipe de la semaine moins les agents en vacances. Si le FPT n'est pas armé, l'appli ajoute un renfort pris parmi les agents qui ne sont pas en vacances, **ceux qui ont le moins été en renfort cet été d'abord**, tant qu'un renfort comble une place. Les plages impossibles sont signalées : « Nuit du lundi 12 juillet : pas de CA tout engins disponible ».
4. **Ajuster** : le tableau de l'été montre, pour chaque plage, les présents (les renforts marqués) et « FPT armé : oui / non » en texte. Touchez une plage pour ajouter ou retirer un agent.
5. **Publier l'été** : le planning de chacun (vues, carte de l'Accueil), son agenda et les remplacements suivent la répartition. Les renforts sont prévenus (« Vous êtes en renfort de l'Équipe 2 la semaine du vendredi 9 juillet »). Un agent en vacances n'apparaît pas d'astreinte.

## Armer le FPT

Les règles d'armement sont dans Réglages → « Armement des engins » (droit `GERER_LISTES`) :

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

L'onglet « Été » du fichier du planning (voir [Planning de l'année](planning-de-l-annee.md)) donne la répartition : une ligne par agent, une colonne par plage (« 25/06 nuit »), « X » s'il est présent. Relu, il ajoute et retire comme à l'écran.

## Exemple

Équipe 2, semaine du vendredi 25 juin : Gina est en vacances toute la semaine, Bruno (le seul CA tout engins de l'équipe) le lundi. L'appli retire Gina de chaque plage et Bruno du lundi ; elle ajoute un agent par plage, chaque fois celui qui a le moins servi (Alice, puis le chef, puis Hugo…), et le lundi Alice, CA tout engins de l'Équipe 1. Toutes les plages sont armées ; le chef publie, Alice est prévenue de ses trois nuits en renfort.
