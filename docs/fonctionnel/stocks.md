# Stocks

> **Pas encore livré** : cette page décrit la cible. Seuls existent les droits `GERER_STOCK` (rôle « Référent pharmacie », chef de centre et adjoint) et `SIGNALER_BESOIN_STOCK` (profil Agent) ; il n’y a pas encore d’écran de stock.

## À quoi ça sert

Savoir **ce qui manque et ce qui périme** au centre (pharmacie, consommables), pour que le référent prépare sa commande sans rien oublier.

## Les notions

- **Article** (liste ouverte) : nom, conditionnement (« boîte de 10 »), seuil minimum, lieux où il se trouve.
- **Lieu de stockage** (liste ouverte) : pharmacie, VSAV, sac de premiers secours…
- **Lot** : une quantité d'un article dans un lieu, avec sa date de péremption s'il en a une.
- **Besoin** : un article qui manque ou qui est périmé, avec un statut : **signalé → commandé → reçu**.

## D'où viennent les besoins

1. **Inventaire du référent** : il compte, lieu par lieu, et note les péremptions. Ce qui passe sous le seuil devient un besoin.
2. **Un agent le signale** : « j'ai utilisé le dernier masque à oxygène en intervention » ou « il manque des compresses », en deux gestes depuis l'appli.
3. **La prise de garde** : un élément de fiche relié à un article et noté manquant crée le besoin.
4. **La péremption** : un lot qui arrive à sa date (avec un délai d'alerte réglable) crée le besoin.

## Le déroulé

1. Le référent voit la **liste à commander**, regroupée par article, et convertie en conditionnements (il manque 14 unités, donc 2 boîtes de 10).
2. Il passe la commande **dans le formulaire du SDIS**, comme aujourd'hui, puis marque les besoins comme « commandés ».
3. À réception, il les marque « reçus ». Le stock du lieu est mis à jour, avec les nouvelles péremptions.

## Les règles

- Gérer le stock demande le droit `GERER_STOCK`, sur le périmètre de la responsabilité (par exemple, le référent pharmacie).
- Tout agent peut signaler un besoin.
- Code couleur par article : rouge sous le seuil, jaune au seuil, vert au-dessus.

## Ce que la fonction ne fait pas

- **Pas de commande** : c'est le formulaire du SDIS, auprès de la pharmacie à usage intérieur (PUI), qui fait foi.
- **Pas de médicaments soumis à registre ni de stupéfiants** : ils relèvent de la PUI.

## Exemple

Après une intervention, Léa note « dernier masque à haute concentration utilisé » pour le VSAV. Le référent pharmacie voit la ligne dans sa liste à commander, à côté de deux lots de compresses qui périment le mois prochain. Il remplit le formulaire du SDIS, marque les besoins « commandés », puis « reçus » à la livraison.
