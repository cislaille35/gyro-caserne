# 0009 — Fichier de l'effectif : le classeur est écrit et lu dans le navigateur

- **Contexte** : le gestionnaire exporte l'effectif en `.xlsx`, le corrige dans son tableur puis le réimporte. L'appli tourne sur l'offre gratuite de Cloudflare Workers : peu de temps de calcul par requête, et D1 limite à 50 requêtes par appel. Écrire ou lire un classeur de plusieurs centaines d'agents côté serveur risque de dépasser ces limites.
- **Options** :
  - ExcelJS sur le serveur : complet, mais lourd (21 Mo), plus maintenu, pensé pour Node, et coûteux en calcul dans un Worker ;
  - `write-excel-file` et `read-excel-file` dans le navigateur : petits, maintenus, sur `fflate` ; le serveur ne reçoit que des lignes de texte ;
  - écrire le XML du classeur à la main : aucune dépendance, mais beaucoup de code à maintenir et à tester.
- **Choix** : `write-excel-file` 4.1.1 et `read-excel-file` 9.3.12, versions fixées, dans le navigateur. Le serveur calcule l'aperçu en un appel (lectures groupées), puis applique les opérations une par une, chacune par les actions du socle.
- **Pourquoi** : le calcul lourd (zip, XML) se fait sur l'appareil du gestionnaire, hors des limites du Worker ; les règles métier restent dans le socle. Essai : listes déroulantes et feuille masquée conservées par LibreOffice, fichier réenregistré relu sans perte.
- **Détails** : [socle.md](../technique/socle.md), [README technique](../technique/README.md) et [la spec](../superpowers/specs/2026-10-27-fichier-effectif-design.md).
- **Validé par** : le porteur, 2026-10-27 (spec du lot 4).
