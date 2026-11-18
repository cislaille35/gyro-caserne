# Notifications des chefs, suivi du centre, e-mail aux référents — design

Cadré avec le porteur le 18/11/2026, après la présentation à Laillé.

## Pourquoi

À la présentation, le chef et son adjoint ne savaient pas ce que l'autre avait changé, rien ne les avertissait de ce qui compte, et une manœuvre modifiée s'affichait signée « PD » (les initiales de « Planning du centre »). Le porteur veut :

- que les chefs soient **dérangés seulement pour l'urgent**, même quand la demande s'adresse à un référent ;
- que **tout le reste soit tracé** pour eux, sans notification ;
- savoir **qui a modifié** ce que l'appli publie ;
- que l'agent nommé, et le chef qui n'a pas nommé, l'apprennent ;
- qu'un **référent reçoive un e-mail** quand une demande lui est adressée.

## Objectifs

1. **Urgences** : une notification sur le téléphone du chef de centre et de l'adjoint, à toute heure.
2. **Suivi du centre** : une page pour le chef et l'adjoint, remplie par le journal, et une seule ligne dans leur cloche.
3. **« Modifié par… »** : l'appli signe avec son icône, plus jamais des initiales ; ce qu'une personne a changé porte son nom.
4. **Nomination** : l'agent nommé est prévenu ; le chef ou l'adjoint qui n'a pas nommé le voit dans le suivi.
5. **E-mail au référent** pour chaque nouvelle demande qui lui est adressée.

## Non-objectifs

- Pas d'e-mail pour la suite d'une demande (questions, prise en compte) : elle reste dans l'appli.
- Pas de récapitulatif quotidien.
- Pas de réglage de ce qui est urgent : la liste est fixée par l'appli.
- L'urgence « garde sous l'armement minimum » n'est pas dans ce lot : l'appli ne calcule pas aujourd'hui l'équipage d'une garde en cours (seulement le planning d'été). Lot à part, à cadrer.
- Pas de demandes génériques adressées à un rôle (idée gardée pour plus tard).
- Rien sur la délivrabilité vers `@sdis35.fr` : en attendant, les agents concernés donnent une adresse personnelle.

## Anti-objectifs

- Une cloche noyée : le suivi n'y tient qu'une ligne.
- Une urgence qui n'en est pas une : un chef qui reçoit des alertes pour rien les coupera toutes.
- Plus de calcul par requête : l'offre gratuite de Cloudflare coupe au-delà (81 coupures le 18/11 ; demande expresse du porteur). Les urgences et les e-mails partent dans le batch de l'action ou au réveil existant, jamais par une lecture de plus sur chaque page. Le compteur du suivi tient dans la requête de l'en-tête déjà faite (pas de requête de plus). La page « Suivi du centre » lit une page de journal à la fois. Les tests qui comptent les requêtes (budget de `/caserne`, du réveil, de l'en-tête) restent verts, et le réveil est mesuré au banc avant et après.

## Ce qui est décidé

### 1. Urgences (téléphone du chef et de l'adjoint)

