> Revue visuelle du 08/11/2026 par un sous-agent, à vérifier écran par écran avant de corriger. Faux défauts déjà écartés : « Choose File » sur Publier et Signaler, « Où publier » en deux versions, « Installer l’appli » presque vide (capture prise avant le chargement complet). Les écrans repliables au téléphone (Agents…) ont pu être vus dépliés. Le format `mm/dd/yyyy` et le texte anglais des contrôles suivent sans doute la langue du navigateur de capture.

# Inventaire visuel — Gyro Caserne, ordinateur (1280 px), thème sombre

**Couverture.** 19 planches vues sur 19 (110 cases). 49 originaux ouverts, dont 10 captures absentes des planches.
Sur les 161 captures `-ordi`, 16 groupes sont strictement identiques (même empreinte de fichier).
**Non vues** (absentes des planches et non ouvertes), à ne pas considérer comme validées : la plupart des `admin_*` (agents, agents_id, caserne, echanges_mur, echanges_mur_id, engins, engins_id, habillement, notifications, planning*, remplacements, reservations), `chef_agents_id_filtre=a-completer`, `chef_casquette=centre`, `chef_planning_ete_annee_etape=periode_panneau=periode` (identique à `chef_planning_ete_panneau=periode`).
Ces écrans semblent partager les mêmes composants que leurs équivalents `chef_*`, ce qui reste une supposition.

---

## 1. Défauts transversaux

