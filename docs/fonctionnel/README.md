# Documentation fonctionnelle

Une page par fonction, avec exemples et cas d'usage. Le modèle commun (briques, droits, périmètres) est dans [`docs/superpowers/specs/2026-10-25-modele-metier-design.md`](../superpowers/specs/2026-10-25-modele-metier-design.md).

| Fonction | Page |
|---|---|
| Accès et attributions | [acces-et-attributions.md](acces-et-attributions.md) |
| Fiche agent | [fiche-agent.md](fiche-agent.md) |
| Comités et référents | [comites-et-referents.md](comites-et-referents.md) |
| Astreinte et rotation | [astreinte-et-rotation.md](astreinte-et-rotation.md) |
| Planning de l'année | [planning-de-l-annee.md](planning-de-l-annee.md) |
| Planning d'été | [planning-d-ete.md](planning-d-ete.md) |
| Composition des gardes | [composition-des-gardes.md](composition-des-gardes.md) |
| Disponibilités et absences | [disponibilites-et-absences.md](disponibilites-et-absences.md) |
| Remplacements et échanges | [remplacements-et-echanges.md](remplacements-et-echanges.md) |
| Prise de garde et engins | [prise-de-garde.md](prise-de-garde.md) |
| Anomalies | [anomalies.md](anomalies.md) |
| Stocks | [stocks.md](stocks.md) |
| Réservations | [reservations.md](reservations.md) |
| Habillement | [habillement.md](habillement.md) |
| Murs (salons) | [salons.md](salons.md) |
| Messagerie | [messagerie.md](messagerie.md) |
| Notifications | [notifications.md](notifications.md) |
| Fêtes de Gyro et actualisation | [fetes-et-actualisation.md](fetes-et-actualisation.md) |
| Météo et vigilance | [meteo-et-vigilance.md](meteo-et-vigilance.md) |
| Affichage | [affichage.md](affichage.md) |
| Écusson du centre | [ecusson-du-centre.md](ecusson-du-centre.md) |

## Ce qui est livré

- **Fiche agent** : la liste des agents par équipe, avec recherche et filtres pour la gestion ; la fiche en blocs ; l'ajout, le départ ; le fichier de l'effectif (import, export).
- **Accès et attributions** : connexion, profils, rôles et comités (page « Réglages »), nominations depuis la fiche ou la page « Nominations ».
- **Comités et référents** (Caserne) : qui est dans quel comité, avec son mur et son matériel, et qui tient chaque rôle du centre ; ouverte à tous les agents.
- **L'appli autour** : les onglets « Accueil », « Planning », « Caserne », « Échanges », la cloche « Notifications », « Moi », les casquettes de l'accueil, le choix de l'affichage, l'aide à l'installation et la pastille sur l'icône.
- **Réservations** (Caserne → Réservations) : la VL et le matériel de l'amicale, calendrier, demandes à valider, notifications.
- **Planning de l'année** : préparer l'année (roulement, semaines, fêtes, manœuvres, vacances) et la publier ; les vues « Semaine », « Mois », « Année » et « Équipes », la plaque d'astreinte de l'accueil ; abonnement d'agenda (avec les remplacements) ; manœuvres annoncées toutes seules sur « Le centre ».
- **Planning d'été** : vacances des agents (Moi → Mes vacances), proposition qui arme le FPT, tableau de l'été à ajuster puis publier ; règles d'armement réglables ; fichier du planning (exporter l'année, importer avec aperçu) ; le rôle « Chef d'équipe » devient « Chef de garde ».
- **Engins et fiches** (Caserne → Engins, lot A de la prise de garde) : les engins du centre (au centre, prêté par un autre centre, parti) et leur état ; une fiche de prise de garde par type d'engin (VSAV, FPT, VTU au départ), rangée par zone, avec quantité attendue, versionnée ; l'éditeur de fiche et le fichier des fiches (export, import avec aperçu). La prise de garde au téléphone (lot B) : brouillon partagé, écarts avec photo, participants, historique, retard signalé au chef de garde. Les anomalies (lot C) : suivi par étapes, signalement direct avec photo, indisponibilité décidée et remise en service, bandeau d'avertissement, cloche, « À décider ».
- **Habillement** (Caserne → Habillement) : demandes de tenue en texte libre, suivies jusqu'à la livraison par le référent habillement (ou le chef et l'adjoint), avec fil, cloche et « À décider ».
- **Remplacements et échanges** : demander un remplaçant, échanger avec un collègue ou une place à une manœuvre, validation par le chef de garde.
- **Messagerie** (Échanges → Messages) : conversations à deux et groupes, notifications au téléphone.
- **Notifications** : la cloche et le téléphone, réglables dans Moi → Notifications.
- **Fêtes de Gyro et actualisation** : l'icône aux couleurs des équipes ; tirer pour actualiser ; anniversaire, première réservation et année publiée fêtés une fois.
- **Murs** (onglet « Échanges ») : Le centre, Vie du centre, un mur par équipe et par comité ; publications (message, annonce, événement, bravo), sondages, commentaires, « J'aime », photos, prise de connaissance, anniversaires ; « À ne pas manquer » sur l'accueil ; un événement reste affiché, « En cours », jusqu'à sa fin ; publications gardées 24 mois, sauf épinglées.
- **Météo et vigilance** : le temps au centre sous « Bonjour » (Open-Meteo), une ambiance discrète et Gyro habillé selon le temps ; bandeau de vigilance Météo-France dès l'orange et alerte au rouge, avec la clé `VIGILANCE_CLE`.

Pas encore livrées, leurs pages décrivent la cible : **Stocks**, **Disponibilités et absences** (hors vacances d'été), et une partie d'**Astreinte et rotation** et de **Composition des gardes** (encarts en tête de page). La référence reste le MVP [`cis-laille`](https://github.com/cislaille35/cis-laille).
