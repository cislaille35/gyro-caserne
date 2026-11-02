# Planning d'été, fichier du planning et chef de garde — design

Date : 2026-11-01. Cadré avec le porteur et validé (« c'est ok »). Les points marqués « choix de Claude » sont venus après.

Lot 2 du planning (après le planning de l'année, sa refonte, les remplacements). Méthode allégée (`CLAUDE.md`).

## Pourquoi

Aujourd'hui, les agents donnent leurs dates de vacances, puis les chefs refont à la main un tableau d'été (fichier « Planning été » : agent par agent, jour et nuit) : ils gardent autant que possible les équipes de base, et comblent les manques par des agents d'autres équipes pour pouvoir **armer le FPT**. Et la configuration de l'année se fait écran par écran, alors que le chef voudrait pouvoir la préparer en une fois dans un fichier.

## 1. Fichier du planning (première tâche)

Sur le modèle du fichier de l'effectif (écriture XLSX avec listes déroulantes, lecture, **aperçu avant validation**, erreurs avec la ligne fautive), réservé à `GERER_PLANNING` :

- Planning → Préparer l'année : « Exporter l'année » et « Importer un fichier ».
- Onglets : **Semaines** (numéro, du, au, équipe en liste déroulante) ; **Manœuvres** (date, heure, thème, lieu, équipes : « Toutes » ou « 1, 3 », petit-déjeuner Oui/Non) ; **Vacances scolaires** (nom, du, au) ; **Été** (voir §4 : la répartition, éditable). Les fériés sont calculés, pas dans le fichier.
- Aperçu : « 3 semaines changées, 2 manœuvres ajoutées, 1 modifiée, 1 retirée, Noël passe à l'Équipe 2 », avec l'alerte du tour des fêtes.
- Une manœuvre retirée du fichier est supprimée ; déjà annoncée, elle est marquée « Annulée » et les convoqués prévenus (comme à la main). Année publiée : les changements sont visibles tout de suite. Année vide : l'export donne un modèle avec le roulement calculé.

## 2. Chef de garde (porteur)

Le rôle aujourd'hui appelé « Chef d'équipe » (celui qui dirige une des équipes d'astreinte) devient **« Chef de garde »** partout (jeu de départ, bases existantes par migration qui ne change que le libellé, écrans, textes, doc, notifications). Raison : le **CE (chef d'équipe)** est un emploi opérationnel (il commande une équipe de deux en intervention sous l'autorité du chef d'agrès), donc une **aptitude**, à ne pas confondre. Les attributions existantes ne bougent pas.

## 3. Règles d'armement (porteur, réglables par le centre)

Réglages du centre, par engin, en aptitudes (une personne tient un seul poste) :

| Engin | Équipage par défaut |
|---|---|
| VSAV | 1 CA 1 agrès + 1 CE ou agent gradé + 1 agent (le CE conduit : pas de contrôle de conduite) |
| VTU | comme le VSAV |
| FPT | 1 CA tout engins + au moins 1 COD1 + 2 CE + 2 agents |

L'été vise **le FPT** (porteur) : s'il est armé, les autres le sont ; ce n'est pas une condition pour eux.

- **Six postes distincts** pour le FPT : CA tout engins, conducteur (COD1 au moins), 2 CE, 2 agents ; une personne tient un seul poste.
- **Un agent plus qualifié peut tenir un poste en dessous** de son niveau (porteur) : un CA peut être CE ou agent, un CE peut être agent, un COD2 tient le poste COD1.
- **Seul le FPT est calculé** dans ce lot (choix de Claude) ; VSAV et VTU sont enregistrés dans les réglages, sans calcul. Les libellés d'aptitudes du centre (CA2 / CA1 / CE / COD1…) sont reliés à ces postes dans les réglages (choix de Claude : les noms varient d'un centre à l'autre).

## 4. Été

- **Période d'été** : fixée par le chef dans Préparer l'année, par défaut fin juin → fin août, en semaines d'astreinte entières (vendredi → vendredi).
- **Plages** : les mêmes qu'en temps normal (porteur) : semaine 18 h – 6 h, week-end et fériés 24 h.
- **Vacances des agents** : Moi → « Mes vacances » : périodes du… au… ; ou « Je suis disponible tout l'été ». **Date limite** fixée par le chef (par défaut le 15 mai) ; **rappel** un mois avant puis une semaine avant, seulement à ceux qui n'ont rien saisi. Le chef voit qui a répondu.
- **Proposition** de l'appli, plage par plage : l'équipe de base de la semaine moins les agents en vacances ; si le FPT n'est pas armé, renfort par des agents d'autres équipes : **tout agent qui n'est pas en vacances** sur la plage (porteur ; un agent qui n'a rien saisi compte comme disponible) qui ont l'aptitude manquante, en priorité ceux qui ont le moins été en renfort cet été (équité) ; plages impossibles signalées (« Nuit du 14 juillet : pas de CA disponible »).
- **Ajuster et publier** (chef) : un tableau de l'été (jours en colonnes ; pour chaque plage les présents et « FPT armé : oui / non » en texte) ; ajouter ou retirer un agent sur une plage ; « Publier l'été ».
- **Effets de la publication** : le planning de chacun (vues, carte astreinte, Accueil), l'agenda et les remplacements suivent la répartition d'été ; les agents concernés sont prévenus (« Vous êtes en renfort de l'équipe 2 la semaine du 10 juillet »). Un agent en vacances n'apparaît pas d'astreinte.

## Remplacements et changements pendant l'été (choix de Claude)

- Celui qui valide reste le chef de garde de l'équipe de la semaine. Un agent en vacances n'est jamais proposé comme remplaçant.
- Les remplacements déjà conclus sont gardés ; l'appli signale au chef ceux qui entrent en conflit avec la répartition d'été.
- Après publication, les modifications du chef s'appliquent tout de suite et seuls les agents touchés sont prévenus. Un agent peut encore changer ses vacances : le chef est alerté (« Romain a changé ses vacances : à revoir »). La proposition automatique ne se relance qu'avant la publication.

## Hors périmètre

Préparer l'année suivante (lot 3) ; disponibilités hors été ; composition minimale hors été.

## Contraintes

Migrations additives (sauf le libellé du rôle, accordé par le porteur). Budget de requêtes. Heure de Paris. Données de test fictives (les fichiers réels du porteur ne vont pas dans le dépôt). Téléphone et ordinateur identiques en fonctions (exigence du porteur), soignés aux deux tailles, AA (tableau de l'été lisible au lecteur d'écran, jamais la couleur seule).

## Laissé au constructeur

Forme des tables, algorithme exact de la proposition (simple et explicable), présentation du tableau d'été au téléphone.

## Reprise avant fusion (2026-11-02, validée par le porteur)

Le porteur trouve les écrans « à plat, longue liste de configuration ». Interface d'abord, même canevas que « Préparer l'année » (étapes, rangées, panneaux).

1. **Page Été**
   - Résumé en tête, chiffres réels : « Été 2027 · Proposé · 10 semaines · FPT armé partout · 4 agents en vacances · 3 sans réponse ».
   - Parcours en étapes avec barre de progression : Période → Vacances → Répartition → Publier.
   - Période : une phrase (« Du ven. 25 juin au jeu. 2 sept. · vacances avant le 15 mai ») et « Modifier », qui ouvre un panneau (fenêtre modale, comme celle des manœuvres) ; plus de champs de date affichés en permanence.
   - Vacances : trois rangées avec leur compte (Ont répondu, Sans réponse, Disponibles tout l'été), qu'on déplie pour les noms ; « Relancer » sur les sans-réponse (rappel immédiat à eux seuls, une fois par jour au plus).
   - Répartition : une rangée compacte par semaine avec une pastille d'état écrite (« ✓ FPT armé 7/7 » ou « ⚠ 2 plages à revoir »), semaines à revoir en tête ; « Recalculer la proposition » dans un menu secondaire, avec confirmation (il efface les ajustements).
   - Publier : bouton fixe en bas (barre collante), toujours visible ; état « Publiée » affiché ensuite.
2. **Armement des engins** : une rangée par engin (« VSAV · 3 postes : CA 1 agrès, CE, agent » ; postes à zéro masqués) ; « Modifier » ouvre un panneau avec des boutons − / + (accessibles : nom du poste et valeur annoncés) ; la correspondance des aptitudes repliée sous « Correspondance des aptitudes ».
3. **Panneau d'une plage** : les présents avec leur **poste** (« CA tout engins : Manon Faure · Conducteur : Ursule Lemoine · CE : … · Agent : … », le renfort signalé) ; FPT non armé : le poste manquant en tête (« Il manque : 1 CE »), et « Ajouter un agent » met d'abord ceux qui ont l'aptitude manquante.
4. **Garde-fous sur un planning publié** (socle, TDD)
   - Une semaine **passée ou en cours** ne change plus d'équipe (`changerSemaines`, et l'import du fichier) : refus clair.
   - Changer l'équipe d'une semaine **après publication** prévient les agents des deux équipes (« La semaine du 10 juillet passe de l'Équipe 2 à l'Équipe 3 »), par le fil et le téléphone.
   - Avant de valider ce changement, l'écran montre les **remplacements conclus ou en cours** de la semaine qui seront touchés ; après, leurs personnes sont prévenues.

Exigence : téléphone et ordinateur identiques en fonctions (écrans au test de parité).

Choix de Claude, à valider :
- « Ont répondu » compte ceux qui ont donné des vacances ; les trois rangées font le total.
- La relance du jour est lue dans le journal (action `relancer_ete`) : pas de colonne nouvelle.
- Le poste de chacun est celui de la meilleure répartition calculée (une place libre d'abord, sans déplacer personne) ; un présent sans poste est « En plus ».
- Avis du changement de semaine : un nouveau genre d'avis « Planning » (`semaine`) dans la table des avis d'été ; la migration 0014, pas encore déployée, est réécrite.
- Semaine « commencée » : son premier moment d'astreinte est passé ; la règle ne vaut que pour une année publiée.
- Les − / + de l'armement demandent JavaScript (comme le reste du panneau).
