# 0010 — Les photos dans leur propre base D1

- **Contexte** : les photos des murs étaient rangées dans la base D1 de l'appli, sur un calcul de « 5 Go gratuits ». En formule gratuite Cloudflare, c'est **500 Mo par base** (5 Go pour tout le compte). Avec des photos de 400 Ko, la base principale aurait été pleine en quelques années, et avec elle toute l'appli.
- **Options** :
  1. une 2ᵉ base D1 réservée aux photos : la base principale ne garde que leurs références ;
  2. des photos plus légères, toujours dans la base principale : on recule l'échéance sans la supprimer ;
  3. le stockage R2 de Cloudflare : fait pour ça, mais il demande un moyen de paiement sur le compte ;
  4. l'offre payante de Workers (5 $/mois) : plus de place, mais un coût pour chaque centre.
- **Choix** : option 1, avec **une seule** base de photos (liaison `PHOTOS`, pas de rotation entre plusieurs bases), des photos de **200 Ko** au plus, et une **jauge** sur la page Réglages, en alerte à 80 % des 500 Mo.
- **Pourquoi** : gratuit et sans moyen de paiement ; la base principale ne peut plus être remplie par les photos ; à 200 Ko, la base des photos tient environ 2 500 photos ; la jauge prévient le chef de centre à temps pour choisir entre l'option 3 et l'option 4.
- **Conséquences** : publier écrit d'abord les octets dans `PHOTOS`, puis la publication dans la base principale (et efface les octets si cette seconde écriture échoue). Supprimer une publication efface ses octets après coup : si cet effacement échoue, ils restent orphelins (place perdue, rien de visible). Les photos de démonstration de la préprod sont perdues à la migration (données fictives).
- **Détails** : [socle.md](../technique/socle.md), [installer-un-centre.md](../technique/installer-un-centre.md).
- **Validé par** : le porteur, 2026-10-29.
