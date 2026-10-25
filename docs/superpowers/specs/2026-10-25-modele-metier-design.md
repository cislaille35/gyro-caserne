# Modèle métier de Gyro Caserne

Conception validée en brainstorming avec le porteur, le 25/10/2026. Elle sert de base pour réécrire les fonctions du MVP `cis-laille` sur un modèle sain.

## Pourquoi

Le MVP fonctionne, mais son modèle est bancal :
- les droits viennent de quatre sources qui se marchent dessus (rôle, fonction, droit « amicale », comptes de secours) ;
- une vingtaine de contrôles sont dispersés dans le code, et certains se contredisent ;
- une même liste est définie trois ou quatre fois (base, code, écrans) ;
- les équipes sont figées à 4, et « Laillé » est écrit en dur.

Le porteur veut des **briques unitaires**, l'équivalent d'un `enum` Java, qui se combinent pour faire une fonctionnalité.

## Objectifs

- Chaque notion est définie **une seule fois** et reprise telle quelle par la base, le code, les écrans et les tests.
- Chaque centre adapte ses listes **sans toucher au code**.
- Un droit se vérifie **à un seul endroit**, avec une seule règle.
- Le modèle accueille les fonctions à venir sans être remanié.

## Non-objectifs

- Un moteur de droits générique (type Zanzibar ou OpenFGA) : c'est trop lourd pour la taille de l'appli.
- Plusieurs centres dans une même installation : il y a une installation par centre (décisions 0002 et 0006).
- Un vote dans l'appli : les comités décident en réunion, et l'appli garde la preuve de leur décision.

## Anti-objectifs (échec, même si ça marche)

- Un droit, une liste ou une règle propre à un centre écrit en dur dans le code.
- Un contrôle de droit écrit ailleurs que dans le point de vérification unique.
- Une personne extérieure qui voit autre chose que ce qu'on lui a explicitement ouvert.
- Un message privé lisible par quelqu'un qui n'est pas membre de la conversation.

## Principe des listes

**Une liste est ouverte par défaut** : l'administrateur du centre ajoute, renomme ou retire des éléments.

**Une liste est fermée (écrite dans le code) seulement si l'appli se comporte différemment selon chaque valeur** : droits, statuts qui pilotent un déroulé, types de périmètre, types de personne.

Autour d'une liste fermée :
- les **libellés** restent modifiables par le centre ;
- des **catégories ouvertes** permettent de trier sans changer le déroulé ;
- ajouter une valeur se fait par une PR avec son test, au profit de tous les centres.

Un nouveau centre reçoit un **jeu de départ** de toutes les listes ouvertes, qu'il adapte ensuite.

## Les briques

### Fermées (code)

| Brique | Rôle | Exemples |
|---|---|---|
| **Droit** | Une action de l'appli | Voir l'inventaire des droits plus bas |
| **Type de périmètre** | Sur quoi s'exerce un droit | centre, équipe, comité, salon, ressource réservable |
| **Type de personne** | Ce que l'appli sait d'une personne | agent, extérieur |
| **Statuts** | Les étapes d'un déroulé | anomalie : signalée → prise en charge → en attente → réparée → vérifiée → close (« en attente » et « vérifiée » sont des étapes que le centre active ou non, et les libellés sont modifiables) ; remplacement : ouvert → pourvu / annulé ; réservation : demandée → validée / refusée / annulée ; engin : disponible / indisponible ; statut opérationnel de l'agent (voir plus bas) |
| **Responsabilités système** | Celles dont l'appli dépend | chef de centre (périmètre : centre), chef d'équipe (périmètre : une équipe) |

### Ouvertes (gérées par le centre)

