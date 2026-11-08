> Revue visuelle du 08/11/2026 par un sous-agent, à vérifier écran par écran avant de corriger. Faux défauts déjà écartés : « Choose File » sur Publier et Signaler, « Où publier » en deux versions, « Installer l’appli » presque vide (capture prise avant le chargement complet). Les écrans repliables au téléphone (Agents…) ont pu être vus dépliés. Le format `mm/dd/yyyy` et le texte anglais des contrôles suivent sans doute la langue du navigateur de capture.

# Inventaire visuel : téléphone, thème clair

**Périmètre.** 23 planches, 111 vignettes, toutes vues. 10 originaux ouverts en pleine taille : `agent_mur-equipe`, `agent_accueil`, `chef_echanges_publier_mur_texte`, `chef_engins_fiches_id_retirer-zone`, `chef_reglages`, `chef_reglages_aptitudes`, `chef_planning_preparer_annee_etape=publier`, `chef_comites`, `chef_echanges_messages_a_personne_publication`, `chef_agents_nouveau`.

**Limites.**
- `tour/` contient 162 captures `-tel`. Les 51 qui ne sont pas sur les planches n'ont pas été regardées (par exemple `admin_agents`, `chef_planning_annee`, `chef_planning_preparer_annee`).
- Le contraste est estimé à l'œil, sans mesure. Les défauts de contraste sont à confirmer avec un outil.
- Le bas des vignettes est coupé sur les planches. Pour les pages longues dont l'original n'a pas été ouvert, le bas n'est pas évalué.

Noms de capture sans le suffixe `-tel`.

---

## 1. Défauts transversaux

### Contrôles natifs ou non dessinés

| # | Défaut | Écrans touchés | Gravité |
|---|---|---|---|
| T1 | Sélecteur de fichier natif gris, en anglais (« Choose File / No file chosen »). Le bouton dessiné « Ajouter des photos » existe sur d'autres écrans. | `chef_agents_fichier`, `chef_engins_anomalies_signaler`, `chef_engins_fiches_fichier`, `chef_planning_preparer_fichier`, `chef_planning_preparer_fichier_annee`, `chef_echanges_publier_mur_texte` | élevée |
| T2 | Listes déroulantes natives, avec la flèche du navigateur. | `chef_agents_nouveau`, `chef_engins_id_modifier`, `chef_engins_nouveau`, `chef_nominations-volet`, `chef_reglages_roles_nouveau_modele`, `admin_reservations_materiel_retirer` | élevée |
| T3 | Dates et heures natives au format américain (`mm/dd/yyyy`, `08:30 AM`, `11/08/2026`). Peut venir de la langue du navigateur de capture : à vérifier sur un téléphone français. Le contrôle reste natif dans tous les cas. | `chef_agents_nouveau`, `chef_echanges_publier_mur_texte`, `chef_moi_vacances`, `chef_planning_ete_panneau=periode`, `chef_planning_preparer_annee_etape=reperes`, `chef_planning_preparer_manoeuvre`, `chef_reservations_id_reserver_jour` | élevée |
| T4 | Trois couleurs de bouton radio : rouge, noir et bleu natif. | Rouge : `anon_affichage`, `chef_affichage`. Noir : `chef_echanges_publier`, `chef_engins_id_modifier`, `chef_habillement_id_panneau=traiter`. Bleu natif : `chef_planning_preparer_manoeuvre` | moyenne |
| T5 | Lien bleu natif souligné, seul de son espèce dans l'appli. | `chef_planning_ete_etape=publier`, `=repartition`, `=vacances`, `chef_reglages_roles_nouveau_modele` | moyenne |
| T6 | Poignée de redimensionnement visible dans les zones de texte. | Toutes les zones de texte (`chef_echanges_publier`, `agent_habillement`, `chef_echanges_mur_id_`…) | faible |

### Boutons et hiérarchie

