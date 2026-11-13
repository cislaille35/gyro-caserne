# Vos données dans Gyro Caserne

## À quoi ça sert

Dire aux agents, simplement, ce que l'appli garde sur eux, où, qui le voit et combien de temps. Page dans l'appli : `/donnees`, ouverte à tous (sans connexion), avec un lien depuis la connexion (« Vos données dans Gyro Caserne ») et depuis Moi (« Vos données »).

## Ce que dit la page

| Rubrique | Contenu |
|---|---|
| Ce qui est gardé | Saisi par le centre : nom, prénom, adresse e-mail, équipe, grade et ses dates, statut, entrée au centre, aptitudes, rôles et comités. Saisi par l'agent s'il le veut (Mon profil) : téléphone, surnom, contact d'urgence. Par l'un ou l'autre : la date de naissance. Ce qu'il fait dans l'appli. Pas de mot de passe. |
| Où | Chez Cloudflare, base dans l'Union européenne (juridiction `eu` de D1, voir [installer-un-centre.md](../technique/installer-un-centre.md)). Lien de connexion par Brevo ; notifications chiffrées par le service de notification du navigateur (Google, Apple ou Mozilla). |
| Qui les voit | Les agents : nom, équipe, grade, planning ; le téléphone si l'agent l'a choisi (masqué par défaut) ; l'anniversaire sauf s'il l'a masqué (visible par défaut). Le chef de centre, l'adjoint et le super administrateur : la fiche entière, aptitudes comprises. Un message : les membres de la conversation et, s'il est signalé, qui modère. |
| Combien de temps | Messages et publications : durées du centre (`centres/<id>/centre.ts`, 12 et 24 mois par défaut, [0023](../decisions/0023-conservation-des-publications.md)). Réservations 12 mois, demandes de tenue 24 mois après leur fin, notifications 30 jours. Souhaits d'anniversaire : effacés la nuit suivante. Agent parti : naissance et contact d'urgence effacés au départ, le reste 12 mois après ([0029](../decisions/0029-effacement-des-agents-partis.md)). |
| Copie de sécurité | Une copie chiffrée par semaine dans la boîte du centre, gardée 3 mois ([0030](../decisions/0030-copie-hebdomadaire.md)). |
| Corriger ou effacer | Téléphone, surnom, date de naissance, contact d'urgence : « Mon profil ». Le reste, ou un effacement sans attendre : le chef de centre ([Données des agents](donnees-des-agents.md)). |

Les durées des messages et des publications viennent de la description du centre : la page suit tout changement de réglage.

## Exemple

Julie veut savoir si son téléphone est visible de tous : la page lui dit « seulement si vous l'avez choisi », et la renvoie à Mon profil. Marc quitte le centre et veut disparaître de l'appli : la page lui dit de le demander au chef de centre, et que l'effacement quitte les copies au plus tard 3 mois après.
