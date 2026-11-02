# Engins, fiches, prise de garde et anomalies — design

Date : 2026-11-02. Cadré avec le porteur et validé dans la conversation. Trois lots enchaînés (A engins et fiches, B prise de garde, C anomalies). Les règles écrites dans `docs/fonctionnel/prise-de-garde.md`, `anomalies.md` (et le modèle métier) servent de base ; ce document les précise et l'emporte en cas d'écart.

## Pourquoi

À la relève, l'équipe d'astreinte fait l'inventaire de tous les engins. Aujourd'hui sur papier ou au MVP (fiche par engin, trois états par ligne, anomalie créée par ligne). Le MVP n'avait ni engin indisponible, ni photo pendant la prise, ni brouillon partagé, ni décision de remise en service.

## Ce que le porteur a dit

- **Qui et quand** : l'**équipe d'astreinte**, **à la relève du vendredi soir**, fait l'inventaire de **tous les engins**.
- **À plusieurs** : plusieurs agents peuvent faire un même engin ; **un seul remplit la fiche et coche les collègues qui l'ont aidé** ; la prise est au nom de tous les participants.
- **Fiches** : un contenu de vérification **par défaut** (VSAV, FPT, VTU — reprendre les fiches du MVP `cis-laille`, migration `0004_garde_anomalies.sql` et données de départ), **configurable par les chefs et le référent engins** (ajouter, retirer, renommer, déplacer des éléments et des zones). L'historique garde le contenu de l'époque (versions, ou libellés recopiés dans la prise).
- **Engins** : un engin peut être **prêté au centre** (en attendant la réparation du nôtre) : il a sa fiche et sa prise le temps du prêt ; un engin peut **quitter définitivement** le centre (sur demande du SDIS) : il sort de la liste, son historique reste.
- **Indisponibilité** : l'agent **signale** ; c'est **le référent engins, le chef de garde, ou le chef de centre et son adjoint** qui décident de rendre l'engin indisponible, **sinon il reste disponible**. Les mêmes le remettent en service.

## Proposition validée

1. **Prise de garde au téléphone** : choisir l'engin ; fiche zone par zone (cabine, cellule sanitaire, sacs, ARI…) avec « Tout est complet » par zone ; on ne détaille que les écarts (manquant, abîmé, à remplacer) avec une note et une **photo facultative** prise sur le moment (base PHOTOS, poids limité comme ailleurs) ; **brouillon sur le serveur** (reprendre sur un autre téléphone, passer la main à un collègue ; une prise en cours par engin et par relève) ; cocher les participants.
2. **Quantités** : la plupart des éléments sont présents ou manquants ; ceux qui se comptent gardent une quantité attendue et on note seulement ce qui manque.
3. **Anomalie** : un écart devient une anomalie suivie : Signalée → Prise en charge → En attente (pièce, garage) → Réparée (étapes du centre, réglables comme le prévoit `anomalies.md`) ; le référent engins, le chef de garde et le chef de centre sont prévenus ; dans l'anomalie, « Rendre l'engin indisponible » et, une fois réparée, « Remettre en service » réservés à ces personnes (décision à part de la réparation). Signalement direct hors prise aussi (deux gestes, photo).
4. **La relève suivante voit les anomalies ouvertes** sur chaque engin avant de commencer ; si un élément est retrouvé, l'appli propose de clore l'anomalie (pas de clôture silencieuse).
5. **Caserne → Engins** : chaque engin avec son état écrit (Disponible, Indisponible, Avertissement), « Prise faite par l'équipe 2, ven. 18 h 40 » ou « Prise à faire », et sa situation (au centre, prêté au centre, parti).
6. **Prise en retard** : signalée au chef de garde (Accueil, « À décider »), **jamais** d'indisponibilité automatique.
7. Les engins s'appuient sur le **réglage d'armement** du lot été (VSAV, VTU, FPT) : un engin a un type.

## Découpage (enchaîné sans revenir vers le porteur sauf vraie question)

- **Lot A — engins et fiches** : tables type d'engin / engin (état, situation, prêté, parti) / fiche (versions, zones, éléments, quantité attendue) ; Caserne → Engins ; éditeur de fiche (chefs et référent engins, droit `GERER_FICHES` à vérifier) ; import / export XLSX des fiches sur le modèle du fichier de l'effectif ; fiches de départ VSAV / FPT / VTU reprises du MVP ; données fictives.
- **Lot B — prise de garde** : le parcours au téléphone, brouillon serveur, participants, photo, historique des prises, relève qui voit les anomalies ouvertes, prise en retard dans « À décider », Gyro en tenue `garde` pendant la prise ; droit `FAIRE_PRISE_DE_GARDE`.
- **Lot C — anomalies** : suivi, étapes, notifications (lot Notifications), indisponible / remise en service, proposition de clore, signalement direct, bandeau d'avertissement sur l'engin ; droits `SIGNALER_ANOMALIE`, `TRAITER_ANOMALIE`.

## Contraintes

Migrations additives. Budget de requêtes. Heure de Paris. Données de test fictives. Téléphone d'abord (la prise se fait au garage, le téléphone à la main), ordinateur soigné ; **téléphone et ordinateur identiques en fonctions** (exigence du porteur, test de parité). AA. Méthode allégée de `CLAUDE.md`.

## Hors périmètre

Stocks et pharmacie (péremptions), contrôles périodiques (hebdo, mensuel), EPI, lien avec le SDIS ou le CTA, hors-ligne complet.
