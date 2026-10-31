# Harmoniser tous les écrans — design

Demande du porteur (2026-10-29) : appliquer à tous les écrans les choix d'Échanges et de la messagerie : **chaleureux, standardisé, efficace, au goût du jour**. Aucune règle métier ni donnée ne change : c'est un lot d'interface.

## Constat (captures 390 et 1280 px, compte cheffe de centre)

- Échanges est la référence : en-tête avec Gyro et phrase humaine, bouton rond rouge, rangées à pastille colorée, rubriques en titres condensés.
- Ailleurs : gris uniforme, cartes empilées sans icône, liens soulignés « Retour à la liste », 8 boutons rouges « Nommer » à l'écran, avatars gris dans la liste des agents (la couleur d'équipe n'est utilisée que par Échanges), e-mail en sous-ligne au lieu du rôle.
- Accueil ordinateur : « À ne pas manquer » en liens soulignés, « À décider » en 5 bandeaux orange, une seule colonne de 1 000 px.
- Caserne : deux grandes cartes vides « arrive bientôt ». Planning, Notifications : Gyro seul au milieu.
- Moi : deux cartes et un bouton gris. Mon profil du super administrateur : une phrase.
- Coquille ordinateur : le fond du menu de gauche s'arrête à 900 px de haut.

## Motifs retenus (recherche web : Apple HIG, Material 3, Linear, GOV.UK, NN/g)

1. Une rangée type partout : élément de tête (visage, pastille, icône), titre, sous-ligne, valeur ou badge à droite, chevron si on navigue.
2. Des listes plutôt que des cartes ; les cartes restent pour l'accueil et les blocs à part (3-4 au plus).
3. Une seule action principale par écran (bouton rond rouge, libellé visible dès 640 px), le reste en secondaire.
4. Chaque écran vide dit ce qu'il est, à quoi il servira et, si possible, quoi faire.
5. Couleur d'identité : rouge réservé à l'action principale et aux comptes ; couleur d'équipe sur les visages ; icônes de rôle colorées.

## Briques communes (`apps/web/src/lib/ui/`)

- **`EnTetePage`** : titre (h1), phrase optionnelle, Gyro optionnel (selon le niveau d'affichage), action principale optionnelle (lien ou bouton rond rouge, le même qu'« Écrire »), lien de retour optionnel « ‹ Agents » au-dessus du titre. Remplace les en-têtes faits à la main.
- **`Rangee`** : lien (ou bouton) de 56 px mini, rayon 18 px, comme les tuiles de mur ; emplacements tête / titre / sous-ligne / droite ; chevron si `href`. Variante `alerte` (icône et texte d'alerte, jamais la couleur seule).
- **`ListeRangees`** : `<ul>` de rangées séparées de 10 px, avec rubrique optionnelle (h2 condensé 1,25 rem) et compteur.
- **`Vide`** enrichi : titre, phrase d'explication, action optionnelle ; Gyro selon le niveau.
- **`app.css`** : classes communes `.masque` (texte pour lecteur d'écran), `.doux`, `.rubrique` ; à retirer des copies locales.

## Écrans

| Écran | Changement |
|---|---|
| Coquille | Menu de gauche sur toute la hauteur à l'ordinateur. |
| Accueil | En-tête « Bonjour Claire » + phrase ; « À ne pas manquer » en rangées (tuile date pour un événement, réponse Présent/Absent/Incertain gardée, icône pour sondage et épinglée, nouveautés avec la pastille du mur et le compte) ; « À décider » en rangées d'alerte, 3 visibles puis « Voir les N autres » ; « Gérer » en rangées à icône. Ordinateur : deux colonnes. |
| Caserne | Rangées à icône avec une valeur utile (« 14 agents », « 3 rôles à pourvoir ») ; « Bientôt » : une rubrique de rangées discrètes (Engins, Comités) avec pastille « Bientôt », plus de grandes cartes vides. |
| Planning | Vide enrichi : ce qui viendra (astreintes, disponibilités, remplacements). |
| Notifications | En-tête standard, regroupement Aujourd'hui / Plus tôt si la donnée le permet, rangées à icône ; vide « Tout est à jour ». |
| Moi | Carte d'identité (visage couleur d'équipe, nom, grade · équipe) ; rangées à icône (Mon profil, Affichage) ; « Se déconnecter » seul en bas, en texte rouge. Super administrateur : sa propre carte. |
| Mon profil / Affichage | En-tête standard avec retour vers Moi ; super administrateur : vide expliqué. |
| Connexion | Gyro, une phrase, un champ, un bouton ; après envoi : l'adresse rappelée et « Changer d'adresse ». |
| Agents | En-tête avec action « Ajouter » et secondaire « Fichier » ; une barre de recherche avec loupe ; filtres en puces sur une ligne qui défile ; rangées à visage couleur d'équipe, sous-ligne grade · rôle (plus l'e-mail), statut à droite. Ordinateur : la colonne de droite vide montre un vide soigné. |
| Fiche agent | En-tête coloré (couleur d'équipe) avec grand visage, nom, grade · équipe, statut ; actions rapides Message, Courriel, Appeler (si numéro) ; sections en rangées à icône ; retour « ‹ Agents ». |
| Nominations | Rangées : icône du rôle, nom, périmètre, titulaires ou « À pourvoir » à droite ; un seul lien « Nommer » par rangée, en secondaire. |
| Réglages et sous-pages | En-tête standard, rangées à icône par thème, jauge photos en rangée, « Nouveau rôle » principal, « Nouveau comité » secondaire. |
| Formulaires (nouvel agent, rôle, comité, fichier) | En-tête standard avec retour ; pas d'autre changement. |

## Hors périmètre

Échanges et messagerie (déjà la référence) ; nouvelles fonctions ; textes métier.

## Vérification

- Tests existants au vert (unitaires et Playwright avec axe) ; tests ajoutés pour les briques (`Rangee`, `EnTetePage`, `Vide`).
- Captures avant/après 390 et 1280 px, clair et sombre, jointes à la PR.