| # | Défaut | Écrans touchés | Gravité |
|---|---|---|---|
| T1 | **Contrôles natifs du navigateur** : dates `mm/dd/yyyy` avec icône système, heure `08:30 AM`, bouton gris `Choose File / No file chosen` en anglais, listes déroulantes à flèche système. Le format américain et l'anglais peuvent venir de la langue du navigateur de capture, mais le contrôle reste natif et hors charte. | `chef_agents_nouveau`, `chef_agents_fichier`, `chef_engins_fiches_fichier`, `chef_planning_preparer_fichier`, `chef_planning_preparer_annee_etape=reperes`, `chef_planning_preparer_manoeuvre`, `..._manoeuvres_manoeuvre`, `chef_planning_ete_panneau=periode`, `chef_moi_vacances`, `chef_reservations_id_reserver_jour`, `chef_engins_nouveau`, `chef_engins_id_modifier`, `chef_reglages_roles_nouveau_modele`, `admin_reservations_materiel_retirer` | élevée |
| T2 | **Bouton principal rouge en 3 versions** : avec halo rouge dessous (en-têtes : Écrire, Ajouter, Réserver, Préparer l'année) ; avec contour blanc épais (formulaires : Signaler, Enregistrer, Commenter) ; rouge nu (Faire la prise, Retirer dans `admin_reservations_materiel_retirer`). Le contour blanc donne l'impression d'un focus permanent ; le halo fait « généré par IA ». | Toute l'appli | élevée |
| T3 | **Bouton secondaire en 2 versions** : bord fin, et bord épais plus grand (Fermer les commentaires, Épingler, Je suis disponible tout l'été, Ajouter cette période, Ajouter l'élément, Changer le lien). Elles se côtoient parfois dans la même carte, avec deux tailles de texte. S'y ajoutent le bouton blanc plein (J'ai pris connaissance, Fêtes ›), le bouton pointillé (Valider la prise), et le lien souligné (Écart, Échanger avec un collègue). | `chef_echanges_mur_`, `chef_echanges_mur_id_`, `chef_engins_fiches_id_retirer-zone`, `chef_moi_vacances`, `chef_moi_agenda`, `agent_mur-equipe`, `agent_prise` | élevée |
| T4 | **Champ de saisie en 3 versions** : contour clair épais (donne l'air d'être tous en focus en même temps), bord sombre discret, fond noir sans contour clair. | Clair : `chef_agents_nouveau`, `chef_reglages_aptitudes`, `chef_engins_fiches_id_retirer-zone`, `chef_profil`. Discret : `chef_engins_anomalies_signaler`, `chef_echanges_publier*`. Noir : `chef_moi_vacances`, `chef_planning_preparer_annee_etape=reperes` | élevée |
| T5 | **Une carte par ligne** (règle : une carte par groupe de lignes). | `chef_nominations` (8 cartes), `chef_agents_id_` (colonne droite), `chef_engins_id_` et `chef_engins_fiches_id_` (zones), `chef_planning_vue=annee` et `=equipes` (12 mois), `admin_reservations_materiel_retirer`, `agent_prise` (zones), `chef_planning_preparer` (roulement) | élevée |
| T6 | **Boutons épars au lieu d'un bloc segmenté** (règle `.segments`) : filtres et choix affichés en rectangles séparés. Pour les droits, grille à 2 colonnes avec un 3ᵉ choix orphelin. | `chef_agents*` (Tous, À compléter…), `chef_engins_anomalies*` (filtres engins), `chef_planning_preparer*` (2026/2027), `chef_reglages_roles_id_`, `chef_reglages_profils_id_` | moyenne |
| T7 | **Bandes de couleur à gauche partout.** Celles qui indiquent une équipe ne violent pas la règle à la lettre, mais elles doublent souvent un point ou un visage de même couleur. Celles de sélection ou d'alerte sont le travers visé par la règle. | Équipe : `chef_agents*`, `chef_planning_preparer`, `chef_planning_ete_annee`, `chef_planning_vue=equipes`, `agent_planning`. Sélection : sous-menu des murs, liste de conversations, `chef_reglages_*`. Alerte : ligne « Départ du centre » de `chef_agents_id_` | moyenne |
| T8 | **Sur-titres en majuscules espacées avec pastille de compteur blanche** sur presque chaque groupe (À DÉCIDER 7, AU CENTRE 4, RÉFÉRENTS 4…). Le compteur n'apprend rien sur une liste courte visible en entier ; signature très « IA ». Dans les murs, ÉPINGLÉES et PUBLICATIONS ont un autre style. | `agent_accueil`, `admin_`, `chef_`, `agent_engins`, `chef_engins`, `chef_comites`, `chef_reglages*`, `chef_habillement_toutes`, `agent_mur-equipe` | moyenne |
| T9 | **Tuiles d'icônes pastel arc-en-ciel** : justifiées pour rôles et comités, mais la tuile d'alerte identique répétée n'y distingue rien, et le sélecteur d'icônes étale 11 couleurs. | Répétition : `admin_`, `chef_` (À décider), `agent_engins` (2 lignes). Sélecteur : `admin_reservations_materiel_retirer`, `chef_reglages_comites_id_`, `chef_reglages_comites_nouveau`, `chef_reglages_roles_nouveau_modele` | moyenne |
| T10 | **Largeur de contenu sans logique** : 1028 px (Accueil, Planning), 960 (Préparer, Nominations), 832 (Fiche), environ 765 (Remplacements), 704 (Réglages), 640 calé à gauche (Moi, Signaler), 640 centré (Publier, Nouveau message). Les pages étroites laissent 300 à 400 px morts à droite. | Toute l'appli ; pires cas : `agent_moi`, `chef_moi_*`, `chef_profil`, `chef_engins_anomalies_signaler`, `anon_affichage` | élevée |
| T11 | **Colonnes fantômes** : la mise en page à 2 colonnes reste quand la droite n'a pas de contenu. La colonne gauche fait 583 px avec un vide à droite. | `agent_engins`, `chef_engins_anomalies`, `chef_engins_anomalies_engin` | moyenne |
| T12 | **Colonnes très déséquilibrées** : une colonne longue à côté d'un petit bloc, grand vide dessous. | `admin_`, `chef_` (bloc Gérer), `agent_planning`, `chef_planning*` (À venir), `agent_echanges`, `chef_echanges`, `admin_echanges`, `chef_habillement_toutes`, `chef_reservations` | moyenne |
| T13 | **Retours en 4 formes** : chevron et texte gris (`Moi`), lien souligné (`‹ Le centre`, `chef_echanges_mur_id_`), texte `Annuler` seul (`chef_echanges_publier*`), flèche seule (conversations, où la liste reste pourtant visible). | Échanges, Moi, Engins | moyenne |
| T14 | **En-têtes et titres incohérents** : titre à gauche avec action à droite, titre centré petit (`Nouvelle publication`, `Nouveau message`), titre absent (`chef_reglages_aptitudes` commence par 2 boutons), hauteur variable (y≈97 ou 105). 4 niveaux de titres peuvent s'empiler (`chef_comites`). | Toute l'appli | moyenne |
| T15 | **Confirmations en 3 formes, ordre inversé** : bloc rouge `Garder` puis `Retirer` (`admin_reservations_materiel_retirer`) ; double cadre blanc et rouge `Oui, retirer` puis `Annuler` (`chef_engins_fiches_id_retirer-zone`) ; panneau avec boutons empilés (`..._panneau=recalculer`). | Ces 3 écrans | moyenne |
| T16 | **Boutons radio en 4 versions** : point blanc (`chef_engins_anomalies_signaler`), point rose (`anon_affichage`), point bleu sans carte (`chef_planning_preparer_manoeuvre`), rond vide à droite pour un choix multiple (`chef_echanges_messages_nouveau_groupe`). L'état non coché est un disque gris-brun terne. | Ces écrans et formulaires voisins | moyenne |
| T17 | **Petites étiquettes peu lisibles** : dans pastilles, étapes et petits libellés gras, le point des i disparaît à l'œil à taille réelle (« Dlsponlble », « Férlé », « Pérlode », « Vérlfler et publler »). | Pastilles partout, étapes, `agent_planning`, `agent_echanges` | moyenne |
| T18 | **Répétition d'une même info** dans une ligne ou d'un écran à l'autre : type redit sous le nom (`FPT` / `FPT · AA-102-SP`), `Calendrier des réservations` 3 fois, `Personne pour l'instant` 3 fois, `Importer` / `Importer un fichier`, descriptions sous chaque ligne de menu. | `agent_engins`, `chef_engins`, `chef_engins_prise`, `chef_comites`, `chef_agents_fichier`, `agent_moi`, `chef_moi`, `agent_caserne`, `chef_caserne` | moyenne |
| T19 | **Icônes Accueil et Caserne presque identiques** dans le menu (deux maisons), alors qu'elles sont l'une sous l'autre à une ligne d'écart. | Tous les écrans connectés | moyenne |
| T20 | **Bande hachurée rouge et jaune permanente** sous l'en-tête : forte présence sur tous les écrans, y compris les plus calmes. À garder si c'est un choix d'identité, mais c'est l'élément le plus criard de l'interface. | Tous | faible |
| T21 | **Parcours par étapes redondant** : « Étape 1 sur 5 », barre de progression, ronds numérotés et case encadrée disent la même chose. | `chef_planning_preparer*`, `chef_planning_ete*` | moyenne |
| T22 | **Même illustration Gyro à la loupe pour tous les vides**, y compris quand on ne cherche rien (`Écrivez votre premier message`). | Écrans vides | faible |
| T23 | **Mot « Touchez » sur ordinateur.** | `chef_planning_ete_annee`, `chef_planning_preparer_annee_etape=publier`, `agent_prise` (« touchez ») | faible |
| T24 | **Cadres à bord fin** contraires à la règle des cartes sans bord : messages « Ouvrez d'abord… », bloc Enregistrer de `chef_reglages_profils_id_`, message système de `chef_reglages_roles_id_`. | Ces écrans | faible |
| T25 | **Plus de deux infos reliées par « · »** : `4 zones · 33 éléments · version 1, du 8 nov.…` ; `Version 1, du… · 4 zones · 33 éléments`. | `chef_engins_id_`, `chef_engins_fiches_id_` | faible |

---

## 2. Écran par écran

### Accueil
- `agent_accueil` — titre de consigne tronqué (« Merci de conf… ») alors qu'il reste environ 350 px libres à droite — **moyenne**
- `agent_accueil` — 3 points de départ du texte dans une même liste (tuile 40, tuile 48, date 64) — **moyenne**
- `agent_accueil` — Gyro minuscule, flottant en haut à droite, sans lien avec le reste — **faible**
- `chef_`, `chef_casquette=astreinte` — bloc segmenté de 1028 px pour 2 choix ; poids énorme pour une bascule — **moyenne**
- `chef_` — 3 piles (segmenté, bandeau jaune, À décider) avant le contenu ; bloc Gérer seul à droite avec un vide de plus de 600 px dessous — **moyenne**
- `chef_` — sondage dans la ligne Manœuvre : lien bleu sous les boutons, puis ligne de sondage juste en dessous ; deux entrées proches — **moyenne**
- `chef_`, `admin_` — tuile d'alerte identique sur chaque ligne d'À décider : aucune distinction — **moyenne**
- `admin_` — « Bonjour » sans nom, phrase décorative seule ; lignes À ne pas manquer redondantes (`3 nouveautés` + pastille 3) — **faible**
- `admin_`, `agent_accueil` — pastille rouge et ligne « 1 nouveauté » répètent la même info — **faible**

### Planning
- `agent_planning` — « Votre équipe est d'astreinte dans 26 jours » dit deux fois de suite (sous le titre et dans le bandeau) — **moyenne**
- `chef_planning*` — « Cette semaine : Équipe 1 d'astreinte » répété sous le titre, dans le bandeau, et « Équipe 1 » encore sur la ligne de dates — **moyenne**
- `chef_planning*`, `agent_planning` — bandeau jaune de 855 px, très saturé, alors qu'il porte une info courante ; bouton Remplacements posé à côté, hors du bandeau — **moyenne**
- `agent_planning`, `chef_planning_annee_semaine_vue=semaine` — liste de semaine : date et heures empilées, 500 px vides à droite de chaque ligne — **moyenne**
- `agent_planning` — dans le bandeau, un bouton plein et un lien souligné côte à côte pour 2 actions — **faible**
- `agent_planning`, `chef_planning*` — semaine : encart équipe et bandeau jaune se ressemblent et se suivent — **moyenne**
- `chef_planning_vue=mois` — calendrier de 615 px seulement, ligne d'équipe intercalée, couleur d'équipe réduite à un carré ; jours sans lien visuel avec l'équipe — **moyenne**
- `chef_planning_vue=mois` vs `chef_reservations_id_` — deux calendriers sans parenté : semaine commençant vendredi ou lundi, flèches ou boutons texte, aujourd'hui en pastille ou en cadre — **élevée**
- `chef_planning_vue=annee`, `chef_planning` (équipes) — 12 cartes-mois quasi identiques d'une vue à l'autre, 1414 px de haut ; une grille annuelle tiendrait à l'écran — **élevée**
- `chef_planning*`, `agent_planning` — liens `‹ 2025` / `2027 ›` soulignés en bas de page, hors de la navigation du haut — **faible**

### Préparer l'année
- `chef_planning_preparer` — le contenu de l'étape commence à y=513 : titre, années, liste, étapes passent d'abord — **élevée**
- `chef_planning_preparer` — Roulement : carte sombre dans la carte, bande et point de même couleur, aspect de champ alors que c'est en lecture seule ; ligne de 925 px pour 2 mots — **moyenne**
- `chef_planning_preparer` — Aperçu : 5 cases puis S6 orpheline — **faible**
- `chef_planning_preparer_annee_etape=fetes` — 2 cartes teintées à bande gauche, phrase « Dans son tour » répétée — **faible**
- `chef_planning_preparer_annee_etape=reperes` — `Retirer` en rouge ici, neutre ailleurs ; champs noirs et natifs — **moyenne**
- `chef_planning_preparer_annee_etape=publier` — mosaïque de 52 cases multicolores à bande basse, `S1` gris très petit, peu de contraste ; aspect le plus chargé de l'appli — **moyenne**
- `chef_planning_preparer_annee_etape=publier` — liste à puces et « Publiée » : bilan simple mais sans action visible ici — **faible**
- `..._publier_semaine` — panneau de 480 px pour une phrase et une alerte ; texte collé à la marge droite — **faible**
- `chef_planning_preparer_manoeuvre` — radios sans carte, cases décalées, heure en AM natif ; style différent des autres formulaires — **moyenne**
- `..._manoeuvres_manoeuvre` — `Supprimer la manœuvre` dans une carte séparée, sans marque de danger — **faible**
- `chef_planning_preparer_fichier` — 2 cartes pleine largeur pour peu de texte ; `Choose File` natif ; disposition différente de `chef_engins_fiches_fichier` (2 colonnes numérotées) — **moyenne**

### Été
- `chef_planning_ete` — `Ouvrir la saisie` (rouge) et `Vacances ›` (blanc plein) : deux boutons principaux ; le second flotte plus bas à droite — **moyenne**
- `chef_planning_ete_etape=vacances`, `=repartition` — étape vide mais `Répartition ›` en blanc plein ; lien lilas, seule occurrence de cette couleur, contraste moyen — **moyenne**
- `chef_planning_ete_etape=publier` — mêmes défauts sur une étape quasi vide — **faible**
- `chef_planning_ete_annee` — 3 marques de couleur par ligne (bande, point, pastille) ; `FPT armé 7/7` répété 9 fois, seule l'exception compte ; vide à droite — **moyenne**
- `chef_planning_ete_annee` — ordre visuel étrange : 30 juil. en tête, puis 25 juin, sans explication — **moyenne**
- `chef_planning_ete_annee_etape=repartition_plage` — panneau dense : `Retirer` / `Ajouter` répétés sur toute la hauteur, libellé au-dessus du nom ; correct mais lourd — **faible**
- `..._panneau=recalculer` — action qui efface le travail : rouge, mais boutons empilés (forme propre à cet écran) — **moyenne**
- `chef_planning_ete_panneau=periode` — dates natives étroites dans un panneau large — **faible**

### Remplacements
- `agent_remplacements`, `chef_remplacements`, `chef_remplacements_onglet` — largeur à part (environ 765 px), vide à droite ; bouton halo en haut ; liens soulignés orphelins en bas — **moyenne**
- `chef_remplacements` — explication en liste numérotée sous « Aucune demande », sans lien avec le reste — **faible**
- `chef_remplacements_demander`, `_mode`, `chef_remplacements_manoeuvre` — texte vide correct, 3 écrans identiques ; pas de défaut propre

### Échanges et murs
- `agent_echanges`, `chef_echanges`, `admin_echanges` — segmenté de 1028 px pour 2 choix ; 2 colonnes de hauteurs différentes, grand vide dessous — **moyenne**
- `agent_echanges`, `agent_mur-equipe`, `chef_echanges_mur*` — carte « Aujourd'hui au centre » en dégradé marron-bordeaux : seul dégradé, aspect « IA », répété à chaque mur — **moyenne**
- `agent_echanges`, `chef_echanges` — en-tête rouge plein de « Le centre » + pastille Officiel très lourds pour une carte de liste — **moyenne**
- `chef_echanges_mur_`, `agent_mur-equipe` — 4 colonnes à 1280 px : fil de 476 px, écrasé entre le sous-menu et l'aside — **élevée**
- `chef_echanges_mur_` — 7 boutons sur 3 rangées (J'aime, Commenter, Voir le suivi, Répondre en privé, Fermer, Épingler, Supprimer) en 2 tailles, même poids ; compteur intercalé au milieu ; `Supprimer` sans distinction — **élevée**
- `chef_echanges_mur_` — bouton flottant « Publier dans Amicale » avec halo, alors que les autres écrans ont l'action en en-tête — **moyenne**
- `chef_echanges_mur_` — en-tête Amicale : texte rose sur fond bordeaux, bloc rose sur rose ; contraste à vérifier — **moyenne**
- `agent_mur-equipe` — en-tête rouge énorme + bandeau rouge sombre « Visible par » : rouge sur rouge — **moyenne**
- `agent_mur-equipe` — carte épinglée à contour ocre + en-tête ocre + bouton blanc pleine largeur + 3 boutons : beaucoup d'ornements dans une carte — **moyenne**
- `agent_mur-equipe` — carte Bravo fond ambre, confettis épars : acceptable en réussite, mais « ! » seul à la ligne (espace insécable manquant) — **faible**
- `agent_mur-equipe` — sondage imbriqué dans une carte dans une carte — **faible**
- `chef_echanges_mur_id_` — titre « Publication de Antoine Adjoint » (élision « d'Antoine ») ; retour souligné à part — **moyenne**
- `chef_echanges_mur_id_` — réponses de sondage en grands boutons en pilule : pilule réservée aux états — **moyenne**
- `chef_echanges_mur_id_` — Suivi : 37 noms en paragraphe brut, « personne » répété, sans structure ni visage — **élevée**
- `chef_echanges_mur_id_` — bouton Commenter rouge sous un champ à contour blanc : le plus visible de la page alors que le message est le sujet — **faible**
- `admin_echanges`, `chef_echanges` — « Supervision » : ligne pliable seule dans la colonne, sans poids clair — **faible**
- `chef_echanges_publier`, `_mur`, `_mur_texte` — destinations en petits radios-rectangles (8 sur 2 rangées), genres en grands radios-cartes : 2 styles dans un même formulaire — **moyenne**
- `chef_echanges_publier*` — `Annuler` en simple texte, titre centré petit ; page centrée, seul formulaire ainsi — **moyenne**
- `chef_echanges_publier_mur` — bandeau rose « Visible par » : couleur d'équipe en grande surface — **faible**
- `chef_echanges_messages_nouveau` — liste directement sur le fond, sans carte, 2545 px de haut, sans groupes — **moyenne**
- `chef_echanges_messages_nouveau_groupe` — ronds à droite pour un choix multiple (lus comme radios) ; 2556 px de haut — **moyenne**

### Messages
- `agent_conversation`, `chef_echanges_messages_a_personne_*` — flèche retour alors que la liste est visible à côté — **faible**
- `agent_conversation` — bulle envoyée bordeaux sombre sur fond sombre, heure minuscule : contraste faible — **moyenne**
- `agent_conversation` — liste de 288 px, nom tronqué (« Élodie Chef-de-G… ») ; bande rose de sélection — **faible**
- `agent_conversation` — phrase de confidentialité répétée dans la liste et dans Infos — **faible**
- `agent_conversation-infos` — page centrée isolée alors que le panneau Infos existe déjà à cet écran ; sur-titre FICHE COURTE — **moyenne**
- `chef_echanges_messages_a_personne_`, `_publication` — « Aucune conversation à ce nom. » affiché sans recherche saisie — **moyenne**
- `chef_echanges_messages_a_personne_` — Gyro à la loupe pour inviter à écrire : image hors sujet — **faible**

### Agents
- `chef_agents`, `_filtre=a-completer` — en-têtes d'équipe écrasés sur 3 lignes (« 9 agents · sans chef de garde ») à côté du chevron et de Nommer ; hauteurs différentes, lignes décalées entre colonnes — **élevée**
- `chef_agents` — pastille sous le nom : hauteur de chaque ligne doublée, 1845 px au total — **élevée**
- `chef_agents` — Sans équipe et Extérieurs empilés sous la 1ʳᵉ colonne, grand vide sous les 3 autres — **moyenne**
- `chef_agents` — équipe marquée par bande + visage + carte : redondance, surface très colorée — **faible**
- `chef_agents_id_`, `_fichier`, `_nouveau` — la liste passe à une colonne et rallonge la page (au moins 3000 px) ; le panneau droit se retrouve seul en haut — **élevée**
- `chef_agents_id_` — 6 cartes-lignes (T5) ; « Départ du centre » à bande rouge — **moyenne**
- `chef_agents_id_` — en-tête centré à bande jaune et avatar chevauchant, seul de ce style ; boutons ronds teintés rouge pour Message et Courriel — **moyenne**
- `chef_agents_nouveau` — titre du formulaire à la hauteur de « Agents », mais 3 cartes et formulaire long dans une colonne parallèle à la liste ; 6 champs natifs — **moyenne**
- `chef_agents_fichier` — `Choose File` natif ; `Importer` puis `Importer un fichier` ; phrase de 3 lignes sous le titre — **moyenne**

### Caserne, comités, nominations
- `agent_caserne`, `chef_caserne` — descriptions sous chaque ligne, écran occupé sur le tiers haut seulement ; acceptable pour un menu — **faible**
- `chef_comites` — personnes, mur et ressources mélangés dans une même carte ; lignes aux formes différentes — **élevée**
- `chef_comites` — 3 niveaux de titres en 2 colonnes (page, Comités, AMICALE) — **moyenne**
- `chef_comites` — `Écrire à Chloé Durand` et `Écrire à Hélène Habillement` empilés dans la ligne, cassent le rythme ; pas de bouton pour soi — **moyenne**
- `chef_comites` — tuiles sur certains groupes, pas sur d'autres — **faible**
- `chef_nominations` — une carte par rôle (T5) — **moyenne**
- `chef_nominations` — pilules bleues à croix pour des personnes : pilule réservée aux états ; `À pourvoir` en pilule ocre juste à côté — **moyenne**

### Engins et prise de garde
- `agent_engins`, `chef_engins` — lignes de 3 niveaux avec type redondant, `Prise à faire` répété 4 fois — **moyenne**
- `agent_engins` — vide de 417 px à droite (T11) — **moyenne**
- `chef_engins_id_` — 5 boutons de même poids dans la carte État ; actions rares (Modifier la fiche) aussi visibles que courantes — **moyenne**
- `chef_engins_id_` — zones en cartes (T5) et titres condensés, alors que les autres listes ont un titre courant — **faible**
- `chef_engins_id_modifier`, `chef_engins_nouveau` — select natif, radios-cartes, 3 styles ; contour clair sur tous les champs — **moyenne**
- `chef_engins_prise` — seule VTU a une tuile : titres décalés d'une ligne à l'autre ; type redit ; liste de 960 px pour peu d'infos — **moyenne**
- `agent_prise`, `chef_engins_id_prise` — bloc rouge énorme « VSAV 1 » : lu comme une alerte alors que c'est un en-tête — **moyenne**
- `agent_prise` — pavé d'instructions permanent avant la liste — **moyenne**
- `agent_prise` — `Écart` souligné répété sur chaque ligne ; pastille `×3` isolée — **faible**
- `agent_prise` — `Tout est complet` calé à gauche sous la liste, loin du regard ; `Valider la prise` en pointillés dans une carte à part : état désactivé peu standard — **moyenne**
- `admin_engins_id_prise` — hérite de la mise en page sans les actions ; plusieurs blocs pour peu de contenu — **faible**

### Anomalies
- `chef_engins_anomalies` — une ligne de 583 px, le reste vide (T11) — **moyenne**
- `chef_engins_anomalies_engin` — écran vide centré dans la colonne gauche, pas dans la page ; `Signaler un problème` présent 2 fois — **moyenne**
- `chef_engins_anomalies_id_`, `chef_anomalie-attente` — `Rendre l'engin indisponible`, décision rare, est le seul bouton rouge, plus visible que `Réparée…` — **élevée**
- `chef_engins_anomalies_id_` — mêmes dates et personnes dans Suivi, Le problème et Historique — **moyenne**
- `chef_engins_anomalies_id_` — `Voir VTU` pleine largeur, ressemble à un champ — **moyenne**
- `chef_engins_anomalies_id_` — alerte « VTU reste disponible » redite dans la carte Disponibilité — **moyenne**
- `..._panneau=clore`, `=reparee` — panneau presque vide ; `Clore` rouge plus visible que le champ — **faible**
- `chef_engins_anomalies_signaler`, `_engin` — 640 px calé à gauche, vide à droite ; radios engin en cartes de 2 hauteurs selon la présence du type — **faible**

