# Habillement : demandes de tenue

Cadré avec le porteur le 08/11/2026. Remplace le canal Slack « habillement ».

## Pourquoi

Aujourd'hui, un agent poste sa demande sur le mur Slack « habillement ». Le référent habillement y donne suite ou non : il commande au SDIS (ou sort la pièce du peu de stock du centre), puis clôt par un message « colis livré, à récupérer » ou « posé dans ton casier ». Rien ne suit l'état d'une demande, et les messages se perdent dans le fil.

L'appli doit donner à chaque demande **son propre suivi**, visible de l'agent, sans passer par un mur ni par la messagerie.

## Objectifs

- Un agent demande une pièce de tenue en quelques secondes, en texte libre.
- Il sait à tout moment où en est sa demande et reçoit une notification à chaque étape.
- Le référent habillement voit ce qu'il a à traiter dans sa casquette, au même endroit que le reste.
- Le chef et l'adjoint savent ce qui se passe, sans être dérangés.

## Hors sujet

- **Pas d'inventaire** : le stock du centre n'est pas tenu dans l'appli. « En stock » est seulement une issue choisie par le référent.
- **Pas de tailles mémorisées** sur la fiche de l'agent (choix du porteur : le texte libre suffit). À reconsidérer seulement si les référents se lassent de redemander.
- **Pas de validation** du chef ou d'un chef d'équipe avant traitement.
- Pas de catalogue des pièces, pas de lien avec un outil du SDIS, pas de photo.

## Ce qui ferait échouer le lot, même s'il marche

- Un formulaire lourd (listes de pièces, de tailles, champs obligatoires) : l'agent doit décrire son besoin comme sur Slack.
- Un chef notifié à chaque veste.
- Un écran qui retombe dans les travers corrigés par la refonte (voir la section « Interface » de `CLAUDE.md` et `docs/technique/interface.md`).

## La demande

- **Un seul champ de texte libre**, avec une aide : « Quelle pièce, quelle taille, pourquoi ? (ex. : veste textile en L, la mienne est déchirée) ».
- Un agent peut avoir plusieurs demandes en cours.

## Les étapes

1. **Demandée** : l'agent l'envoie.
2. **Prise en compte** par un référent : l'agent voit qui s'en occupe. Une demande prise en compte par un référent n'apparaît plus « à traiter » chez les autres référents.
   - **Question posée** : pendant la prise en compte, le référent peut poser une question à l'agent (« Quelle taille ? »). La demande passe à « Question posée » ; quand l'agent répond, elle repasse « Prise en compte ». Autant de fois que nécessaire.
3. **Traitée**, une issue parmi trois :
   - **En stock** : sortie du stock du centre ;
   - **Commandée au SDIS** ;
   - **Refusée**, avec un mot d'explication obligatoire (fin de la demande).
4. **Livrée**, avec l'info de récupération : « À récupérer », « Dans ton casier », ou un mot libre. Fin de la demande.

**Le fil** : sous la demande, les questions du référent, les réponses et les précisions de l'agent, et les changements d'étape, dans l'ordre. L'agent peut ajouter une précision de lui-même tant que la demande n'est ni refusée ni livrée (supposition de Claude).

L'agent peut annuler sa demande tant qu'elle n'est pas commandée ni sortie du stock (choix de Claude).

## Qui voit quoi, qui agit

