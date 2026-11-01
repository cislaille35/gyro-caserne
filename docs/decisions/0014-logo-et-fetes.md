# 0014 — Logo aux couleurs des équipes, fêtes de Gyro et tirer pour actualiser

- **Contexte** : reprendre du MVP l'icône, « tirer pour actualiser » et les célébrations, avec parcimonie.
- **Choix** :
  - **Icône** : Gyro et quatre traits de lumière, couleurs des équipes du fichier de planning (`#f2c200`, `#e5699a`, `#3d7fd6`, `#3fa34d`, celles de Laillé) écrites dans l'icône : elle est la même pour tous les centres. Fond crème de l'appli. Version masquable dans le cercle de sécurité (40 %). Sources SVG dans le dépôt, PNG régénérés par Chromium (Playwright déjà présent), sans nouvelle dépendance.
  - **Tirer pour actualiser** : accueil, murs d'Échanges, notifications, planning. Pas dans la messagerie (le fil défile déjà). Consigne seule avec « réduire les animations » ou le niveau Sobre.
  - **Fêtes** : trois moments seulement. Mémoire dans le navigateur (aucune migration) : une fête peut revenir une fois sur un autre appareil. Coupées aussi au niveau Sobre. Anniversaire seulement si l'agent montre le sien. Première réservation : quand une seule réservation de l'agent est acceptée et qu'elle est à venir (les 30 dernières passées comptent).
  - **Annonce** : zone `aria-live` sans rôle `status`, pour garder une seule zone d'état par page ; aucune quand la page dit déjà la nouvelle.
- **Pourquoi** : rien à stocker, rien qui bloque l'agent, rien sur les écrans d'urgence.
- **Validé par** : à valider par le porteur.