| Brique | Contenu |
|---|---|
| **Profil** | Il est porté par chaque adresse autorisée (agent, réserve citoyenne, autre…). Il donne les **droits de base** de la personne et son type (agent ou extérieur). |
| **Responsabilité** | Fonction ou mission (chef de centre, référent pharmacie, trésorier de l'amicale…). Elle a un nom, un ensemble de droits, le type de périmètre où elle s'exerce et le **comité qui l'attribue**. |
| **Comité** | Créé par l'administrateur. Il a un nom, un thème (centre, vacances, amicale…), des membres (par attribution) et ses comptes rendus. |
| **Équipe** | En nombre libre, avec un nom, une couleur et son ordre dans la rotation. |
| **Grade** | Il identifie l'agent et propose ses aptitudes, mais ne donne **aucun droit**. |
| **Aptitude** | CA2, CA1, CE, COD1, INC… Chaque agent a ses aptitudes **datées** : obtention, expiration, rappel avant l'échéance. |
| **Engin / ressource** | Engins (avec leur fiche de prise de garde) et ressources réservables (VL, matériel de l'amicale…). |
| **Article de stock et lieu de stockage** | Pharmacie, consommables. Un lieu, c'est la pharmacie, un VSAV… |
| **Catégories** | Pour trier, par exemple les types d'anomalie. |

### L'attribution

Une **attribution** relie :
- une personne ;
- une responsabilité ;
- un périmètre (le centre, une équipe ou un comité) ;
- une date de début, et une date de fin si besoin (intérim, mission saisonnière) ;
- qui l'a saisie et quand ;
- le compte rendu de comité qui la décide.

L'historique est conservé.

## Inventaire des droits (liste fermée)

Le préfixe `VOIR_` est la lecture. « Par défaut » indique qui reçoit le droit dans le jeu de départ ; le centre peut ensuite le donner à d'autres responsabilités ou profils.

| Droit | Périmètre | Par défaut |
|---|---|---|
| `VOIR_PLANNING`, `VOIR_ANNUAIRE`, `VOIR_ENGINS`, `VOIR_ANOMALIES` | centre | profil agent |
| `SIGNALER_ANOMALIE`, `SIGNALER_BESOIN_STOCK`, `DEMANDER_REMPLACEMENT`, `DECLARER_DISPONIBILITE`, `UTILISER_MESSAGERIE` | centre | profil agent |
| `FAIRE_PRISE_DE_GARDE` | équipe d'astreinte, ou centre selon le réglage | profil agent |
| `PRENDRE_EN_CHARGE_ANOMALIE` | centre | profil agent (le centre peut le restreindre) |
| `TRAITER_ANOMALIE` (clore, rouvrir, remettre en service) | centre | chef de centre, référent engins |
| `GERER_FICHES` | centre | chef de centre, référent engins |
| `GERER_STOCK` | centre | chef de centre, référent pharmacie |
| `GERER_PLANNING` (cycle, exceptions, plafonds) | centre | chef de centre |
| `VALIDER_REMPLACEMENT` (si le centre l'exige) | équipe | chef d'équipe |
| `VOIR_MOTIFS_ABSENCE` | équipe | chef d'équipe |
| `LIRE_SALON`, `PUBLIER_SALON`, `MODERER_SALON`, `EPINGLER_SALON` | salon | selon le salon |
| `RESERVER` | ressource réservable | profil agent (VL), profil réserve citoyenne (VL seulement) |
| `GERER_RESERVATIONS` (valider, refuser) | ressource réservable | responsable VL, rapporteur de l'amicale |
| `MODERER_MESSAGERIE` (messages signalés seulement) | centre | chef de centre |
| `GERER_LISTES`, `GERER_ACCES`, `GERER_COMITES` | centre (`GERER_ACCES` aussi sur une équipe) | chef de centre |
| `ATTRIBUER_RESPONSABILITE` | comité | rapporteur ou référent du comité |

`RESERVER_VL`, cité plus haut, est le droit `RESERVER` sur la ressource VL.

## Les règles de droit

- **Vérification unique** : *la personne a-t-elle, par son profil ou par une attribution en cours, ce droit sur ce périmètre ?* Un droit sur le centre vaut sur toutes ses équipes et tous ses comités.
- **Lire est aussi un droit** (`VOIR_PLANNING`, `VOIR_ANNUAIRE`…). Le profil « agent » donne les droits de lecture courants, et un extérieur ne voit que ce que son profil ouvre.
- **Le super administrateur** est le **compte technique du centre**, celui qui possède les comptes Cloudflare, Resend et GitHub. C'est une adresse du centre (pour Laillé, `cislaille35@gmail.com`), pas celle d'une personne.
  - Il se connecte par lien magique. Ses adresses sont dans un secret Cloudflare, et chacune de ses actions est journalisée.
  - Il installe, dépanne et **nomme le chef de centre**.
  - À l'installation, il peut aussi créer les comités et leurs premiers membres, pour reprendre l'organisation réelle du centre.
  - **Passation** : quand la personne qui tient ce compte change, on change le mot de passe de la boîte du centre, on remplace les clés (jeton Cloudflare, clé Resend, secrets de l'appli) et on ferme les sessions du super administrateur. Une page de doc décrira la procédure pas à pas.
- **Administrer le centre** se fait avec les droits `GERER_LISTES`, `GERER_ACCES` (adresses autorisées, profils) et `GERER_COMITES`, donnés par défaut au chef de centre.
- **Les autres responsabilités** sont attribuées par une personne qui a `ATTRIBUER_RESPONSABILITE` dans le comité désigné par cette responsabilité. Un membre du comité de l'amicale ne peut pas nommer un chef d'équipe.
- **Au démarrage**, le chef de centre (ou le super administrateur) nomme les premiers membres de chaque comité. Le chef d'équipe est attribué par le comité du centre.
- **Responsabilités système** : chef de centre et chef d'équipe ont un socle de droits verrouillé. Le centre peut en ajouter, pas en retirer.
- **Appartenance à une équipe** : c'est une affectation datée, avec son historique, distincte des responsabilités.
- **Compte rendu** : c'est un complément d'explication facultatif, jamais une condition. Seul le rapporteur ou le référent désigné du comité (celui qui a `ATTRIBUER_RESPONSABILITE` dans ce comité) enregistre l'attribution.
- **Accès fermé** : seules les adresses ajoutées une par une peuvent se connecter, avec un lien magique par e-mail. Il n'y a ni inscription libre, ni lien public.
- **Statut opérationnel de l'agent** :

  | Statut | Accès | Compte dans la composition |
  |---|---|---|
  | opérationnel | oui | oui |
  | stagiaire | oui | non |
  | inapte temporaire | oui | non |
  | suspendu | non | non |
  | parti | non | non |

  Dans tous les cas, l'historique est gardé. Un agent **actif** a un statut qui donne accès : opérationnel, stagiaire ou inapte temporaire.

## Les fonctionnalités, vues comme des combinaisons

| Fonction | Briques utilisées |
|---|---|
| **Astreinte et rotation** | Créneaux (astreinte ou garde postée), rotation d'équipes réglée en base (jeu de départ dans `centre.ts`), exceptions, plafonds |
| **Composition d'une garde** | Règles du centre écrites avec les aptitudes (« au moins 1 CA2, 1 CE, 4 agents »), vérifiées avec les aptitudes **valides à la date de la garde** |
| **Disponibilité déclarée** | Elle est distincte de l'astreinte : un agent se dit disponible ou indisponible sur une période. Les absences en sont un cas. |
| **Remplacement** | La semaine entière ou des tranches. Valable sur l'accord des deux agents, et le chef d'équipe est informé. Le centre peut exiger une validation (`VALIDER_REMPLACEMENT` sur l'équipe), ce qui est désactivé par défaut. |
| **Échange** | Deux cas seulement : un **week-end d'astreinte** entre deux agents, ou une **manœuvre**. Chacun accepte, puis le chef d'équipe valide si nécessaire et la composition est revérifiée. |
| **Prise de garde** | Fiche versionnée **par type d'engin**, saisie zone par zone, situation et statut de l'engin. Une anomalie bloquante rend l'engin **indisponible**. Détail dans `docs/fonctionnel/prise-de-garde.md`. |
| **Anomalies** | Statuts, catégories, `TRAITER_ANOMALIE` |
| **Stocks** | Articles, lieux, lots, péremption, seuil minimum, mouvements, `GERER_STOCK` (par exemple pour le référent pharmacie) |
| **Réservations** | Une ressource indique qui la gère (une responsabilité ou un comité), si on la réserve directement ou sur demande, et quel profil peut la réserver. |
| **VL et réserve citoyenne** | Calendrier de la VL. Profil « réserve citoyenne » (type extérieur) dont le seul droit est `RESERVER_VL`. Le nom du demandeur est demandé à chaque réservation. Règle par défaut : un créneau libre est accepté, un créneau pris passe **en attente** et le responsable de la VL tranche, y compris face à une demande d'un agent. |
| **Matériel de l'amicale** | Ressources réservables sur demande, validées par le rapporteur de l'amicale. |
| **Salons** | Liste ouverte. Lire, publier, modérer et épingler sont des droits sur le périmètre d'un salon, donnés par un profil ou une responsabilité. |
| **Messagerie** | Annuaire du centre, conversations à deux et groupes créés par n'importe quel agent, qui en devient l'animateur. Une conversation n'est qu'une liste de membres, sans attribution ni comité. **Seuls ses membres la lisent.** Chacun peut couper un groupe. Les extérieurs n'y ont pas accès. |
| **Notifications** | Par type, avec des préférences par personne |

## Données

- **Où vivent les listes** : les listes ouvertes sont **en base** et se gèrent par des écrans. `centres/<id>/centre.ts` garde l'identité du centre (nom, commune, fuseau, position) et fournit le **jeu de départ** chargé à l'installation. Ensuite, c'est la base qui fait foi.
- **Pas de reprise du MVP** : ses données étaient fictives. Laillé repart de zéro. Les données fictives du MVP servent de **données de démonstration pour `exemple`**, après avoir vérifié qu'aucune donnée réelle ne s'y trouve.
- Chaque type de donnée a sa **durée de conservation**, réglable par le centre, avec une valeur par défaut. C'est le cas des messages, des aptitudes médicales, du journal, des réservations… Voir le référentiel CNIL RH de 2026.
- Un **journal** garde les actions sensibles : attributions, changements de droits, de statut opérationnel, de profil.
- **Les données réelles restent hors du dépôt** : le jeu de départ et `centres/exemple` sont fictifs.

## Ce qui est laissé au développeur

- Le schéma exact des tables et les noms techniques, en respectant le français et les règles de `CLAUDE.md`.
- Le contenu précis du jeu de départ, à partir des listes du MVP (voir l'inventaire en annexe).
- L'ordre de livraison des fonctions, en commençant par le socle (personnes, profils, droits, attributions).

## Hors de ce document

- Déploiement (préprod et production) : il fera l'objet d'une PR à part.
- Contrôles périodiques du matériel, matériel individuel (EPI, radios), accusé de lecture des notes de service : la recherche les a repérés comme des pistes, et le modèle les accueillera sans changement.

## Annexe : référentiels du MVP, pour le jeu de départ

- **Grades** : JSP, Sap, Cap, Cch, Sgt, Sch, Adj, Adc, Ltn, Cne, Cdt.
- **Aptitudes** :
  - commandement : CA2, CA1, CE ;
  - conduite : COD1, COD2 ;
  - spécialités : INC, SAP, DIV, FDF1, FDF2.
- **Engins** : VSAV, FPT, VTU, avec leurs fiches. Zones de fiche : cabine, cellule sanitaire, sacs, ARI, hydraulique, coffres, épuisement.
- **Urgence d'une anomalie** : faible, normale, haute.
- **Salons** : mur, annonces, manœuvres, amicale, un fil par équipe.
- **Types de notification** : la liste de référence est dans `docs/fonctionnel/notifications.md`.
