# Échanges, lot 1 : les murs

Date : 2026-10-28. Validé en conversation avec le porteur (« Go »), avant relecture du document.
S'appuie sur [`2026-10-27-ecrans-par-profil-design.md`](2026-10-27-ecrans-par-profil-design.md) (onglet Échanges, casquettes, « À ne pas manquer ») et sur la doc fonctionnelle [`salons.md`](../../fonctionnel/salons.md), qu'il précise et simplifie.

## Pourquoi

Le centre échange aujourd'hui sur Slack, dans une vingtaine de canaux. Chacun doit faire le tour des canaux pour trouver ce qui le concerne. Le porteur veut **moins de salons** et que **l'information importante vienne à chacun sur son accueil**, sans consulter plusieurs salons.

## Ce que deviennent les canaux actuels (analyse validée par le porteur)

| Canal Slack | Dans Gyro Caserne |
|---|---|
| général, formation (réussites), manœuvre | mur **« Le centre »** |
| aléatoire, sport et compétition | mur **« Vie du centre »** |
| équipe 1 (privé) | **mur de l'équipe** |
| amicale, voyage, calendriers (information) | **mur du comité Amicale** |
| préformation | mur du comité qui s'en charge (supposition : un comité « Formation ») |
| départ-X (surprise, privé) | conversation de groupe de la **messagerie** (lot suivant) |
| remplacement | **supprimé** : la fonction remplacements, portée par l'agent (porteur) |
| réservation (VL), matériel amicale | fonction **réservations** (lot à venir) |
| pharmacie, véhicule + matériel | **besoins de stock** et **anomalies**, envoyés au référent (lots à venir) |
| habillement | demande de renouvellement au référent habillement (nouveau, lot à venir) |
| CRSS | demande de compte rendu d'intervention (nouveau, lot à venir) |
| calendriers et cartographie + PEI (organisation) | **tournées** par zones et petites équipes (nouveau, lot à venir) |

Ce lot livre les **murs** et **« À ne pas manquer »**. Les autres lignes ont leur propre lot.

## Les murs : quatre sortes seulement

| Mur | Qui lit | Qui publie | Qui modère et épingle |
|---|---|---|---|
| **Le centre** | tous les agents | chef de centre, adjoint | chef de centre, adjoint |
| **Vie du centre** | tous les agents | tous les agents | chef de centre, adjoint |
| **Équipe N** (un par équipe active, créé tout seul) | les membres de l'équipe | les membres et le chef d'équipe | le chef d'équipe |
| **Comité** (un par comité, sur la page du comité) | les membres du comité | les membres | le rapporteur |

- Le chef de centre, l'adjoint et le super administrateur lisent et modèrent tous les murs (choix de Claude ; les murs ne sont pas privés comme la messagerie).
- Les droits restent ceux du socle (`LIRE_SALON`, `PUBLIER_SALON`, `MODERER_SALON`, `EPINGLER_SALON`, périmètre « salon »). Choix de Claude : les droits du tableau se **déduisent de l'appartenance au moment de la lecture** (être dans l'équipe, membre ou rapporteur du comité, chef ou adjoint, agent), dans `droitsDe`, sans ligne à synchroniser. Les droits donnés en plus par un profil ou une responsabilité sur un salon s'y ajoutent. L'écran pour « ouvrir un mur à d'autres » (un référent qui publie dans « Le centre », les extérieurs) n'est **pas dans ce lot**.
- Les **extérieurs** (réserve citoyenne) n'ont accès à aucun mur par défaut.
- Un mur d'équipe désactivée passe en **lecture seule**. Un mur de comité dissous est gardé comme **archive en lecture seule** pour le chef de centre, l'adjoint et le super administrateur seulement : les anciens membres n'y ont plus accès (la dissolution clôt leurs attributions).
- Pas de sous-salon : **chaque publication a son fil de commentaires** (« Voyage à Prague » et ses réponses).

## Une publication

