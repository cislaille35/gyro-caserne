# 0028 — Les insignes de grade, dessinés par nous d'après l'arrêté

- **Contexte** : l'appli connaît le grade de chaque agent (table `grade`, import de l'effectif), pas son insigne. Le porteur veut l'insigne à côté du nom.
- **Sources** :
  - Arrêté du 8 avril 2015 fixant les tenues, uniformes, équipements, insignes et attributs des sapeurs-pompiers (NOR INTE1505052A, JORF n° 94 du 22 avril 2015), modifié par les arrêtés du 4 avril 2017 et du 29 novembre 2024 (INTE2404583A) : https://www.legifrance.gouv.fr/loda/id/LEGITEXT000034390133 ;
  - son annexe II (A.1 « Insignes et identification de grade », A.9 « Galonnage »), non publiée sur Légifrance, lue dans une copie non officielle : https://fr.readkong.com/page/arrete-du-8-avril-2015-modifie-fixant-les-tenues-9449598 ;
  - sources secondaires : Wikipédia, « Liste des grades et appellations des sapeurs-pompiers français » (et ses dessins CC0 de Wikimedia Commons), Matmut (grades des sapeurs-pompiers).
- **Ce qui distingue les grades** (insigne de poitrine, carré noir) :

  | Grade | Galons |
  |---|---|
  | Sapeur (2e classe), jeune sapeur-pompier | aucun |
  | Sapeur 1re classe, caporal, caporal-chef | 1, 2, 3 obliques rouges (inclinés à 22°) |
  | Sergent, sergent-chef | 1, 3 obliques argent bordés de rouge |
  | Adjudant, adjudant-chef | 1 droit à raie rouge : or, argent |
  | Lieutenant, capitaine, commandant, colonel | 2, 3, 4, 5 droits argent |
  | Lieutenant-colonel | 5 droits : argent, or, argent, or, argent |

- **Choix** :
  - des dessins SVG génériques à nous (`apps/web/src/lib/ui/insignes.ts`, `Insigne.svelte`), lisibles à 20-24 px, couleurs par jetons (`--insigne-*`, contraste vérifié en clair et en sombre) ; aucune image copiée ;
  - le grade reconnu **par son libellé**, sans accents, majuscules ni traits d'union : rien à régler, pas de migration ; un grade saisi à la main sous un autre nom n'a pas d'insigne ;
  - affiché à côté du nom dans la liste des agents, sur la fiche et dans « Comités et référents » ; pas ailleurs (messages, murs) : « une information une fois ». Le grade reste écrit sur la fiche et dans la liste ; dans « Comités et référents », l'insigne est nommé par le grade pour les lecteurs d'écran.
- **À vérifier sur l'annexe officielle** : le groupement des galons des officiers supérieurs (commandant 1 + 3 selon Wikipédia, dessinés ici à intervalles égaux) ; un éventuel référentiel national des insignes pris en application de l'arrêté de 2024 ; les insignes du service de santé (SSSM, fond de couleur) et des jeunes sapeurs-pompiers, hors de ce lot.
- **Validé par** : le porteur, 11/11/2026 (cadrage du lot) ; dessins à valider dans la PR.