| Urgence | Quand | Lien |
|---|---|---|
| Engin indisponible | un engin passe à « indisponible » (anomalie bloquante, prise de garde ou fiche de l'engin) | la page de l'engin |
| Remplacement sans remplaçant | la relance de la veille à 8 h d'une demande sans remplaçant (`remplacementsDuMoment`) : le chef et l'adjoint la reçoivent aussi | la demande |
| Équipe sans chef de garde | la veille à 8 h d'une garde dont l'équipe d'astreinte n'a pas de chef de garde en cours | Nominations |

- Destinataires : chef de centre et adjoint en fonction, sauf l'auteur du geste.
- Lieu de coupure nouveau, « urgences » : on peut le couper dans « Mes notifications », mais il est présenté en premier et expliqué.
- « Tout couper » coupe aussi les urgences (décision du porteur, 19/11) ; l'écran prévient alors : « Vous ne recevrez plus les urgences du centre (engin indisponible…) ».
- « La veille » d'une garde : la veille de la relève de l'équipe d'astreinte, d'après le calcul d'astreinte existant (été compris) ; une alerte par relève (choix de Claude).
- Chaque urgence a aussi sa ligne dans la cloche (liste existante du sujet ou ligne de suivi), pour qui n'a pas de téléphone abonné.

### 2. Suivi du centre (choix A du porteur)

- Une page « Suivi du centre », pour le chef de centre, l'adjoint et le super administrateur : ce qui s'est passé au centre, du plus récent au plus ancien, une ligne par action du journal (« Claire Martin a modifié la manœuvre Feux de forêt », « Rémi Leroy a pris en compte une demande d'habillement »), avec le lien vers l'élément.
- Dans la cloche : une ligne « Suivi du centre : N nouveautés depuis votre dernière visite », sans envoi au téléphone. Ses propres actions ne comptent pas dans N.
- Les actions retenues forment une liste fixe (choix de Claude) : planning et manœuvres, nominations et retraits, réglages (rôles, comités, profils, engins, ressources, armement, écusson), fiches des agents (ajout, modification, statut, équipe, effacement), décisions sur les demandes (habillement, anomalies, réservations à valider) et remplacements validés. Rien de privé : ni les conversations, ni « mon profil », ni chaque publication, commentaire ou réservation d'un agent.
- Le journal est complété là où des actions manquent : manœuvres (modifier, annuler), planning de l'année, habillement, anomalies, remplacements (décisions du chef de garde), nominations. Tout ce qui est journalisé entre dans le suivi.
- Le journal garde sa règle actuelle sur les agents effacés.

### 3. « Modifié par… »

- Une publication de l'appli (auteur « planning ») montre l'icône du calendrier et le nom « Planning », jamais d'initiales. Pareil dans la cloche et dans les notifications.
- Quand une personne change ce que l'appli a publié (manœuvre modifiée ou annulée), la publication indique « Modifiée par <prénom nom>, le <date> à <heure> » et la notification « Manœuvre modifiée par <prénom nom> : <thème> ».
- Le nom vient de ce que l'action enregistre (journal ou colonne), lu dans la même requête que la publication.

### 4. Nomination

- L'agent nommé reçoit une notification et une ligne de cloche : « Vous êtes nommé <rôle> » (avec le périmètre).
- Le chef ou l'adjoint qui n'a pas nommé le voit dans le suivi (pas d'envoi au téléphone).
- Seulement les attributions faites à la main (fiche d'un agent, Nominations) ; l'import du fichier de l'effectif ne prévient personne (pas de rafale). Un retrait de rôle va au suivi seulement. Une affectation d'équipe n'est pas une nomination (choix de Claude).

### Chefs et demandes adressées aux référents (décision du porteur, 19/11)

- Dès qu'un référent est nommé pour une demande (anomalie, habillement, ressource gérée), le chef et l'adjoint ne reçoivent plus d'envoi au téléphone ni d'e-mail pour elle : elle passe dans leur suivi.
- Sans référent nommé, ils restent prévenus comme aujourd'hui (téléphone et e-mail) : ce sont eux qui traitent.
- Les urgences leur arrivent toujours.

### 5. E-mail au référent (choix A du porteur)

- Une nouvelle demande adressée à un référent part aussi par e-mail à chacun de ceux qui la reçoivent aujourd'hui en notification : nouvelle demande d'habillement, réservation à valider, anomalie signalée.
- Destinataires : celui qui tient le droit ou gère la ressource, comme aujourd'hui ; un rôle créé par le chef avec ce droit reçoit donc les e-mails sans code.
- Contenu : titre et deux lignes de la notification, et le lien vers la demande. Texte simple, comme l'e-mail de connexion.
- Coupure : « Recevoir les demandes par e-mail », dans « Mes notifications », activé par défaut.
- Envoi après la réponse (comme le lien de connexion) ; un échec n'empêche jamais la demande.

## Approches considérées

- **Suivi** : A, une page lue dans le journal et une ligne dans la cloche (choisi), contre B, une ligne de cloche par événement (cloche noyée, chaque événement à écrire à part).
- **E-mail** : A, un e-mail par nouvelle demande (choisi), contre B, un récapitulatif par jour (trop lent pour une réservation du lendemain).
- **Auteur d'une manœuvre modifiée** : signer du nom de qui modifie a été écarté (l'annonce n'est pas de lui, l'auteur changerait à chaque modification) ; on garde « Planning » et on ajoute « Modifiée par ».

## Contraintes

- Charte (`.claude/skills/charte-gyro/SKILL.md`), RGAA, téléphone d'abord.
- Pas de dépendance nouvelle ; e-mails par Brevo (offre gratuite : 300 par jour).
- Rien de propre à Laillé dans le code.
- Toute migration additive ; aucune donnée supprimée.

## Laissé au constructeur

- Le stockage de « dernière visite du suivi » et de la coupure e-mail.
- La forme exacte des phrases du suivi, par action.
- Où brancher chaque urgence dans le code existant, en gardant une seule écriture par geste.
- Le découpage en tâches et en commits.
