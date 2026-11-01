# Remplacements, échanges et aptitudes — design

Date : 2026-11-01. Validé dans la conversation par le porteur (« c'est bon, ajoute les aptitudes dans ce lot »), sur proposition de Claude après étude du MVP et des outils existants. Les points marqués « choix de Claude » sont venus après.

S'appuie sur le planning de l'année (`packages/socle/src/planning/`), les notifications et la messagerie.

## Pourquoi

Quand un agent ne peut pas tenir son astreinte, il cherche aujourd'hui un remplaçant par messages, et personne n'a de vue d'ensemble. Le MVP avait des remplacements, mais le remplaçant désigné était engagé sans avoir accepté, tout le centre était notifié à chaque demande, les aptitudes n'étaient pas vérifiées, et les échanges n'existaient pas.

Leçons des outils du marché (SDIS américains, Deputy, Planday, Teams Shifts, Skello) : distinguer céder et échanger ; le collègue accepte, puis un responsable ne valide que si une règle n'est pas respectée ; ne montrer une demande qu'aux agents qui peuvent la prendre ; pas de « dette » d'échange à rendre plus tard (elle s'accumule et n'est jamais soldée).

## Aptitudes (porteur : dans ce lot)

- Liste du centre, ouverte (réglages, comme les autres listes) : par défaut celles du modèle métier — commandement **CA2, CA1, CE** ; conduite **COD1, COD2** ; spécialités **INC, SAP, DIV, FDF1, FDF2** (le fichier de Laillé écrit « CA », « CA 1 » : libellés à régler par le centre).
- Chaque aptitude dit si elle est **contrôlée en remplacement** (par défaut : commandement et conduite).
- Chaque agent a ses aptitudes sur sa fiche, avec une **date d'obtention** et une **date d'expiration facultative** (choix de Claude : le modèle métier les veut datées ; une aptitude expirée ne compte plus). Pas de rappel d'échéance dans ce lot.
- Qui les saisit : ceux qui gèrent les fiches des agents (droit existant `GERER_ACCES`, celui de la fiche agent ; choix de Claude — `GERER_FICHES` concerne les fiches de prise de garde des engins). L'agent voit les siennes.
- Le **fichier de l'effectif** (export / import XLSX) gagne **une colonne par aptitude** (« Oui » ou vide), comme les responsabilités (choix de Claude : saisie en masse de 30 à 40 agents).

## Une demande de remplacement (porteur, proposition de Claude)

- Depuis Planning (sa semaine) ou Moi : « Me faire remplacer ».
- Elle porte sur **une ou plusieurs périodes de son astreinte**, prises dans le planning : une **soirée ou nuit** (18 h – 6 h en semaine), une **garde de 24 h** (week-end, férié), ou **le week-end entier** ; le choix se fait en touchant les périodes, sans saisir d'heures. Les périodes viennent des réglages d'astreinte du centre (`periodesDeLaSemaine`).
- Un mot facultatif.
- Une demande sur plusieurs périodes se prend **en bloc** (choix de Claude) ; pour qu'une partie puisse être prise par quelqu'un d'autre, l'agent fait plusieurs demandes.
- **Ciblée** : adressée à un seul collègue, **lui seul la reçoit** et doit **accepter**. S'il refuse, le demandeur peut l'**ouvrir à tous** d'un geste.
- **Ouverte** : envoyée aux agents **disponibles** sur la période (ni d'astreinte, ni déjà remplaçants à ce moment, ni ayant eux-mêmes demandé à être remplacés). **Le premier qui accepte** l'emporte (sans double attribution possible).
- **Aptitudes** : si le remplaçant n'a pas une aptitude **contrôlée** que le demandeur a (valide à la date), l'appli **avertit** au moment d'accepter, et le remplacement passe **à valider par le chef d'équipe** du demandeur (droit existant `VALIDER_REMPLACEMENT`). Sinon, pas de validation : le chef d'équipe est seulement **informé**.
- Une demande ouverte montre en tête les agents qui ont les aptitudes contrôlées du demandeur (choix de Claude : la demande va à tous les disponibles, mais ceux-là sont prévenus en premier ; pas de seconde vague dans ce lot — tous les disponibles sont prévenus en même temps).

## Un échange (porteur)

- Deux agents **échangent deux périodes en même temps** (« je prends ton week-end, tu prends le mien »). Pas de dette à rendre plus tard.
- Proposé à un collègue précis, qui accepte ou refuse. Mêmes règles d'aptitudes (dans les deux sens) et de validation que le remplacement.
- **Échange de manœuvre** (choix de Claude pour la mécanique) : la convocation, aujourd'hui par équipe, gagne des **exceptions par agent** (agent ajouté, agent retiré). Pas d'échange quand la manœuvre convoque toutes les équipes. Un agent convoqué à une manœuvre échange sa place avec un agent convoqué à une autre manœuvre (souvent d'une autre équipe). Une fois accepté, chacun est convoqué à la place de l'autre (la publication de la manœuvre et l'agenda suivent ; leurs réponses de présence sont reprises). Pas de validation, le chef d'équipe est informé (choix de Claude).

## États et délais

- États : **en attente** (d'un collègue) → **acceptée** → éventuellement **à valider** → **conclue** ; ou **refusée**, **annulée** (par le demandeur ou un chef), **expirée**.
- Une demande **expire au début** de la période concernée. On ne peut pas demander une période déjà commencée.
- **Validation du chef** (choix de Claude) : s'il **refuse**, la demande est rouverte comme au départ et le remplaçant est prévenu ; s'il n'a **pas tranché au début** de la période, la demande expire et le titulaire reste responsable. Si le demandeur est lui-même chef de son équipe, ou si l'équipe n'a pas de chef, c'est le **chef de centre ou son adjoint** qui valide.
- **Relance la veille** si personne n'a accepté : au demandeur, et au chef d'équipe (« X n'a pas encore de remplaçant demain »).
- **Désistement** du remplaçant (avant le début) : le titulaire **redevient responsable**, il est prévenu, et la demande est rouverte comme au départ.
- Une fois conclu : le planning de l'année montre le remplacement sur la période : « X remplace Y » dans « Toutes les équipes » (choix de Claude), la période en plus ou en moins dans « Mon année » et l'agenda des deux agents, et un rappel invite les deux agents à **mettre à jour leur disponibilité dans l'appli du SDIS**, qui fait foi pour l'alerte.

## Notifications (lot Notifications)

- Ciblée : au collègue visé. Ouverte : aux disponibles. Acceptée, refusée, à valider, validée, désistement, expirée : aux personnes concernées.
- Une demande à valider reste comptée dans la cloche du chef d'équipe tant qu'il n'a pas tranché (comme les demandes de réservation).
- Coupure : l'interrupteur général (pas de coupure propre aux remplacements dans ce lot).

## Écrans

- **Planning** : sur ses périodes, « Me faire remplacer » ; les périodes remplacées sont marquées (texte, pas seulement couleur).
- **Remplacements** (entrée dans Planning) : « Mes demandes », « Pour moi » (demandes reçues, ciblées ou ouvertes, avec Accepter / Refuser), « À valider » (chefs d'équipe), historique.
- **Accueil** : une demande reçue apparaît dans « À ne pas manquer » ; une demande à valider dans « À décider » du chef d'équipe.
- **Fiche agent** : section Aptitudes ; **Réglages** : liste des aptitudes (contrôlée ou non).
- Style des écrans harmonisés, téléphone d'abord, soigné à 1280, clair et sombre, AA.

## Hors périmètre

Composition minimale d'une garde (« au moins 1 CA2, 1 CE, 4 agents ») et alerte de garde incomplète ; disponibilités et absences déclarées ; compteurs d'équité ; rappel d'échéance des aptitudes ; planning d'été (lot suivant, qui utilisera les aptitudes).

## Contraintes

- Migrations additives. Budget de requêtes tenu. Heure de Paris. Données de test fictives.
- Accepter une demande ouverte : une seule acceptation possible, même si deux agents touchent en même temps.

## Laissé au constructeur

Forme des tables, découpage des périodes, textes, présentation exacte des listes.