### Fiches
- `chef_engins_fiches` — colonne droite mêlant création et lien fichier, sur-titre EN UNE FOIS — **faible**
- `chef_engins_fiches_fichier` — `Choose File` ; « Exporter les fiches » redit 3 fois ; « Fichier des fiches » redit le titre — **moyenne**
- `chef_engins_fiches_id_retirer-zone` — 4 boutons par ligne sur 7 lignes : surcharge ; `Modifier` tombe seul à la ligne quand il y a une quantité — **élevée**
- `chef_engins_fiches_id_retirer-zone` — formulaire d'ajout pointillé toujours ouvert au milieu de la zone ; `Ajouter l'élément` et `Ajouter la zone` de poids différents — **moyenne**
- `chef_engins_fiches_id_retirer-zone` — `Monter`, `Descendre`, `Renommer` sur 2 lignes ; double cadre blanc et rouge de la confirmation — **moyenne**
- `chef_engins_fiches_id_` — zones en cartes séparées (T5) — **faible**

### Habillement
- `chef_habillement` — écran vide à droite d'un formulaire : correct mais déséquilibré — **faible**
- `agent_habillement` — `Faire une demande` puis `Votre demande` : titre et libellé redondants — **faible**
- `chef_habillement_id_`, `admin_habillement_id_` — titre = texte libre de l'agent, en très grand ; « Le fil » redit ce texte juste en dessous — **moyenne**
- `chef_habillement_id_` — carte Suivi étroite, `Poser une question…` et `Traiter…` sous le bouton rouge, en 2 rangées — **faible**
- `chef_habillement_id_` vs `chef_engins_anomalies_id_` — même type de suivi, pastille à droite ici et au-dessus là — **faible**
- `chef_habillement_id_panneau=question`, `=traiter` — pas de défaut propre (T2, T4)
- `chef_habillement_toutes` — 6 lignes à gauche contre 2 à droite ; textes sur 2 lignes à côté d'une pastille — **faible**

### Réservations
- `chef_reservations_id_`, `_jour` — une carte bordée par jour, 42 cadres : grille lourde ; le fond change de teinte d'un jour à l'autre sans clé visible — **élevée**
- `chef_reservations_id_` — texte de réservation minuscule en italique, pointillés ocre ; texte dans une case étroite — **moyenne**
- `chef_reservations_id_jour` — capture strictement identique à `_id_` : aucun état visible pour le jour — **moyenne** (à vérifier)
- `chef_reservations_id_reserver_jour` — dates natives ; 640 px calé à gauche — **moyenne**
- `agent_reservations`, `chef_reservations` — colonne « Suivre » pour une seule ligne, vide dessous — **faible**
- `admin_reservations_materiel_retirer` — cartes par ligne ; `Modifier` seul sous le bloc rouge de confirmation ; titre « Ajouter du matériel » décalé de la carte voisine — **moyenne**

### Moi et profil
- `agent_moi`, `chef_moi` — 640 px calé à gauche, moitié droite vide ; 8 descriptions, une sous chaque ligne — **moyenne**
- `agent_moi`, `chef_moi`, `admin_moi` — `Se déconnecter` centré, seul élément centré de la page ; rose — **faible**
- `agent_moi` — carte d'identité à fine bande jaune en haut — **faible**
- `admin_moi` — carte « Super administrateur » avec tuile, sous-titre explicatif ; correct, mais écran presque vide — **faible**
- `chef_profil` — champs à contour clair, cases à libellés gras ; formulaire de 640 px avec vide à droite — **faible**
- `chef_moi_agenda` — 3 cartes de texte, boutons `+` ronds pour déplier (composant vu nulle part ailleurs) ; alerte en texte ocre gras seul — **moyenne**
- `chef_moi_vacances` — champs noirs natifs, `Ajouter cette période` à bord épais ; `Retirer` loin de la date qu'il concerne — **moyenne**
- `chef_moi_notifications` — 3 cartes de texte, un interrupteur petit — **faible**
- `chef_affichage`, `anon_affichage` — radios-cartes pleine largeur pour 2 mots ; 640 px calé à gauche ; point rose isolé (T16) — **faible**

### Réglages
- `chef_reglages` — 704 px, 340 px morts à droite ; une liste à gauche et un détail à droite auraient leur place ici (c'est le cas dès qu'on ouvre une fiche) — **moyenne**
- `chef_reglages` vs détail — boutons `+ Comité` / `+ Nouveau rôle` (rouge) sur la liste ; `+ Nouveau rôle` / `+ Nouveau comité` (neutres) en mode détail : libellés et poids différents ; titre de page disparu — **moyenne**
- `chef_reglages_aptitudes` — 10 champs à contour clair + 10 `Enregistrer` + 10 `Retirer` : grille de boutons, champ le plus visible de la page — **élevée**
- `chef_reglages_aptitudes` — sous-titre « Les aptitudes du centre. » répète le titre ; retour à la ligne laid avant « : » — **faible**
- `chef_reglages_aptitudes` et autres `_reglages_*` — liste de 1561 px toujours affichée : le détail se termine bien plus haut, longue colonne vide — **moyenne**
- `chef_reglages_roles_id_` — rôle système non modifiable, mais boutons à l'apparence active, chevrons et `✓` : la lecture seule ne se voit pas — **élevée**
- `chef_reglages_roles_id_` — gros vide entre le message système et la phrase suivante — **faible**
- `chef_reglages_roles_id_`, `_profils_id_` — grille de droits : hauteurs inégales, 3ᵉ choix orphelin, libellés sur 2 lignes (T6) ; cartes de hauteurs inégales dans chaque rangée — **élevée**
- `chef_reglages_profils_id_` — choix non sélectionnés gris, lus comme désactivés alors qu'ils sont cliquables — **moyenne**
- `chef_reglages_profils_id_` — `Rien dans ce domaine.` répété 5 fois ; `Enregistrer` dans une barre bordée pleine largeur, seule de ce type — **moyenne**
- `chef_reglages_roles_id_` — tuile isolée à droite du titre, éloignée — **faible**
- `chef_reglages_comites_id_` — `Dissoudre le comité` en ligne neutre, action grave sans marque ; sélecteur d'icônes à orpheline — **moyenne**
- `chef_reglages_comites_nouveau`, `_roles_nouveau_modele` — sélecteur d'icônes arc-en-ciel à orphelines ; select natif — **moyenne**
- `chef_reglages_roles_nouveau` — modèles en cartes sur 2 colonnes, descriptions de 2 lignes ; 7 cartes pour un choix — **faible**
- `chef_reglages_armement` — `Modifier` répété, ligne Correspondance seule plus bas — **faible**
- `chef_reglages_armement_engin` — `Enregistrer` pleine largeur dans ce panneau, petit à gauche dans les autres — **faible**

---

## 3. Écrans sans défaut notable (hors défauts transversaux)
`anon_connexion`, `agent_notifications`, `chef_notifications`, `chef_reservations_a-valider`, `chef_reservations_materiel`, `chef_reservations_miennes`, `chef_remplacements_demander`, `chef_remplacements_demander_mode`, `chef_remplacements_manoeuvre`, `agent_messages`, `chef_echanges_messages`, `chef_moi_installer`, `chef_habillement_id_panneau=question`, `chef_habillement_id_panneau=traiter`.

## 4. Les 3 écrans les plus réussis
1. **`agent_accueil`** : l'essentiel saute aux yeux (26 jours, deux actions directes), puis une seule carte à lignes par ordre d'urgence. On agit sans changer de page.
2. **`agent_conversation`** : le seul écran vraiment pensé pour l'ordinateur, avec liste, fil et infos sur toute la hauteur, sans carte superflue et sans vide.
3. **`agent_habillement`** : deux colonnes qui ont chacune une raison d'être (demander à gauche, suivre à droite), une carte par groupe, des pastilles qui ne disent que l'état.
