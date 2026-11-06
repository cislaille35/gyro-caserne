# 0008 — Design de l'interface : les fondations

- **Contexte** : les premiers écrans de gestion arrivent. Sans socle commun, chaque écran inventerait ses couleurs, ses boutons et son accessibilité. Le porteur veut une appli de gestion sérieuse, mais qui vit : du mouvement, de l'humour, Gyro.
- **Options** :
  - reprendre un système de design existant (DSFR) : accessible, mais l'allure d'un site de l'État ;
  - repartir de l'allure du MVP `cis-laille` et la rendre accessible ;
  - une allure neuve : du temps, sans gain pour les agents qui connaissent déjà le MVP.
- **Choix** :
  - **base visuelle du MVP** : Barlow et Barlow Condensed (servies par l'appli), rouge pompier, fond gris clair, mode sombre, Gyro et ses 42 tenues ;
  - **téléphone et ordinateur à égalité** : conçu d'abord pour le téléphone, chaque écran soigné aux deux tailles (390 et 1280 px), toutes les fonctions partout ;
  - **RGAA, niveau AA des WCAG**, en s'inspirant des règles du DSFR sans son allure, vérifié par des tests automatiques en CI (axe dans Chromium, aux deux tailles, en clair et en sombre) ;
  - **trois niveaux de vie** (Sobre, Équilibré, Vivant), **Vivant par défaut** ; « réduire les animations » du téléphone toujours respecté ; ni humour ni animation dans l'urgence ;
  - **aucun mouvement sans fin** (RGAA 13.8) : Gyro s'immobilise après 10 s sur l'accueil (un appui l'arrête ou le relance), 5 s ailleurs ;
  - **réglage sur l'appareil** (niveau et thème, par cookie lu par le serveur) : appliqué dès le premier affichage, avant même la connexion, et chacun peut avoir le sombre sur son téléphone et le clair au bureau.
- **Pourquoi** : les agents retrouvent l'appli qu'ils connaissent ; l'accessibilité est vérifiée à chaque PR plutôt que promise ; le réglage par appareil évite un flash au chargement et ne demande pas de compte.
- **Détails** : [interface.md](../technique/interface.md) et [le design](../superpowers/specs/2026-10-26-design-ui-design.md).
- **Validé par** : le porteur du projet, le 26/10/2026.

## Complément : la nouvelle identité (lot C de la refonte)

- **Contexte** : l'audit de l'interface (05/11/2026) trouvait l'appli juste mais sans caractère ; des maquettes (accueil agent et chef, soir de relève, Planning, prise de garde, Échanges, ordinateur en sombre) ont été soumises au porteur.
- **Choix** :
  - en-tête anthracite, « GYRO CASERNE » en Barlow Condensed, cloche et visage en carrés arrondis, fine bande de marquage jaune et rouge (4 px, décorative, immobile) ; fond crème gardé ;
  - cartes arrondies (14 px) sans bord fin, une ombre douce en clair, une surface plus claire que le fond en sombre ;
  - boutons en rectangles arrondis (10 px) ; la pilule réservée aux états ; les choix en blocs segmentés, l'option choisie en encre pleine ;
  - la plaque d'astreinte : un à-plat de la couleur de l'équipe, grand compte à rebours ou heure de la relève en Barlow Condensed, texte noir ou blanc choisi pour atteindre 4,5:1 sur toute couleur du centre ;
  - Gyro sur l'accueil, les écrans vides et les réussites, plus dans les titres ordinaires.
- **Pourquoi** : une identité de caserne (marquage, plaque) sans perdre la lisibilité ni l'accessibilité, vérifiées par les tests des jetons et des formes.
- **Validé par** : le porteur du projet, le 06/11/2026.
