# Refonte de l'interface, deuxième passe : direction B

## Intention

L'appli est propre, mais son habillage ressemble à beaucoup d'interfaces générées par IA, et les écrans ont divergé : plusieurs versions du même bouton, du même champ, du même retour. C'est l'interface qui fait adopter l'appli.

On corrige tous les écrans d'un seul mouvement, puis on écrit la charte graphique à partir du résultat, pour ne pas retomber dans ces travers.

Le porteur a comparé trois directions sur l'accueil, le Planning et Échanges, et a choisi **B, Neutre**, le 08/11/2026. Comparaison : https://claude.ai/artifact/QEvsWwLmQa34ia3zd7p3Un

## Objectifs

- Remplacer l'habillage décidé en 0008 par la direction B, sur tous les écrans, téléphone et ordinateur, clair et sombre.
- Une seule version de chaque composant commun.
- Traiter tous les défauts des inventaires ([téléphone](inventaire-tel.md), [ordinateur](inventaire-ordi.md)), après vérification de chacun.
- Finir par un skill de charte graphique, qui guide tout futur écran.

## Hors sujet

- Aucune nouvelle fonction, aucune migration, aucune route supprimée.
- Pas de nouvelle dépendance. Les graisses de police viennent de `@fontsource`, déjà présent.
- Pas de nouvelle teinte de marque : le rouge pompier, l'anthracite, le jaune et les couleurs d'équipe restent.

## À éviter absolument

- Perdre l'accessibilité : RGAA, niveau AA, clavier, mode contrasté, « réduire les animations ». Les tests restent verts sans en affaiblir aucun sur le fond.
- Remplacer les sélecteurs de date, d'heure et de liste du téléphone par des contrôles refaits à la main.
- Une animation sur un écran d'urgence ou de l'humour ajouté dans l'urgence.
- Un écran qui perd une information ou une action.

## La direction B

**Ce qui reste, car c'est l'identité :** l'en-tête anthracite, la bande de marquage, le Barlow Condensed des titres, la plaque d'astreinte en à-plat d'équipe, la tuile de date, Gyro, les couleurs d'équipe.

**Ce qui change :**

| Élément | Avant | Après |
|---|---|---|
| Fond en clair | Crème `#f6f3ef` | Gris clair `#eef0f3` |
| Traits et blocs de choix en clair | Beiges | `--trait-doux: #d9dee3`, `--segment-fond` et `--menu-actif: #e1e5ea` |
| Cartes | Blanches à ombre douce | Blanches et plates, `--ombre-carte` sans effet, bord transparent gardé pour le mode contrasté |
| Titre de groupe (`.titre-groupe`) | Petit, majuscules espacées, gris | Barlow Condensed 700, 1,125 rem, casse normale, à l'encre |
| Compteur de groupe | Pastille pleine | Nombre écrit, en `--doux` |
| Icônes de rôle, comité, ressource | Tuiles pastel de 11 teintes | Icône seule, à l'encre |
| Signe d'alerte d'une ligne | Tuile ambre | Icône seule, en `--statut-alerte-texte` |
| Boutons et liens d'action | Halo coloré dessous | Aucun halo |
| « Aujourd'hui au centre », Bravo | Dégradés | À-plat `--surface` |
| Bandes colorées à gauche | Une vingtaine | Retirées, sauf les citations de message ; l'équipe se dit par un carré de couleur et son nom |

Le thème sombre garde ses couleurs de fond et de surface. Il suit le reste du tableau. Une carte reste un bloc par groupe de lignes (`ListeRangees`), mais rien d'autre n'est mis en carte par habitude.

La place laissée par une tuile retirée est reprise : les textes d'une même liste s'alignent, avec ou sans icône.

## Les lots

Dans cet ordre, un à la fois, car ils touchent les mêmes écrans.

