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
