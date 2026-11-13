# 0033 — Souhaiter un anniversaire : un bouton, pas une publication

- **Contexte** : les anniversaires du jour s'affichent (« Aujourd'hui au centre », bandeau de Vie du centre, fête de Gyro pour l'agent concerné). « Souhaiter » ouvrait une publication préremplie sur Vie du centre : il fallait l'envoyer, et le mur se remplissait de « Joyeux anniversaire » identiques.
- **Options** : (1) garder la publication préremplie ; (2) publier automatiquement un message le matin ; (3) **un bouton « Souhaiter »** : un appui, l'agent fêté est prévenu.
- **Choix** : (3). Un appui, sans texte : l'agent fêté reçoit dans sa cloche (et sur son téléphone) « Paul Martin vous souhaite un joyeux anniversaire 🎂 », et voit sur son accueil qui le lui a souhaité. Une fois par collègue et par anniversaire ; pas à soi-même ; rien si l'agent a masqué son anniversaire. Rien n'est publié.
- **Données** : une ligne par souhait (`souhait_anniversaire`), qui sert aussi de ligne de cloche ; effacée la nuit suivante, au départ, ou quand l'agent masque son anniversaire ou change sa date dans « Mon profil » (une date changée par le chef sur la fiche : la nuit suivante). Aucune conservation longue.
- **Pourquoi** : un geste simple et chaleureux, un mur qui reste lisible, presque aucune donnée gardée.
- **Validé par** : le porteur (bouton plutôt que publication). Choix de Claude, à valider : la liste des noms sur l'accueil plutôt qu'un compteur ; « Souhaité » en pastille ; le texte de la notification ; au téléphone, les boutons aussi sous le bandeau de Vie du centre.