1. **Socle.** Les jetons de B. Barlow 700 chargé (aujourd'hui le navigateur fabrique un faux gras). Un seul bouton principal et un seul secondaire. Un seul style de champ et de radio. Les `<select>` passent par `Choix`, et les trois pages d'import ont un champ fichier dessiné. Une échelle de texte, d'espacement et de rayons en jetons, à la place des valeurs en dur.
2. **Mouvement.** Retour à l'appui commun (`:active`, `scale(0.97)`, 160 ms, `ease-out`). Ouverture de `Panneau` et des `<dialog>` avec `@starting-style`, 240 ms, `cubic-bezier(0.32, 0.72, 0, 1)`. Tirer pour actualiser sans animer `height`. Glisser pour répondre : déclenchement aussi à la vitesse (`distance / durée > 0.11`). Jetons de courbes et de durées. Le survol réservé aux appareils qui en ont un.
3. **Cartes et listes.** Une carte par groupe (Nominations, fiche agent, Réservations, profils, zones). Tuiles, icônes sans rapport avec leur objet, bandes.
4. **Hiérarchie des actions.** Publications, Aptitudes, fiches, engin. Le rouge réservé à l'action principale d'usage courant ; les actions rares descendent, les actions graves sont marquées.
5. **Navigation.** Une forme de retour, une de dépliage, une place pour le bouton d'action. Des icônes distinctes pour Accueil et Caserne ; le casque ne doit plus ressembler à une cloche de restaurant.
6. **Ordinateur.** Largeurs de contenu réduites à quelques valeurs, colonnes vides ou déséquilibrées, fil des murs, planning annuel, liste des réglages.
7. **Écrans à reprendre.** Préparer l'année, Été, suivi d'une publication, rôle en lecture seule, formulaires d'engin.
8. **Texte.** Infos répétées, descriptions redondantes, formats d'heure et de date, élisions, espaces insécables, retours à la ligne.
9. **Charte.** Le skill, à partir de l'état final, et la mise à jour des règles (voir plus bas).

## Règles à mettre à jour

Les tests et les règles actuels fixent l'ancien habillage. Ils changent en même temps que le code, jamais après :

- `apps/web/src/formes.test.ts` (ombre des cartes), `jetons.test.ts` (tuiles, contrastes), `lib/ui/composants.test.ts` ;
- `CLAUDE.md`, section « Interface », et `docs/technique/interface.md` ;
- une nouvelle décision `docs/decisions/0026-…`, qui remplace le complément de 0008 pour le fond, les cartes et les tuiles, et dit que le porteur a choisi B le 08/11/2026.

## La charte

Un skill du projet, écrit en dernier : ce qu'est l'identité, les jetons, les composants à utiliser, les règles du mouvement, les marqueurs à éviter, les écrans modèles. Il renvoie à `app.css` et aux composants au lieu de recopier leurs valeurs, et une règle vérifiable va dans un test plutôt que dans le skill.

Écrans modèles relevés par les revues, à reconfirmer après les corrections : Caserne, Connexion et la liste des messages au téléphone ; l'accueil agent, la conversation et Habillement à l'ordinateur.

## Choix laissés au constructeur

- Le découpage fin de chaque lot, et les noms des jetons.
- La façon de distinguer une action grave, tant que ce n'est pas par la seule couleur.
- Le traitement précis de chaque ligne des inventaires. Une ligne fausse ou contraire à ce document est écartée, et dite dans le compte rendu du lot.

## Décisions de Claude, à valider

- **Écrans d'urgence :** l'appli n'en a aucun aujourd'hui. La prise de garde est un geste de routine, et le bandeau de vigilance ne rend pas la page entière urgente : il n'ajoute ni mouvement ni humour. Le retour à l'appui est donc une règle commune, sans mécanisme d'exclusion. La charte garde l'interdit pour un futur écran d'urgence.
- **Rouge :** la règle du lot 4 vise les boutons et les liens d'action. Les surfaces rouges vues dans la direction B restent : en-tête du mur « Le centre », plaque de la prise de garde, compteurs, repère d'onglet.
- **Vérification :** tests d'accessibilité en CI à chaque lot, captures des écrans principaux par lot, et une passe complète sur tous les écrans à la fin, avant le lot 9, en croisant les thèmes et les tailles.
- **Icônes fausses des ressources (Bancs, Barnum…) :** nouvelles valeurs par défaut et icônes ajoutées à la liste. Aucune ligne existante n'est modifiée : un chef peut changer l'icône d'une ressource déjà créée.
- **Météo de l'accueil :** au niveau Équilibré, plus de mouvement. Au niveau Vivant, elle s'arrête après 10 s, comme Gyro (RGAA 13.8).
- **Skill de charte :** versionné dans `.claude/skills/charte-gyro/`, ce qui fait entrer ce seul skill dans le dépôt.

## Décisions du porteur (08/11/2026)

- **Travail et livraison :** le dispositif de la décision 0022, repris sur la branche `fonction/refonte-ui`, avec une nouvelle décision qui l'acte. Une branche et une PR par lot vers cette branche, en squash, fusionnée par Claude après review et CI verte. Le porteur suit sur la version d'essai quand il le veut, juge l'ensemble, et valide la PR vers `main`.
- **Version d'essai :** d'abord une petite PR sur `main`, à valider par le porteur, qui remet `preview_urls` pour le centre `exemple` seul. `deployer-refonte.yml` est repris pour `fonction/refonte-ui`, puis retiré avant la fusion finale.
- **Gel :** sur `main`, plus de chantier d'écran ni de migration jusqu'à la fin de la refonte. Seuls passent les correctifs urgents, reportés dans la branche.
