# Gestion de l'effectif, lot 4 : le fichier de l'effectif (XLSX)

Date : 2026-10-27. Validé en conversation avec le porteur, avant relecture du document.
Feuille de route et premier cadrage : `docs/superpowers/specs/2026-10-26-agents-design.md` (§ lot 4).

## Pourquoi

Le chef de centre doit charger tout l'effectif au lancement de la production, puis faire les changements en masse ou à plusieurs paramètres (rentrée, promotions, réorganisation des équipes). Le faire fiche par fiche est trop long. L'écran reste la voie normale pour un changement isolé (porteur).

## Usages

1. **Chargement initial** (porteur) : on part du **modèle vierge**, pas de l'ancien MVP. Le chef de centre et l'adjoint sont créés à l'écran avant l'import.
2. **Mise à jour en masse** : on exporte, on modifie dans Excel ou LibreOffice, puis on réimporte.

## Ce que livre le lot 4

Sur la page « Agents », réservé au chef de centre, à l'adjoint et au super administrateur (pas aux comités, pas aux chefs d'équipe) :

- **Télécharger le modèle vierge** : il contient les en-têtes et les listes déroulantes, sans aucune ligne.
- **Exporter l'effectif** : toutes les personnes, extérieurs (réserve citoyenne) et partis compris, sauf le chef de centre et l'adjoint en fonction.
- **Importer** : on dépose un fichier, l'**aperçu** s'affiche, puis on **valide** ou on abandonne. Rien n'est écrit avant la validation.

## Le fichier

- **Colonnes de données** : n°, e-mail, prénom, nom, grade, date de grade, équipe, statut, profil, téléphone, naissance, entrée au centre, engagement SPV.
- **Une colonne par responsabilité** non archivée de portée centre ou équipe (sauf chef de centre et adjoint), avec « Oui » ou vide. Pour une portée équipe (chef d'équipe), « Oui » vise l'équipe de la ligne.
- **Une colonne par comité** non dissous (en-tête « Comité : <nom> »), avec le nom d'une responsabilité de portée comité (« Membre de comité », « Rapporteur de comité »…) ou vide. Le nom complet plutôt que « Membre » : il survit à un renommage et couvre toute responsabilité de portée comité (choix de Claude). Un agent qui tient deux rôles dans le même comité : ligne en erreur, à traiter à l'écran.
- **Listes déroulantes** construites depuis les listes du centre : grades, équipes, statuts, profils, Oui, Membre/Rapporteur.
- **Dates** au format JJ/MM/AAAA.
- Le fichier contient sa **date d'export**. Le modèle vierge n'en a pas besoin.

## Les règles de l'import

- **Ligne sans n°** : c'est une arrivée.
- **Ligne avec n°** : c'est une modification de l'agent.
- **Ligne sans n° dont l'e-mail existe déjà** : erreur, avec le n° de l'agent concerné.
- **Agent absent du fichier** : il passe au statut « parti », avec les mêmes effets que le départ à l'écran (fin des attributions, sortie d'équipe, effacement de la naissance et du contact d'urgence). On ne supprime jamais un agent. Le modèle vierge ne contient aucun agent, donc il ne déclenche aucun départ. Un agent créé après la date d'export (à l'écran ou par un import précédent) ne part pas non plus.
- **Fichier périmé** (porteur) : un agent modifié dans l'appli après la date d'export est signalé dans l'aperçu et sa ligne n'est pas appliquée. Il faut réexporter pour le modifier par fichier. « Modifié » couvre tout ce que le fichier porte (fiche, équipe, statut, rôles), quel qu'en soit l'auteur, import compris : après un import, on réexporte avant le suivant.
- **Responsabilités et comités** : une case remplie alors que l'agent n'a pas le rôle l'attribue à partir d'aujourd'hui. Une case vide alors qu'il l'a met fin au rôle aujourd'hui, comme « Terminer » à l'écran. Un chef d'équipe qui change d'équipe avec « Oui » quitte le rôle dans l'ancienne et le prend dans la nouvelle. Un agent qui tient un rôle d'équipe sur une autre équipe que la sienne : ligne en erreur, à traiter à l'écran.
- **Colonne inconnue** : elle est signalée puis ignorée. On crée d'abord la responsabilité ou le comité dans les réglages.
- Les **règles de droits et de validation** de l'écran s'appliquent ligne par ligne, car ce sont les mêmes actions du socle.
- L'adresse d'un super administrateur est refusée, avec une règle déplacée dans le socle (aujourd'hui elle n'existe que dans le formulaire web).
- Le fichier ne porte pas les responsabilités de chef de centre et d'adjoint : elles se nomment à l'écran. Les profils suivent les mêmes règles qu'à l'écran.
- Aucun courriel ne part à l'import. Les agents se connectent ensuite par lien, avec leur e-mail.

## L'aperçu

- **En tête** : les départs, avec leur nombre et leurs noms. Ainsi, un fichier tronqué se voit tout de suite.
- **Ensuite** : les arrivées, puis les modifications, champ par champ (ancienne valeur → nouvelle).
- **Les erreurs ligne par ligne** : n° de ligne, colonne et message clair, par exemple « Ligne 12, Équipe : « Equipe 5 » n'existe pas ».
- Les lignes périmées et les colonnes ignorées.
- **Valider** applique tout ce qui est valide. Les lignes en erreur ou périmées ne sont pas appliquées et restent listées après la validation.

## Hors périmètre

- La photo, les aptitudes, les champs propres au centre, le contact d'urgence.
- La reprise de l'ancien MVP.

## Choix techniques (essai du 2026-10-27)

- Le fichier est **écrit et lu dans le navigateur** (`write-excel-file` et `read-excel-file`, sur `fflate`) : le plan gratuit de Cloudflare limite le calcul par requête. Essai : listes déroulantes et feuille masquée conservées par LibreOffice, fichier réenregistré relu sans perte.
- Le serveur reçoit les lignes, calcule l'aperçu et l'applique **opération par opération** : D1 gratuit limite à 50 requêtes par appel.

## Ce qui reste au constructeur

- La justification des bibliothèques dans `docs/technique/`.
- Comment savoir qu'un agent a été « modifié depuis l'export » (journal ou nouvelle colonne), selon la définition ci-dessus.
- Comment reconnaître « Membre de comité » et « Rapporteur de comité » de façon sûre, même si on les renomme.
- Comment l'aperçu survit entre le dépôt et la validation, puis l'écriture par lots (limites D1).
- Les en-têtes exacts, l'ordre des colonnes, la présentation de l'aperçu (téléphone et ordinateur, RGAA AA).
- La doc : `docs/fonctionnel/fiche-agent.md`, `docs/technique/`, aide `docs/utilisation/importer-l-effectif.md`.