- **Voient la demande** : l'agent qui l'a faite, les référents habillement, le chef de centre et l'adjoint (le chef et l'adjoint voient déjà tout le reste).
- **Agissent** (prendre en compte, poser une question, traiter, livrer) : les référents habillement ; le chef et l'adjoint aussi, pour qu'une demande ne reste pas bloquée.
- **Aucun référent habillement nommé** : les demandes arrivent dans le « À décider » de la casquette « Le centre » du chef, comme les anomalies quand personne ne tient le rôle.
- **Qui peut demander** : tout agent du centre connecté (une personne, pas le super administrateur), sans droit particulier (choix de Claude).
- **Reprendre une demande** : un autre référent (ou le chef, l'adjoint) peut reprendre d'un geste « Je la reprends » une demande prise en compte par un collègue absent ; le changement apparaît dans le fil (choix de Claude).

## Notifications

- **À l'agent** : à chaque changement d'étape et à chaque question, par la cloche et le téléphone. Ouvrir sa demande marque ces notifications lues.
- **Aux référents habillement** : à chaque nouvelle demande. Une réponse ou une précision de l'agent va au référent qui a pris la demande en compte ; tant que personne ne l'a prise, à tous les référents (choix de Claude).
- **Au chef et à l'adjoint** : rien, sauf quand aucun référent n'est nommé : ils reçoivent alors les nouvelles demandes, et les réponses de l'agent seulement sur les demandes qu'ils ont prises en compte eux-mêmes.
- Même mécanisme que les autres avis (file d'envoi, `/notifications/ouvrir`, pastille).

## Points d'entrée

- **Caserne → Habillement** : « Faire une demande » et « Mes demandes ».
- **Casquette du référent habillement** (et « Le centre » s'il n'y en a pas) : les demandes à traiter dans « À décider », et un lien vers toutes les demandes (en cours, puis terminées).
- **Page « Comités et référents »** (lot en cours) : le référent habillement y apparaît avec ses titulaires.

## Le rôle de référent habillement

Il n'existe pas encore : ni modèle de rôle, ni droit. Il faut un modèle « Référent habillement » (thème et icône cohérents avec les autres rôles) et un moyen de savoir qui le tient.

**Décision du porteur (08/11/2026) : un vrai droit `GERER_HABILLEMENT`**, comme `GERER_STOCK` pour la pharmacie : il apparaît dans Réglages, dans les paquets de droits (`apps/web/src/lib/paquets.ts`, domaine « Habillement ») et dans « Ce que ce rôle permet » ; il peut être donné à n'importe quel rôle. Le modèle « Référent habillement » le porte.

La liste des droits (`DROITS`, `packages/socle/src/listes.ts`) est figée par une contrainte `CHECK` dans `profil_droit` et `responsabilite_droit` : la migration **reconstruit ces deux tables** en recopiant toutes leurs lignes (accord du porteur donné pour cette reconstruction). Exigences : aucune ligne perdue ni modifiée, index et clés recréés à l'identique, test de migration dédié (comme `migration-0002.test.ts` et suivants) qui charge des droits existants, applique la migration et compare avant/après ; tâche et review « base » à part dans le plan.

## Conservation

Les demandes refusées, livrées ou annulées sont effacées **24 mois** après leur fin par la tâche de nuit, avec leur fil (même règle que les publications, décision 0023 ; choix de Claude).

## Contraintes

- Offre gratuite Cloudflare : lectures groupées, chaque page dans `budget.test.ts`, aucune requête de plus sur les pages qui ne concernent pas l'habillement.
- Téléphone d'abord, mêmes fonctions à l'ordinateur ; AA, clavier ; règles « Interface » de `CLAUDE.md`.
- Migration : nouvelles tables (demande, fil, avis) et reconstruction des deux tables de droits (voir « Le rôle de référent habillement »).
- À construire **après** la fusion de la page « Comités et référents » (les deux touchent Caserne).
- Données fictives dans le jeu de démonstration et les comptes de test (quelques demandes à différentes étapes).

## Laissé au constructeur

La structure des tables, les noms, la forme exacte des écrans dans les règles ci-dessus, le découpage en tâches.

## Choix de Claude, à vérifier par le porteur

- L'agent peut ajouter une précision tant que la demande n'est ni refusée ni livrée.
- L'agent peut annuler tant que la demande n'est ni commandée ni sortie du stock.
- Tout agent connecté peut demander, sans droit.
- Reprise d'une demande par un autre référent.
- Destinataires des réponses de l'agent.
- Conservation 24 mois.
