# Comment importer l'effectif ?

Réservé au chef de centre, à son adjoint et au super administrateur. Pour un seul agent, passez plutôt par sa fiche.

1. Ouvrez l'onglet « Caserne », puis « Agents » (adresse `/agents`), et appuyez sur « Fichier », en haut de la liste. La page « Fichier de l'effectif » s'ouvre.
2. Téléchargez le fichier de départ :
   - « Télécharger le modèle vierge » pour le premier chargement (créez d'abord à l'écran le chef de centre et l'adjoint) ;
   - « Exporter l'effectif » pour une mise à jour.
3. Ouvrez-le dans Excel ou LibreOffice et remplissez la feuille « Effectif » :
   - une ligne sans n° est une arrivée ; ne touchez pas au n° des agents existants ;
   - e-mail, prénom, nom et profil sont obligatoires ; un statut vide vaut « Opérationnel » ;
   - les dates s'écrivent JJ/MM/AAAA ; grade, équipe, statut et profil se choisissent dans les listes ;
   - pour une responsabilité, « Oui » ou vide ; pour un comité, le rôle (« Membre de comité »…) ou vide ;
   - supprimer la ligne d'un agent le fait partir (statut « Parti »).
4. Enregistrez au format `.xlsx`, revenez sur la page et appuyez sur « Importer un fichier ». Rien n'est encore écrit.
5. Lisez l'aperçu, en commençant par les départs, affichés en tête : vérifiez qu'aucun agent n'y figure par erreur. Lisez ensuite les arrivées, les modifications, puis les erreurs ligne par ligne.
6. Si besoin, corrigez le fichier et importez-le de nouveau. Sinon, appuyez sur « Valider », ou sur « Abandonner ».
7. Gardez la page ouverte jusqu'au compte rendu. Il liste ce qui a été appliqué et ce qui ne l'a pas été.
8. Avant le prochain import, réexportez l'effectif : un ancien fichier ne modifie pas un agent changé depuis.

Une modification faite à l'écran pendant que l'aperçu est affiché n'est pas détectée : l'import peut l'écraser. Évitez de modifier des fiches entre le dépôt du fichier et « Valider ».

Les lignes en erreur ou périmées ne sont pas appliquées : corrigez-les dans un nouvel export ou à l'écran. Le fichier ne nomme ni le chef de centre ni l'adjoint. Aucun courriel ne part : les agents se connectent ensuite avec leur e-mail.