- **Texte**, et **photos** en option (voir « Les photos »).
- **Type** :
  - **Message** (par défaut) ;
  - **Annonce** : peut demander une **prise de connaissance** (bouton « Pris connaissance » ; l'auteur et les modérateurs voient qui l'a fait, et qui pas encore) ;
  - **Événement** : date et heure, lieu, **convoqués** (tout le mur ou des équipes), réponse **présent / absent / incertain** ; l'auteur voit qui a répondu et qui pas encore ; un **sondage** optionnel (ex. « petit déjeuner : oui / non ») ;
  - **Bravo** : une réussite (examen, compétition).
  - Dans « Vie du centre » et les murs d'équipe et de comité, tous les types sauf « Annonce » avec prise de connaissance, réservée aux modérateurs (choix de Claude).
- **Sondage** seul possible aussi sur un message (une question, 2 à 6 réponses, une seule réponse par personne, résultats visibles de tous).
- **« J'aime »** et **commentaires** ; l'auteur ou un modérateur peut fermer les commentaires.
- **Épingler** (modérateurs) : en haut du mur et dans « À ne pas manquer ».
- **Modifier, supprimer** : l'auteur ; **supprimer** : les modérateurs. La suppression est inscrite au journal (sans le contenu).
- **Anniversaires** : « Vie du centre » affiche chaque jour les anniversaires des agents dont la date de naissance est inscrite et qui n'ont pas coupé l'affichage dans « Mon profil » (activé par défaut, décision du porteur), sans l'âge.

## « À ne pas manquer » sur l'accueil

Sur la casquette « Mon astreinte » (agent) et en tête des autres casquettes d'une personne, choix de Claude :

1. les **annonces à prendre en compte**, tant que la personne ne l'a pas fait ;
2. les **événements à venir** où elle est convoquée, avec les boutons de réponse sur place ; la veille, l'événement est marqué « demain » (calculé à l'affichage, aucun envoi ; choix de Claude) ;
3. les **sondages ouverts** auxquels elle n'a pas répondu ;
4. les **publications épinglées** récentes de ses murs ;
5. une ligne par autre mur lisible avec des nouveautés depuis sa dernière visite : « 3 nouveautés dans l'Amicale ».

La cloche (« Notifications ») reprend 1 à 3 en liste. Les **notifications sur le téléphone** sont un lot à part.

## L'onglet Échanges

- La liste des murs de la personne (Le centre, Vie du centre, son équipe, ses comités), avec le nombre de nouveautés.
- Un mur : ses épinglés en haut, puis les publications de la plus récente à la plus ancienne ; « Publier » en bas, à portée de pouce.
- La page d'un comité (maquette 10 des écrans par profil) montre son mur dans l'onglet « Mur ».
- Téléphone d'abord, ordinateur à égalité (liste des murs à gauche, mur à droite).

## Les photos

- Jusqu'à 4 photos par publication, **réduites dans le navigateur** avant l'envoi (environ 100 à 300 Ko chacune, JPEG ou WebP ; refus au-delà d'une taille maximale côté serveur).
- **Rangées dans la base D1**, comme dans le MVP (décision du porteur : pas de R2, donc ni moyen de paiement ni réglage Cloudflare). Calcul : 5 Go gratuits, environ 300 Ko par photo et une cinquantaine de photos par mois, soit environ 180 Mo par an.
- **Privées** : servies par l'appli après vérification que la personne peut lire le mur ; jamais d'adresse publique.
- Supprimer une publication supprime ses photos.

## La conservation

- Les murs gardent tout. Une durée de conservation réglable viendra plus tard (choix de Claude : pas dans ce lot).
- L'historique Slack n'est pas repris : on repart à vide (choix de Claude).

## Hors périmètre

- Messagerie (lot suivant), notifications sur le téléphone, réservations, besoins et anomalies, habillement, comptes rendus, tournées.
- Mentions (@nom), recherche dans les murs, fichiers autres que des photos.

## Ce qui reste au constructeur

- Le modèle de données (salon, publication, commentaire, réaction, réponse, prise de connaissance, pièces jointes) et la création automatique des murs d'équipe et de comité.
- La pagination des murs et le budget de requêtes (≤ 45 par page, cache des droits par requête déjà en place).
- La réduction des photos dans le navigateur, la taille maximale acceptée et le stockage en base (taille de ligne D1 : 2 Mo au plus).
- Les composants (carte de publication, sondage, réponse à un événement, galerie) et leur accessibilité.
- La doc : `docs/fonctionnel/salons.md` (renommé ou aligné « murs »), `docs/technique/`, aides dans `docs/utilisation/`.