| # | Défaut | Écrans touchés | Gravité |
|---|---|---|---|
| T7 | Deux boutons rouges principaux : à contour sombre sans ombre, et sans contour avec ombre rouge diffuse (effet de halo). | Contour : `chef_affichage`, `chef_agents_nouveau`, `agent_prise`, `anon_connexion`. Ombre : `agent_echanges`, `chef_agents`, `chef_reglages`, `chef_planning`, `chef_engins`. Variante plate : `chef_planning_preparer_annee_etape=manoeuvres`, `chef_planning_ete` | élevée |
| T8 | Deux boutons secondaires blancs : bord fin et bord épais. Ils peuvent se côtoyer sur le même écran. | Épais : `chef_echanges_mur_` (« Fermer les commentaires », « Épingler », « Supprimer »), `chef_echanges_mur_id_`, `chef_agents_fichier`, `chef_engins_fiches_id_retirer-zone` (« Ajouter l'élément ») | moyenne |
| T9 | Le bouton principal change de largeur et de place sans logique : pleine largeur, à gauche à la taille du texte, dans la carte ou hors de la carte, ou dans une bande blanche. | `chef_echanges_publier` et `anon_connexion` (pleine largeur), `chef_affichage` (à gauche), `chef_agents_nouveau` (hors carte), `chef_engins_nouveau` (dans la carte), `chef_reglages_profils_id_` (bande blanche, unique) | moyenne |
| T10 | Bouton d'action seul sur sa ligne sous le titre, qui consomme une ligne et crée un vide à gauche. D'autres écrans le placent à droite du titre. | Sous le titre : `chef_agents`, `chef_engins`, `chef_engins_anomalies`, `chef_planning`, `chef_planning_vue=annee`, `=mois`, `chef_remplacements`, `chef_remplacements_onglet`, `agent_remplacements`, `chef_reglages`, `chef_habillement`. À droite : `agent_echanges`, `chef_comites`, `chef_reservations_id_` | élevée |
| T11 | Action rare en rouge, au premier rang de l'écran : « Préparer l'année », « Nouveau rôle », « Ajouter un engin », « Ajouter » (agent). Le rouge devient banal. | `chef_planning`, `chef_planning_vue=annee`, `=mois`, `chef_reglages`, `chef_engins`, `chef_agents` | élevée |
| T12 | Le rouge sert à tout : marque, action, alerte, compteur, bandeau de mur, bandeau de prise de garde. Il ne signale plus rien. | `admin_`, `agent_echanges`, `agent_mur-equipe`, `agent_prise`, `chef_anomalie-attente` | moyenne |
| T13 | Trois façons d'écrire ou de publier : « + Écrire » en haut, crayon flottant rond, bouton flottant « Publier dans Amicale ». | `agent_echanges`, `agent_messages`, `chef_echanges_messages`, `chef_echanges_mur_` | moyenne |
| T14 | Sous une publication, tous les boutons ont le même poids (jusqu'à 7), passent sur 2 ou 3 lignes, et « 0 commentaire » flotte à côté comme un orphelin. | `agent_mur-equipe`, `chef_echanges_mur_`, `chef_echanges_mur_id_` | élevée |

### Structure et navigation

| # | Défaut | Écrans touchés | Gravité |
|---|---|---|---|
| T15 | Cinq formes de retour : « ‹ Caserne » standard, « ‹ Tous les murs » sans icône sur le mur, « ‹ Le centre » souligné, « Annuler » + titre centré, chevron seul. | `agent_engins`, `agent_mur-equipe`, `chef_echanges_mur_`, `chef_echanges_mur_id_`, `chef_echanges_publier`, `chef_echanges_messages_nouveau`, `agent_conversation`, `agent_conversation-infos` | moyenne |
| T16 | Écrans de second niveau sans retour, alors que leurs voisins en ont un : on y arrive depuis Caserne, comme « Engins » qui a son « ‹ Caserne ». | `chef_agents`, `chef_nominations`, `chef_comites`, `chef_reglages` | moyenne |
| T17 | Quatre formes de dépliage : › à gauche, ⌄ à droite, + dans un cercle, « Voir les 4 autres » centré. Plus des lignes sans aucun indice (« Correspondance des aptitudes », « Dissoudre le comité », « Détail droit par droit »). | `chef_planning`, `chef_engins_fiches_id_retirer-zone`, `chef_moi_agenda`, `admin_`, `chef_reglages_armement`, `chef_reglages_comites_id_`, `chef_reglages_roles_id_` | moyenne |
| T18 | Choix entre quelques options en boutons épars, ou segmenté qui déborde sur 2 lignes (règle `.segments`). | Épars : `chef_agents`, `chef_engins_anomalies`, `chef_planning_preparer` (2026/2027). Sur 2 lignes : `chef_remplacements`, `chef_remplacements_onglet` | élevée |
| T19 | Le mur « Le centre » a trois apparences : tuile + compteur, grande carte à bandeau rouge, en-tête rouge plein. Les autres murs ont une simple ligne. | `admin_`, `agent_echanges`, `agent_mur-equipe` | faible |
| T20 | Espace au-dessus du titre et entre titre et contenu variable. Le titre tombe plus bas sur certains écrans et un grand vide précède parfois le contenu. | `chef_comites`, `chef_agents_fichier`, `chef_agents_nouveau`, `chef_reglages_roles_id_`, `chef_reglages_profils_id_` | moyenne |
| T21 | État « page active » de la cloche et de l'avatar : un gros contour blanc qui ressemble à un anneau de focus oublié. | `agent_moi`, `agent_notifications`, `admin_moi`, `chef_moi`, `chef_moi_*`, `chef_notifications`, `chef_affichage`, `chef_profil` | moyenne |

### Listes et cartes (règles « Interface »)

| # | Défaut | Écrans touchés | Gravité |
|---|---|---|---|
| T22 | **Règle « une carte par groupe de lignes » violée :** une carte par ligne. | `chef_reservations_id_`, `chef_reservations_id_jour` (une carte par jour), `chef_agents_id_`, `chef_reglages_profils_id_`, `chef_reglages_roles_id_`, `chef_reglages_roles_nouveau`, `chef_nominations`, `chef_planning` (une carte par mois), `chef_engins_id_`, `chef_engins_fiches_id_`, `admin_reservations_materiel_retirer` | élevée |
| T23 | **Règle « cartes sans bord fin » violée :** cartes à filet. | `agent_prise` et `chef_engins_id_prise` (tuiles de zones), `chef_planning_ete_etape=*` (encadré), `chef_reglages_roles_id_` (encadré), `chef_nominations-volet` (carte dans la carte), `chef_echanges_publier_mur_texte` (groupe événement), `anon_affichage` (options), `chef_engins_id_modifier` (options) | moyenne |
| T24 | **Règle « une tuile seulement si elle distingue » violée :** triangles identiques répétés, ou mêmes icônes pour des choses différentes (étoile pour Chef de centre, Adjoint et Comité du centre ; personnes pour Membre et Rapporteur). | `admin_`, `chef_`, `agent_engins`, `chef_engins`, `chef_agents_id_`, `chef_reglages`, `chef_reservations`, `agent_reservations` | élevée |
| T25 | Icône sans rapport avec l'objet : Bancs = personnes, Tables = clé plate, Barnum = étoile. | `agent_reservations`, `chef_reservations`, `chef_comites`, `admin_reservations_materiel_retirer` | moyenne |
| T26 | Dans une même carte, lignes avec et sans tuile : les textes ne sont plus alignés. | `chef_comites`, `chef_engins_prise`, `agent_accueil`, `chef_casquette=astreinte` | moyenne |
| T27 | Bande de couleur à gauche pour signaler un danger ou une attention : **règle violée** pour « Départ du centre ». Partout ailleurs elle porte la couleur d'équipe, mais donne le même effet de bande, souvent doublée d'un point de couleur. | Règle : `chef_agents_id_`. Effet : `chef_agents`, `agent_planning`, `chef_planning`, `chef_planning_ete_annee`, `chef_planning_preparer`, `chef_planning_preparer_annee_etape=fetes` | élevée pour la règle, moyenne pour le reste |
| T28 | **Règle « au plus deux infos reliées par · » violée.** | `chef_engins_fiches_id_` et `chef_engins_fiches_id_retirer-zone` (« … · 4 zones · 33 éléments »), `chef_engins_id_` | moyenne |

### Effet « interface générée »

| # | Défaut | Écrans touchés | Gravité |
|---|---|---|---|
| T29 | Combinaison fond crème + carte blanche à ombre sur tous les écrans, y compris autour de formulaires entiers. Aucun écran ne respire sans carte, sauf le choix de destinataire. | Toute l'appli ; particulièrement `chef_agents_nouveau`, `chef_engins_fiches`, `chef_moi_notifications` | moyenne |
| T30 | Sur-titres en majuscules espacées, avec pastille de compteur souvent inutile (CABINE 7, AU CENTRE 4, LES FICHES 3). Deux graphies : condensée espacée, et non condensée (ÉPINGLÉES, PUBLICATIONS, TOUT LE CENTRE). | `admin_`, `agent_caserne`, `agent_engins`, `agent_prise`, `chef_reglages`, `chef_comites`, `chef_reservations`, `chef_engins_fiches`, `agent_mur-equipe`, `chef_echanges_messages_nouveau` | moyenne |
| T31 | Tuiles d'icônes pastel en série, surtout dans les réglages et les sélecteurs d'icônes (la 11e icône reste seule sur sa ligne). | `chef_reglages`, `chef_reglages_roles_nouveau`, `chef_reglages_comites_id_`, `chef_reglages_comites_nouveau`, `chef_reglages_roles_nouveau_modele`, `admin_reservations_materiel_retirer` | moyenne |
| T32 | Dégradés et fonds teintés : « Aujourd'hui au centre » rose-crème, publication Bravo orangée avec confettis, Épinglée à bord jaune. | `agent_echanges`, `admin_echanges`, `chef_echanges`, `agent_mur-equipe` | moyenne |
| T33 | Description sous presque chaque ligne, même quand le nom suffit (« Agents : L'équipe et les fiches des agents », « Mon profil : Surnom, téléphone… »). Répétitions à l'identique : « Calendrier des réservations » ×3, « 1 titulaire » ×7, « Rien de plus » ×5. | `agent_caserne`, `chef_caserne`, `agent_moi`, `chef_moi`, `chef_comites`, `chef_reglages`, `chef_reglages_profils_id_` | moyenne |

### Texte et cohérence

| # | Défaut | Écrans touchés | Gravité |
|---|---|---|---|
| T34 | Info dite deux fois : pastille + étape du suivi, sous-titre + carte jaune, « Publiée » 2 ou 3 fois. | `chef_habillement_id_`, `admin_habillement_id_`, `chef_anomalie-attente`, `chef_engins_anomalies_id_`, `agent_planning`, `chef_planning`, `chef_planning_preparer`, `chef_planning_preparer_annee_etape=publier` | élevée |
| T35 | Répétition nom/type : « VSAV 1 / VSAV », « FPT / FPT · AA-102-SP », avec « Prise à faire » sur chaque ligne. | `agent_engins`, `chef_engins`, `chef_engins_prise`, `chef_engins_anomalies_signaler` | moyenne |
| T36 | Heures et dates sans format unique : « 19:00 », « 19 h », « 16 h 04 », « à 16:04 ». | `agent_accueil`, `agent_mur-equipe`, `chef_echanges_mur_id_` | moyenne |
| T37 | Retours à la ligne laids : guillemet ou signe orphelin en bout ou début de ligne (« « / Coffre », « Réf. / » », « / ». », « ; l'export », « · Équipe 1 »). | `chef_engins_fiches_id_`, `chef_engins_fiches_fichier`, `chef_planning_preparer_fichier`, `chef_planning_preparer`, `chef_agents_fichier`, `chef_planning_preparer_annee_etape=manoeuvres` | moyenne |
| T38 | Pastille d'état à droite qui écrase le titre en colonne étroite sur 3 lignes. | `agent_habillement`, `chef_habillement_toutes`, `chef_engins_anomalies`, `agent_engins` | moyenne |
| T39 | Titres de ligne tantôt en condensé gras, tantôt en normal, pour le même rôle. Le titre de carte « Nom et thème » est encore différent, fin et non condensé. | Condensé : `chef_reglages_profils_id_`, `chef_reglages_roles_id_`, `chef_engins_id_`, `chef_reservations_id_`. Normal : `chef_caserne`, `chef_reglages`, `agent_planning`. Différent : `chef_reglages_comites_id_` | moyenne |
| T40 | Champs sans style unique : bord sombre épais (majorité), bord clair fin, fond gris plein, largeur variable. | Sombre : `chef_agents_nouveau`. Clair : `chef_engins_anomalies_signaler`, `chef_echanges_publier`. Gris : `chef_moi_vacances`, `chef_planning_ete_panneau=periode` | moyenne |
| T41 | Écrans vides : la même loupe partout, y compris pour inviter à écrire un premier message, où la loupe n'a pas de sens. Le titre en gras manque parfois, et le point final est aléatoire (« Aucune demande » / « Aucune demande pour vous. »). | `chef_echanges_messages`, `chef_echanges_messages_a_personne_`, `chef_habillement`, `agent_notifications`, `chef_remplacements_onglet` | moyenne |
| T42 | Petit texte gris clair (descriptions, heures, S45, « zones vues » sur rouge) : contraste à contrôler, à l'œil il est limite. Texte sombre fin sur jaune aussi. | `chef_planning_preparer_annee_etape=publier`, `agent_prise`, `chef_planning`, `agent_echanges` | moyenne |

---

## 2. Écran par écran

Les défauts transversaux ne sont repris que s'ils ont un effet propre à l'écran.

### Admin

- `admin_` : 3 lignes À décider avec le même triangle pastel (T24) ; 4 tuiles de styles différents dans À ne pas manquer et les murs — **élevée**
- `admin_` : bloc Gérer en 3 colonnes, unique dans l'appli, qui ressemble à une seconde barre de navigation — faible
- `admin_echanges` : phrase d'humour sur 3 lignes, comprimée par le bouton Écrire — moyenne
- `admin_echanges` : « Officiel » en pastille pâle sur bandeau rouge, peu lisible — moyenne
- `admin_echanges` : ligne « › Supervision · 3 nouveautés » seule dans sa carte, à chevron à gauche — faible
- `admin_engins_id_prise` : hauteurs inégales des tuiles de zones (texte sur 2 lignes) — faible
- `admin_engins_id_prise` : grand bandeau rouge pour un état neutre (0/4) — moyenne
- `admin_habillement_id_` : le suivi ressemble à des boutons radio d'un formulaire alors que ce n'est pas un choix — **élevée**
- `admin_habillement_id_` : le texte de la demande sert de titre énorme, puis est répété dans Le fil — moyenne
- `admin_moi` : tuile pastel décorative pour « Super administrateur » — faible
- `admin_reservations_materiel_retirer` : confirmation de retrait placée au-dessus d'un « Modifier » qui reste actif, ordre illogique — **élevée**
- `admin_reservations_materiel_retirer` : une carte par matériel (T22), VL n'a qu'un seul bouton et les autres deux — moyenne
- `admin_reservations_materiel_retirer` : champ Stock et aide « Combien en a-t-on ? » répètent le libellé — faible

### Agent

- `agent_accueil` : « Ajouter à mon agenda » passe sur 2 lignes, avec l'icône loin du texte ; les deux actions de la carte ne sont pas équilibrées — **élevée**
- `agent_accueil` : « ✓ Présent » touche les bords de son segment — moyenne
- `agent_accueil` : la carte À ne pas manquer mélange 5 formes de ligne et 4 alignements (date, tuile claire, tuile rouge, tuile d'équipe) — moyenne
- `agent_accueil` : titre tronqué en gras « Merci de conf… » — moyenne
- `agent_accueil` : le texte droit du bandeau jaune est petit et serré à côté du grand 26 — faible
- `agent_caserne` : descriptions superflues (T33) — faible
- `agent_conversation` : en-tête propre sans barre de l'appli, retour et bouton son d'un autre style — faible
- `agent_conversation-infos` : titre d'écran en petit texte à côté du chevron, contrairement à tous les autres écrans — moyenne
- `agent_conversation-infos` : « FICHE COURTE » en majuscules dans une carte, autre style de sur-titre — faible
- `agent_echanges` : dégradé rose « Aujourd'hui au centre » (T32) — moyenne
- `agent_echanges` : deux lignes de méta collées à droite (heure + compteur), aperçu tronqué, nom suivi d'un petit « · mon équipe » — faible
- `agent_engins` : pastilles qui compriment les noms ; « Avertissement » ne dit pas de quoi il s'agit — moyenne
- `agent_engins` : ligne « VSAV, AA-123-SP, prêté par CIS Exemple-Nord » sur 2 lignes + « Prise à faire » : ligne très haute à côté des autres — faible
- `agent_habillement` : le formulaire occupe le haut de l'écran et repousse le suivi des demandes, qui intéresse plus souvent — moyenne
- `agent_habillement` : titres écrasés sur 3 lignes par la pastille (T38) — moyenne
- `agent_messages` : crayon flottant très proche de la barre du bas — faible
- `agent_moi` : la carte d'identité a un filet jaune en haut, unique à cet écran — faible
- `agent_moi` : descriptions sur les 8 lignes (T33) — faible
- `agent_mur-equipe` : bouton son blanc sur pastille rose pâle dans l'en-tête rouge, quasi illisible — **élevée**
- `agent_mur-equipe` : 3 lignes d'actions par publication, toutes au même poids (T14) — **élevée**
- `agent_mur-equipe` : en-tête rouge d'environ 200 px avant le premier contenu — moyenne
- `agent_mur-equipe` : trois styles de carte à la suite (bord jaune, dégradé orange, blanc) — moyenne
- `agent_mur-equipe` : « Changer mon vote » en texte gras simple, sans allure de bouton ; bloc gris-crème dans la carte — moyenne
- `agent_notifications` : aucun défaut propre, sinon T21 — faible
- `agent_planning` : l'astreinte est dite trois fois (sous-titre, carte jaune, bandeau de semaine) — **élevée**
- `agent_planning` : « Remplacements » avec une icône de bulle de discussion, alors que l'icône de remplacement existe — moyenne
- `agent_planning` : « ‹ 2025 / 2027 › » en liens soulignés perdus sous la semaine, loin de la navigation par semaine — moyenne
- `agent_prise` : « Valider la prise » désactivé en pointillés beiges, qui ressemble à une zone de dépôt — **élevée**
- `agent_prise` : deux boutons pour finir (« Tout est complet », « Valider la prise ») sans ordre évident — moyenne
- `agent_prise` : mode d'emploi de 4 lignes toujours affiché, à chaque prise — moyenne
- `agent_prise` : « Écart » souligné répété 7 fois, qui fait du bruit sur la colonne de droite — moyenne
- `agent_remplacements` : le titre de carte « Aucune demande en cours. Comment ça marche ? » mélange deux idées et passe sur 2 lignes — moyenne
- `agent_remplacements` : les deux liens soulignés flottent sous la carte, sans lien visuel avec le reste — moyenne
- `agent_reservations` : icônes sans rapport (T25) — moyenne

### Anonyme

- `anon_affichage` : options en cartes séparées à filet, au lieu d'un seul groupe — moyenne
- `anon_connexion` : aucun défaut notable (voir « Les plus réussis »)

### Chef : accueil, Moi, agents

- `chef_` : mêmes triangles qu'`admin_` (T24) — **élevée**
- `chef_` : segmenté Présent/Absent/Incertain réduit et décalé à droite, suivi de « Sondage ouvert : votez sur la publication » en bleu avec une icône minuscule, sur 2 lignes — moyenne
- `chef_` et `chef_casquette=astreinte` : « Qui est partant » et le sondage de la manœuvre sont deux formes différentes d'une même chose — faible
- `chef_affichage` : comme `anon_affichage` ; le bouton Enregistrer alors qu'un choix de thème pourrait se voir aussitôt rend l'écran plus lourd — faible
- `chef_agents` : titre seul, boutons Fichier/Ajouter sur la ligne dessous (T10), filtres en boutons épars (T18) — moyenne
- `chef_agents` : bande de couleur d'équipe sur tout le bord de la carte, en plus de la couleur de l'avatar (T27) — moyenne
- `chef_agents` : « Nommer » placé entre le chevron et le bord de l'en-tête d'équipe — faible
- `chef_agents_fichier` : « Importer » puis « Importer un fichier » à la suite — faible
- `chef_agents_fichier` : ligne qui commence par « ; l'export » (T37) et sélecteur natif (T1) — **élevée**
- `chef_agents_id_` : une carte par ligne avec tuile pastel, alors que l'objet de chaque ligne est déjà nommé (T22, T24) — **élevée**
- `chef_agents_id_` : « Départ du centre » avec bande rouge à gauche (T27), et action irréversible au même niveau que les autres lignes — **élevée**
- `chef_agents_nouveau` : « Équipe » en titre de carte, puis « Équipe » en libellé juste dessous — faible
- `chef_agents_nouveau` : long formulaire entièrement fait de contrôles natifs (T2, T3), bouton hors carte — **élevée**
- `chef_anomalie-attente` : voir `chef_engins_anomalies_id_`, mêmes défauts — moyenne

### Chef : caserne, comités

- `chef_caserne` : aucun défaut propre, sinon descriptions (T33) — faible
- `chef_casquette=astreinte` : bandeau jaune répété avec « Voir le planning » seul sur sa ligne, redondant avec l'onglet Planning — faible
- `chef_comites` : trois niveaux de titres emboîtés (titre, « Comités », « AMICALE ») sur une seule page — moyenne
- `chef_comites` : personnes, murs et matériel dans la même carte, avec et sans tuile : le texte saute de colonne (T26) — **élevée**
- `chef_comites` : « Écrire à Chloé Durand / Écrire à Hélène Habillement » empilés, seule ligne de ce type dans la liste — moyenne
- `chef_comites` : « Écrire » présent ou absent d'une ligne à l'autre : la colonne de droite est trouée — faible

### Chef : échanges

- `chef_echanges` : phrase d'humour comprimée par Écrire — moyenne
- `chef_echanges` : carte « Aujourd'hui » qui mêle anniversaire et manœuvre sur dégradé rose, avec deux formes de ligne — moyenne
- `chef_echanges_messages` : écran vide sans titre en gras, contrairement aux autres écrans vides ; loupe hors sujet (T41) — faible
- `chef_echanges_messages_a_personne_` : gyro à la loupe pour inviter à écrire, grand vide au-dessus du champ — moyenne
- `chef_echanges_messages_a_personne_publication` : **texte prérempli coupé** dans le champ, la 2e ligne est tranchée à mi-hauteur — **élevée**
- `chef_echanges_messages_nouveau` : liste posée sur le fond sans carte, contrairement à toute l'appli ; sur-titre d'une autre graphie — moyenne
- `chef_echanges_messages_nouveau` : long défilé de noms sans regroupement par équipe alors que l'équipe est affichée sur chaque ligne — moyenne
- `chef_echanges_messages_nouveau_groupe` : choix multiple dessiné avec des ronds de type radio, grands et vides — **élevée**
- `chef_echanges_mur_` : 7 boutons de même poids sous une publication, dont « Supprimer » neutre à côté de « Épingler » (T14) — **élevée**
- `chef_echanges_mur_` : texte rose sur rose pâle dans « Visible par les 2 membres… », contraste faible — moyenne
- `chef_echanges_mur_` : bouton flottant collé à la barre du bas — faible
- `chef_echanges_mur_id_` : retour souligné (T15) ; le formulaire de commentaire passe avant le suivi, mais tout est au même niveau — moyenne
- `chef_echanges_mur_id_` : pavé de 37 noms en liste à virgules, difficile à lire — moyenne
- `chef_echanges_mur_id_` : « Oui » et « Non » du sondage ressemblent à des champs de saisie — moyenne
- `chef_echanges_publier` : « Où publier » occupe 4 rangées de radios ; les libellés ont des largeurs inégales — moyenne
- `chef_echanges_publier` : titre centré dans un en-tête propre à cet écran (T15) — faible
- `chef_echanges_publier_mur` : pour un mur présélectionné, la liste complète reste affichée et repousse le message — moyenne
- `chef_echanges_publier_mur_texte` : « Où publier » en 8 grandes lignes alors que `chef_echanges_publier` l'affiche en rangées compactes : deux versions d'une même question — **élevée**
- `chef_echanges_publier_mur_texte` : case « Demander une prise de connaissance » centrée sur 3 lignes, décalée de son texte ; texte sélectionné vert sur vert — moyenne
- `chef_echanges_publier_mur_texte` : « Choose Files » ici, « Ajouter des photos » sur l'écran voisin (T1) — **élevée**
- `chef_echanges_publier_mur_texte` : groupe « Pour un événement » à filet, légende posée sur le bord (cadre de formulaire natif) — moyenne

### Chef : engins

- `chef_engins` : voir T10 et T11 ; pastilles écrasant les textes — moyenne
- `chef_engins_anomalies` : filtres épars, « VTU » seul à la ligne (T18) — moyenne
- `chef_engins_anomalies` : « Treuil hors service » coupé en 2 mots par la pastille alors que la ligne est libre — moyenne
- `chef_engins_anomalies_id_` : « Rendre l'engin indisponible » en rouge plein, alors que c'est une décision rare ; il domine l'écran — **élevée**
- `chef_engins_anomalies_id_` : « VTU reste disponible » dit deux fois (encadré, carte Disponibilité) ; statut dit deux fois (T34) ; dates de Le problème reprises dans Historique — moyenne
- `chef_engins_anomalies_id_` : « Voir VTU » pleine largeur, texte à gauche : ressemble à un champ de saisie — moyenne
- `chef_engins_anomalies_id_` : encadré d'alerte à filet, en haut, avant le contenu — faible
- `chef_engins_anomalies_id_panneau=clore`, `=reparee` : en-tête de panneau crème sur corps blanc, rupture sans raison — faible
- `chef_engins_anomalies_signaler` : sélecteur natif (T1) ; engins en « VSAV 1 / VSAV » (T35) ; « Manquant / Abîmé / À remplacer » qui déborde sur 2 lignes — moyenne
- `chef_engins_fiches` : formulaire « Nouveau type d'engin » toujours ouvert, en plein milieu, pour une action rare — moyenne
- `chef_engins_fiches_fichier` : guillemets orphelins (T37), sélecteur natif (T1) — **élevée**
- `chef_engins_fiches_id_` : une carte par zone (T22), trois infos reliées par des points (T28), formulaire d'ajout toujours ouvert — moyenne
- `chef_engins_fiches_id_retirer-zone` : 4 boutons par élément, répétés 7 fois : mur de boutons — **élevée**
- `chef_engins_fiches_id_retirer-zone` : la confirmation d'une zone se perd au bout d'un bloc de boutons divers ; deux styles de boutons à flèche — moyenne
- `chef_engins_fiches_id_retirer-zone` : ajout à la zone en cadre pointillé, autre style dans la même carte — faible
- `chef_engins_id_` : 5 boutons empilés aux largeurs irrégulières (dont 4 secondaires), liste plus adaptée — **élevée**
- `chef_engins_id_` : « Fiche VSAV » reprise avec ses zones, ligne de méta sur 2 lignes (T28) — faible
- `chef_engins_id_modifier` : options de situation avec longs textes, cartes à filet dans une carte (T23) — moyenne
- `chef_engins_id_prise` : mêmes défauts qu'`agent_prise` — **élevée**
- `chef_engins_nouveau` : mêmes défauts que `chef_engins_id_modifier` — moyenne
- `chef_engins_prise` : seul VTU a une tuile, ses textes sont décalés (T26) — **élevée**
- `chef_engins_prise` : « 0 sur 4 prise faite » : ligne de texte isolée, fautive au pluriel à la lecture — faible

### Chef : habillement

- `chef_habillement` : bouton « Toutes les demandes » seul sur sa ligne (T10), formulaire et écran vide empilés — moyenne
- `chef_habillement_id_` : suivi façon radios et pastille redondante (T34) — **élevée**
- `chef_habillement_id_` : 3 boutons empilés aux largeurs inégales — faible
- `chef_habillement_id_panneau=question`, `=traiter` : en-tête crème (voir `chef_engins_anomalies_id_panneau`) — faible
- `chef_habillement_toutes` : colonne de titres étroite, écrasée par les pastilles longues (« Commandée au SDIS ») — moyenne

### Chef : Moi

- `chef_moi` : mêmes défauts que `agent_moi` ; pas de filet ici, deux versions de la carte d'identité — faible
- `chef_moi_agenda` : deux gros blocs de texte avant les actions ; le + en cercle (T17) — faible
- `chef_moi_installer` : écran quasi vide, juste une ligne « Vérification de cet appareil… » — moyenne
- `chef_moi_notifications` : 3 cartes de texte pour une seule action ; l'interrupteur enfermé dans une pilule à contour — moyenne
- `chef_moi_vacances` : champs date gris pleins, deux colonnes serrées (T40), différents de tous les autres formulaires — moyenne
- `chef_nominations` : une carte par rôle (T22), « Nommer » répété 10 fois — **élevée**
- `chef_nominations` : les titulaires en pilules bleues avec × : la pilule est réservée aux états, ici c'est une action — moyenne
- `chef_nominations` : colonnes de texte étroites (« Équipe 1, Équipe 2, / Équipe 3, Équipe 4 ») à cause du bouton — faible
- `chef_nominations-volet` : volet dans la carte avec filet, liste native, lien bleu « Changer les dates » — moyenne
- `chef_notifications` : aucun défaut propre, sinon T21 — faible

### Chef : planning

- `chef_planning` : « Préparer l'année » en rouge, en tête, sur un écran de consultation (T11) — **élevée**
- `chef_planning` : 12 cartes de mois empilées (T22), à chevron à gauche et condensé gras — moyenne
- `chef_planning` : « Cette semaine : Équipe 1 d'astreinte » dit en sous-titre, puis dans la carte jaune avec les mêmes mots — moyenne
- `chef_planning` : carte de mois ouverte avec bandes colorées dans des rangées grises — faible
- `chef_planning_ete` : deux boutons principaux rouges et bleu marine à égalité (« Ouvrir la saisie », « Vacances › ») — **élevée**
- `chef_planning_ete` : barre de progression + numéros d'étapes + « Étape 1 sur 4 » : même info trois fois — moyenne
- `chef_planning_ete` : texte explicatif de 4 lignes posé sur le fond, entre la carte et les boutons — moyenne
- `chef_planning_ete_annee` : bande + point + nom de groupe pour une seule info (T27) — moyenne
- `chef_planning_ete_annee` : « ✓ FPT armé 7/7 » répété 9 fois alors que seule l'exception compte ; la première semaine (30 juil.) rompt l'ordre chronologique sans explication — moyenne
- `chef_planning_ete_annee` : petit chevron en bas à droite de chaque ligne, décentré — faible
- `chef_planning_ete_etape=publier` : écran bloqué, seulement un encadré et un bouton retour — moyenne
- `chef_planning_ete_etape=repartition`, `=vacances` : le message dit « Ouvrez d'abord… » mais le bouton « suivant » reste plein et invite à avancer ; lien bleu natif (T5) — moyenne
- `chef_planning_ete_panneau=periode` : champs de date de largeurs différentes, gris plein (T40) — faible
- `chef_planning_preparer` : bloc d'en-tête (statut, année, export, été) répété à chaque étape, qui repousse le contenu d'un écran à moitié — **élevée**
- `chef_planning_preparer` : étape active dans un cadre où le libellé touche le bord (« Roulement »), libellés minuscules — moyenne
- `chef_planning_preparer` : bandes colorées + point sur le roulement ; aperçu pastel à bandes — moyenne
- `chef_planning_preparer` : alerte terminée par « ». » seul sur sa ligne (T37) — faible
- `chef_planning_preparer_annee_etape=fetes` : cartes pastel à bande, « Dans son tour. » répété — faible
- `chef_planning_preparer_annee_etape=manoeuvres` : « Ajouter une manœuvre » avec un troisième style de rouge (T7) ; ligne de méta qui commence par « · » (T37) ; manœuvres dans une carte dans une carte — moyenne
- `chef_planning_preparer_annee_etape=publier` : mosaïque de 52 tuiles pastel à bord et base colorés, très arc-en-ciel ; texte de 2 lignes minuscule — **élevée**
- `chef_planning_preparer_annee_etape=publier` : « Manœuvres » touche le cadre de l'étape voisine ; « Vérifier et publier » sur 3 lignes dans son cadre — moyenne
- `chef_planning_preparer_annee_etape=reperes` : « Vacances de Noël » en carte à ombre dans une carte ; exemple grisé pris pour une valeur saisie — moyenne
- `chef_planning_preparer_fichier`, `_fichier_annee` : sélecteur natif, guillemets orphelins (T1, T37) — **élevée**
- `chef_planning_preparer_manoeuvre` : radios bleus natifs et heure en AM (T3, T4) ; les cases d'équipes sont affichées même si « Tout le centre » est choisi — **élevée**
- `chef_planning_vue=annee` : voir `chef_planning` — moyenne
- `chef_planning_vue=mois` : les dates à marqueur (1, 11, 15) montent par rapport à leur ligne : la rangée n'est plus alignée — moyenne
- `chef_planning_vue=mois` : semaine commençant au vendredi, inhabituelle sans repère (intention métier possible) — faible
- `chef_planning_vue=mois` : « ‹ 2025 / 2027 › » en liens, après ‹ Novembre › en boutons : deux navigations de styles différents — moyenne
- `chef_profil` : aide placée sous la case, « Contact d'urgence » : un seul champ pour le nom et le numéro — faible

### Chef : réglages

- `chef_reglages` : « + Comité » et « + Nouveau rôle » sur leur propre ligne, en rouge pour une action rare (T10, T11) — **élevée**
- `chef_reglages` : la ligne Photos a sa propre carte, sans chevron, en tête d'écran alors que c'est un détail — moyenne
- `chef_reglages` : « Membre de comité » et « Rapporteur de comité » listés sous Comités à côté des vrais comités, avec la même icône entre eux : des rôles mêlés à des groupes — moyenne
- `chef_reglages_aptitudes` : **« Enregistrer » et « Retirer » répétés sur chaque ligne**, ×10, sous un champ étroit : mur de boutons — **élevée**
- `chef_reglages_armement` : intro de 4 lignes ; « Correspondance des aptitudes » : une ligne seule sans indice — moyenne
- `chef_reglages_comites_id_` : titre de carte « Nom et thème » hors style (T39) — moyenne
- `chef_reglages_comites_id_` : « Dissoudre le comité » : ligne blanche neutre pour une action destructrice — **élevée**
- `chef_reglages_comites_id_` : tuile d'icône à droite du titre, en plus du sélecteur plus bas — faible
- `chef_reglages_comites_nouveau` : sélecteur d'icônes sans état visible, dernière icône seule — faible
- `chef_reglages_profils_id_` : cartes séparées (T22), bande blanche d'enregistrement unique dans l'appli — **élevée**
- `chef_reglages_profils_id_` : tuile d'icône à droite du titre, sans valeur ajoutée — faible
- `chef_reglages_roles_id_` : l'écran dit « ne se modifie pas » mais chaque ligne garde son chevron, comme si on pouvait la changer — **élevée**
- `chef_reglages_roles_id_` : encadré gris-bleu à filet ; grand vide entre encadré et phrase ; pastille « Rôle système » isolée — moyenne
- `chef_reglages_roles_nouveau` : cartes séparées (T22), chevrons très petits comparés aux autres écrans — moyenne
- `chef_reglages_roles_nouveau_modele` : formulaire de listes natives (T2), lien bleu natif (T5) — **élevée**

### Chef : remplacements

- `chef_remplacements` : segmenté à 4 options sur 2 lignes, « Historique » seul au centre — **élevée**
- `chef_remplacements` : deux liens soulignés sous la carte (voir `agent_remplacements`) — moyenne
- `chef_remplacements_onglet` : mêmes défauts, liens collés au bord gauche après un écran vide centré — moyenne
- `chef_remplacements_demander`, `_demander_mode`, `_manoeuvre` : écrans vides corrects, sous-titre annonçant une démarche qui n'est pas disponible (« Trois étapes… ») — faible

### Chef : réservations

- `chef_reservations` : voir `agent_reservations` (T25) — moyenne
- `chef_reservations_a-valider` : aucun défaut notable
- `chef_reservations_id_` : **une carte par jour**, 7 cartes identiques « Libre, 12 sur 12 » (T22) — **élevée**
- `chef_reservations_id_` : phrase de 3 lignes comprimée par le bouton « Réserver » — moyenne
- `chef_reservations_id_` : chevrons de semaine plus petits que ceux du planning — faible
- `chef_reservations_id_jour` : semaine sur cartes grisées presque invisibles sur le fond, contraste faible — moyenne
- `chef_reservations_id_reserver_jour` : « Les jours » : petit titre de groupe pour deux champs ; contrôles natifs (T3) — moyenne
- `chef_reservations_materiel` : aucun défaut notable
- `chef_reservations_miennes` : aucun défaut notable

---

## 3. Écrans sans défaut notable

Hors défauts transversaux (crème, sur-titres, état actif de la cloche ou de l'avatar) :

`anon_connexion`, `agent_notifications`, `chef_notifications`, `chef_reservations_a-valider`, `chef_reservations_materiel`, `chef_reservations_miennes`, `agent_messages`, `agent_caserne`, `chef_caserne`.

---

## 4. Les 3 écrans les plus réussis

1. **`agent_caserne`** (et `chef_caserne`) : cartes par groupe, pas de tuile décorative, chiffres alignés à droite, chevron discret. C'est le modèle à suivre pour une page de navigation. Il suffirait d'alléger les descriptions.
2. **`anon_connexion`** : une seule action, une seule phrase utile, Gyro à sa place, bouton à pleine largeur. Hiérarchie immédiate, rien à retirer.
3. **`agent_messages`** : segmenté à pleine largeur, recherche, liste compacte avec nom, heure et aperçu. Une seule action visible. Sobre et familier, sans effet décoratif.

---

## 5. Priorités

1. **Contrôles natifs** (T1, T2, T3) : fichier, liste, date. C'est le plus visible et cela touche les formulaires principaux.
2. **Une carte par ligne et murs de boutons** (T22, `chef_reglages_aptitudes`, `chef_engins_fiches_id_retirer-zone`, `chef_engins_id_`, `chef_echanges_mur_`).
3. **Une seule famille de boutons et une règle de placement** (T7, T8, T9, T10, T11), avec le rouge réservé à l'action principale d'usage courant.
4. **Tuiles et bandes** (T24, T25, T26, T27) : retirer les tuiles qui ne distinguent rien.
5. **Info répétée et assistant d'année** (T34, `chef_planning_preparer`, `chef_planning_ete`, `chef_planning_preparer_annee_etape=publier`).
