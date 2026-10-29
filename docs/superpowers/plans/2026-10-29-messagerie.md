# Messagerie : plan d'exécution

> **Pour les sous-agents :** sous-skill requis, superpowers:subagent-driven-development. Les étapes sont des cases à cocher (`- [ ]`).

**But :** permettre d'écrire à un collègue ou à un groupe en deux touches depuis Échanges, dans des conversations privées soignées.

**Architecture :**
- **Socle** (`packages/socle`) : conversations, membres, messages, réactions, signalements, dans la base principale `BASE`. Les octets des photos vont dans la base `PHOTOS` (lot « Photos dans leur propre base D1 », fusionné avant ce plan).
- **Appli** (`apps/web`) : `/echanges/messages`, `/echanges/messages/nouveau`, `/echanges/messages/<id>` et `/echanges/messages/<id>/infos`. Le rafraîchissement interroge un point léger, `/echanges/messages/<id>/suite`.

**Technos :** SvelteKit 3, Svelte 5, Drizzle sur D1, Vitest, Playwright et axe.

**Spec :** [`docs/superpowers/specs/2026-10-29-messagerie-design.md`](../specs/2026-10-29-messagerie-design.md). Maquettes : `docs/superpowers/specs/2026-10-29-messagerie/*.dc.html`. Elles reprennent les jetons et les composants du lot 2 (`Visage`, `PastilleMur`, `GyroDuMoment`, `quand.ts`).

## Contraintes globales

- `CLAUDE.md` : français, TDD, code simple, commentaires rares, rien de propre à un centre, aucune dépendance ajoutée.
- **Budget :**
  - 45 requêtes D1 au plus par page ;
  - un appel de rafraîchissement (`suite`, pastille) en fait **3 au plus** ;
  - un `batch` compte pour 1.
- **Limites D1 :**
  - pas de colonnes de même nom issues de tables jointes dans un `batch` ;
  - 100 paramètres liés au plus par requête ;
  - migrations **additives**, générées par `drizzle-kit`.
- **Vie privée :**
  - seuls les membres lisent une conversation, chef et super admin compris, sans exception ;
  - le texte d'un message n'est **jamais** écrit au journal ;
  - les photos ne sont servies qu'après vérification que la personne est membre ;
  - un signalement ne transmet que le message signalé.
- **Accès :** le droit `UTILISER_MESSAGERIE` est requis. Statuts admis : opérationnel, stagiaire, inapte temporaire. Les extérieurs n'y ont pas accès. La règle est écrite une seule fois, dans le socle.
- **RGAA AA :**
  - `role="log"` sur le fil, sans annonce « assertive » ;
  - un texte pour les coches, les heures et les réactions ;
  - le menu des gestes s'utilise au clavier ;
  - cibles de 44 px, contrastes vérifiés en clair et en sombre ;
  - « réduire les animations » est respecté.
- **UI (règle du porteur) :** chaque tâche d'écran fournit des captures Playwright à 390 et 1280 px, en clair et en sombre. Elles sont rangées dans le dossier du suivi et comparées aux maquettes.
- Machine de 2 Go : commandes lourdes en cage (`systemd-run --user --scope -q -p MemoryMax=1100M -p MemorySwapMax=900M timeout 900 …`). Jamais deux à la fois, et le serveur local est arrêté avant `pnpm check`.

## Points de vigilance

1. **Agent parti ou suspendu** :
   - il disparaît de l'annuaire et ne lit plus rien ;
   - parti, il quitte ses groupes, et le dernier animateur est remplacé ;
   - une conversation à deux avec lui passe en lecture seule.

   Tests : tâches 2 et 3.
2. **Deux personnes créent en même temps la même conversation à deux** : la contrainte d'unicité de `cle_paire` tranche. Le second envoi rejoint la conversation existante. Test : tâche 1.
3. **Message modifié ou supprimé pendant qu'un autre le lit** : le rafraîchissement renvoie aussi les messages *modifiés* depuis le dernier passage (`maj_le`), pas seulement les nouveaux. Test : tâche 4.
4. **Membre retiré pendant qu'il a la conversation ouverte** : le prochain rafraîchissement répond 403, et l'écran affiche « Vous ne faites plus partie de ce groupe ». Tests : tâches 2 et 7.
5. **Grand groupe (60) et longue conversation (2 000 messages)** : pagination par identifiant, 40 messages par page, et budget tenu. Tests : tâches 1 et 7.

---

### Tâche 1 : socle, les conversations à deux

**Fichiers :** créer `packages/socle/src/messagerie.ts` et `packages/socle/test/messagerie.test.ts` ; modifier `packages/socle/src/schema.ts`, `packages/socle/src/index.ts` ; générer la migration.

**Interfaces produites :**
- **Tables :**
  - `conversation(id, type 'deux'|'groupe', nom text null, icone text null, cle_paire text unique null, cree_par int, cree_le text, dernier_le text)` ;
  - `membre_conversation(conversation_id, personne_id, animateur int default 0, entre_le text, lu_jusqu_a int default 0, pk(conversation_id, personne_id))` ;
  - `message(id, conversation_id, auteur int null, texte text, reponse_a int null, systeme text null, cree_le text, maj_le text, modifie int default 0, supprime text null ('auteur'|'moderation'))`, avec un index sur `(conversation_id, id)` et un autre sur `(conversation_id, maj_le)`.
  - `personne.coches_lecture int default 1` (colonne ajoutée).
- **Fonctions :**
  - `annuaire(base, acteur, aujourdhui): Promise<{ id; prenom; nom; surnom; equipe: { numero; couleur } | null; role: string | null }[]>`. Elle donne les agents qui ont accès, l'acteur exclu, triés par nom.
  - `exigerMessagerie(base, acteur, aujourdhui): Promise<number>` : renvoie l'id de la personne, ou `RefusDroit('UTILISER_MESSAGERIE')`. C'est la seule règle d'accès.
  - `conversationAvec(base, acteur, personneId, aujourdhui): Promise<number | null>` : la conversation à deux existante, sinon `null`.
  - `envoyer(base, basePhotos, acteur, cible: { conversation: number } | { personne: number }, donnees: { texte: string; reponseA?: number; photos?: Photo[] }, maintenant): Promise<{ conversation: number; message: number }>`. Elle crée la conversation à deux au premier envoi, avec `cle_paire = min:max`, et rejoint l'existante en cas de collision. Le texte fait 1 à 4 000 caractères ; sans texte, il faut au moins une photo.
  - `lireConversation(base, acteur, id, page: { avant?: number }, maintenant): Promise<VueConversation>`. Elle renvoie 40 messages au plus, ainsi que `premierNonLu` et `lectureSeule`. Elle marque l'acteur comme ayant lu jusqu'au dernier message.
  - `mesConversations(base, acteur, maintenant): Promise<ApercuConversation[]>`, triées par `dernier_le` décroissant, avec `nonLus`, l'aperçu (« Vous : … » ou « Prénom : … ») et l'heure.
  - `nonLusTotal(base, acteur): Promise<number>`, en une requête.
- `VueMessage = { id; auteur: { id; prenom; nom; couleur } | null; texte; cree_le; modifie; supprime; systeme; reponse: { id; auteur; extrait } | null; photos: number[]; reactions: { emoji; nombre; deMoi }[]; moi: boolean; coche: 'envoye' | 'lu' | null }` (les réactions et les photos arrivent à la tâche 3, ici avec des tableaux vides).

- [ ] **Étape 1 : tests qui échouent.**
  - Un agent écrit à un autre : la conversation est créée au premier envoi, puis réutilisée ensuite.
  - Une collision de `cle_paire` rejoint la conversation existante (vigilance 2).
  - Un non-membre, le chef de centre compris, reçoit un refus sur `lireConversation` et `envoyer`.
  - Le super administrateur n'a pas de messagerie : refus.
  - Un extérieur ou un agent sans `UTILISER_MESSAGERIE` reçoit `RefusDroit`.
  - `nonLus` et `nonLusTotal` sont justes et retombent à 0 après lecture.
  - La pagination donne 40 messages et `avant` fonctionne. 2 000 messages restent dans le budget (vigilance 5).
  - Les requêtes de `lireConversation` restent à 3 au plus.
  - L'annuaire exclut les partis, les suspendus et les extérieurs.
- [ ] **Étape 2 :** vérifier qu'ils échouent. **Étape 3 :** implémenter et générer la migration. **Étape 4 :** suite du socle et `tsc` au vert. **Étape 5 :** commit « Messagerie : conversations à deux ».

### Tâche 2 : socle, les groupes

**Fichiers :** modifier `packages/socle/src/messagerie.ts` et ses tests, ainsi que `packages/socle/src/actions/personnes.ts` (`changerStatut` vers « parti »).

**Interfaces produites :**
- `creerGroupe(base, acteur, { nom; icone?; membres: number[] }, maintenant): Promise<number>`. Le nom fait 1 à 60 caractères, le groupe compte 2 à 60 membres créateur compris, l'icône est prise dans `NOMS_ICONES` (`groupe` par défaut). Le créateur devient animateur. Un message système `{ type: 'creation', membres }` est ajouté.
- Pour un animateur : `ajouterMembres(base, acteur, id, ids, maintenant)`, `retirerMembre(base, acteur, id, personneId, maintenant)` et `nommerAnimateur(base, acteur, id, personneId, maintenant)`. Pour tout membre : `renommerGroupe(base, acteur, id, nom, maintenant)` et `quitterGroupe(base, acteur, id, maintenant)`.
- Chacune de ces fonctions ajoute son message système : `{ type: 'ajout' | 'retrait' | 'depart' | 'renommage' | 'animateur', par, cibles?, nom? }`.
- `infosConversation(base, acteur, id, aujourdhui): Promise<{ type; nom; icone; creePar; membres: { id; prenom; nom; animateur; equipe; role }[]; moiAnimateur: boolean }>`.
- Un groupe garde au moins un animateur : si le dernier s'en va, le plus ancien membre le devient. Un groupe sans membre est effacé, messages et photos compris.
- `changerStatut(…, 'parti')` fait quitter tous les groupes, avec message système et changement d'animateur. Une conversation à deux avec un parti ou un suspendu s'affiche en `lectureSeule`.
- Raccourcis : `membresPourGroupe(base, acteur, source: { equipe: number } | { comite: number }, aujourdhui): Promise<number[]>`. Elle donne les membres du jour, l'acteur exclu, avec la règle de `membresDe` (`murs.ts`).

- [ ] **Étape 1 : tests qui échouent.** Chaque fonction est testée avec ses droits (un non-animateur ne peut ni ajouter ni retirer), ses limites (60 membres, nom vide ou trop long) et son message système. Tester aussi :
  - le nouvel arrivant voit l'historique ;
  - un membre retiré perd tout accès (vigilance 4) ;
  - la promotion du plus ancien membre ;
  - le groupe vide effacé ;
  - le départ d'un agent « parti » (vigilance 1) ;
  - `membresPourGroupe` pour une équipe et pour un comité.
- [ ] **Étapes 2 à 5 :** comme à la tâche 1. Commit « Messagerie : groupes ».

### Tâche 3 : socle, les gestes, les photos et les coches

**Fichiers :** modifier `packages/socle/src/messagerie.ts` et ses tests, `schema.ts` ; générer la migration.

**Interfaces produites :**
- Tables `reaction_message(message_id, personne_id, emoji, pk(message_id, personne_id))` et `photo_message(id, message_id, ordre, type, photo_id)`, cette dernière pointant vers la table `photo` de `PHOTOS`.
- `REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '👏'] as const`.
- `reagir(base, acteur, idMessage, emoji | null, maintenant)` : une réaction par personne ; envoyer la même la retire.
- `modifierMessage(base, acteur, id, texte, maintenant)` : réservé à l'auteur, dans les **15 minutes**. Met `modifie` à 1 et met à jour `maj_le`.
- `supprimerMessage(base, basePhotos, acteur, id, maintenant)` : réservé à l'auteur. Le texte est vidé, `supprime` passe à `'auteur'` et les photos sont effacées.
- `photoMessage(base, basePhotos, acteur, idPhoto, aujourdhui)` : n'est servie qu'à un membre.
- `envoyer` accepte `photos` : 4 au plus, de 200 Ko chacune, au format JPEG ou WebP, écrites comme pour les murs, d'abord dans `PHOTOS`.
- Coches :
  - `coche` vaut `'lu'` dans une conversation à deux si l'autre a `lu_jusqu_a >= id` ;
  - dans un groupe, `'lu'` si tous les membres présents à l'envoi qui n'ont pas coupé leurs coches l'ont lu ;
  - sinon `'envoye'` ;
  - `null` si l'acteur a coupé les siennes.
- `modifierMonProfil` accepte `cochesLecture: boolean`.

- [ ] **Étape 1 : tests qui échouent.** Les cas de chaque fonction, et en plus :
  - la limite des 15 minutes, et aucune modification d'un message supprimé ;
  - après suppression, le texte est vide et les photos sont effacées dans `PHOTOS` ;
  - une photo demandée par un non-membre est refusée ;
  - les coches dans chacun de leurs cas, y compris un membre qui les a coupées ;
  - la réaction ajoutée, changée puis retirée ;
  - `lireConversation` reste à 3 requêtes, réactions et photos comprises.
- [ ] **Étapes 2 à 5.** Commit « Messagerie : réactions, photos, modifier, supprimer, coches ».

### Tâche 4 : socle, le rafraîchissement, les signalements et la conservation

**Fichiers :** modifier `packages/socle/src/messagerie.ts` et ses tests, `schema.ts` (`signalement_message`), `packages/centre/src/index.ts` (`conservationMessagesMois`, 12 par défaut), `centres/exemple/centre.ts` ; générer la migration.

**Interfaces produites :**
- `suiteConversation(base, acteur, id, depuis: { dernierId: number; majLe: string }, maintenant): Promise<{ nouveaux: VueMessage[]; modifies: VueMessage[]; majLe: string; nonLusTotal: number }>`.
  - 3 requêtes au plus.
  - Les messages modifiés ou supprimés entre deux passages reviennent dans `modifies` (vigilance 3).
  - L'acteur est marqué comme ayant lu.
- `signaler(base, acteur, idMessage, maintenant)` : un membre seulement, et jamais sur son propre message. La table `signalement_message(id, message_id, par, le, auteur, texte_copie, photos_copie text json, classe_le null)` garde une copie du texte. Ces photos sont conservées et ne sont pas effacées tant que le signalement n'est pas classé. Le journal enregistre « signaler », sans le texte.
- `signalements(base, acteur, aujourdhui)` : réservé à `MODERER_MESSAGERIE`, et ne renvoie que les signalements non classés.
- `retirerParModeration(base, basePhotos, acteur, idSignalement, maintenant)` : le message passe à `supprime = 'moderation'` et le signalement est classé.
- `classerSignalement(base, acteur, idSignalement, maintenant)` : la copie est effacée. Les deux actions sont inscrites au journal, sans le texte.
- `effacerAnciens(base, basePhotos, avant: string)` : efface les messages, réactions et photos plus anciens que la date donnée, sans toucher aux signalements non classés. Une conversation vide en reste là (elle ne disparaît pas).
- Déclencheur planifié quotidien :
  - dans `centres/exemple/wrangler.jsonc`, ajouter `"triggers": { "crons": ["30 3 * * *"] }` ;
  - dans `apps/web`, un gestionnaire `scheduled` qui appelle `effacerAnciens` avec la durée du centre. S'appuyer sur la doc de l'adaptateur Cloudflare 8 (`import { env } from 'cloudflare:workers'`) ; si l'adaptateur n'expose pas `scheduled`, envelopper le worker comme le décrit sa doc.

- [ ] **Étape 1 : tests qui échouent.** Les cas de chaque fonction, et en plus :
  - le rafraîchissement renvoie nouveaux et modifiés, en 3 requêtes ;
  - un membre retiré reçoit un refus ;
  - le signalement : interdit sur son propre message, copie gardée après suppression par l'auteur, visible du seul modérateur ;
  - un modérateur non membre n'obtient rien d'autre que le message signalé ;
  - le journal ne contient jamais le texte ;
  - `effacerAnciens` respecte la limite de date et les signalements non classés ;
  - le gestionnaire planifié appelle `effacerAnciens` avec la bonne date.
- [ ] **Étapes 2 à 5.** Commit « Messagerie : rafraîchissement, signalements, conservation ».

### Tâche 5 : appli, la liste des messages et la pastille

**Fichiers :** créer `apps/web/src/routes/echanges/messages/+page.server.ts`, `+page.svelte` et leurs tests, ainsi que `apps/web/src/routes/echanges/messages/pastille/+server.ts`. Modifier `apps/web/src/routes/echanges/+layout.svelte` et `+layout.server.ts` (filtres « Murs » et « Messages », « Tout » retiré), le layout racine et la navigation (pastille de l'onglet Échanges : `nonLusTotal`).

**Comportement (maquette M1) :**
- La liste se trie de la plus récente à la plus ancienne. Chaque ligne a un visage (initiales, ou icône du groupe sur sa teinte) et un aperçu.
- **Non-lus :** heure en couleur et gras, avec la pastille.
- **Recherche :** filtre sur le nom, côté navigateur. Sans JavaScript, elle passe par un paramètre `q`.
- **Bouton flottant :** crayon, `aria-label` « Nouveau message », vers `/echanges/messages/nouveau`. Il ne cache jamais le dernier élément.
- **Phrases :** en bas de liste, la phrase de confidentialité ; s'il n'y a rien, l'écran vide avec Gyro.
- **Pastille :** rafraîchie toutes les 30 s, page visible seulement, via `pastille/+server.ts` (JSON `{ nonLus }`, 2 requêtes au plus). Elle compte les messages non lus. La pastille des murs reste dans leur liste.

- [ ] **Étape 1 : tests qui échouent.** Le chargement (ordre, non-lus, aperçus « Vous : … »), le rendu (filtres, flottant, vide, niveau Sobre sans Gyro), la pastille JSON et son budget. Un extérieur est redirigé vers `/echanges` avec le message « La messagerie n'est pas ouverte à votre profil ».
- [ ] **Étape 2 :** vérifier l'échec. **Étape 3 :** implémenter, puis prendre les captures. **Étape 4 :** suite web et `pnpm check`. **Étape 5 :** commit « Messages : la liste et la pastille ».

### Tâche 6 : appli, nouveau message et création de groupe

**Fichiers :** créer `apps/web/src/routes/echanges/messages/nouveau/` et `nouveau/groupe/` (`+page.server.ts`, `+page.svelte`, tests).

**Comportement (maquette M2) :**
- **Haut de page :** « Annuler », puis la recherche (nom, prénom, surnom).
- **« Nouveau groupe ».**
- **« Pour vous » :** chef d'équipe, « Groupe avec l'équipe N », « Groupe avec <comité> ». Une ligne n'apparaît que si elle a un sens.
- **« Tout le centre » :** l'annuaire.
- **Toucher une personne :** ouvre `/echanges/messages/<id>` si la conversation existe, sinon `/echanges/messages/a/<personneId>`. Cette dernière route est à créer : elle affiche une conversation vide, que le premier envoi crée.
- **Création de groupe :**
  - membres cochés (préremplis par `?equipe=` ou `?comite=` via `membresPourGroupe`) ;
  - puis nom (prérempli « Équipe 1 » ou le nom du comité) et icône (`ChoixIcone`) ;
  - puis « Créer », qui redirige vers le groupe.

- [ ] **Étape 1 : tests qui échouent.** Raccourcis selon le profil, recherche, préremplissage, création (nom, limites, erreurs reliées à leur champ), redirection, budget.
- [ ] **Étapes 2 à 5, avec captures.** Commit « Messages : nouveau message et création de groupe ».

### Tâche 7 : appli, la conversation

**Fichiers :** créer `apps/web/src/routes/echanges/messages/[id]/` et `messages/a/[personne]/` (`+page.server.ts`, `+page.svelte`, tests), `[id]/suite/+server.ts` (JSON), `[id]/photo/[photo]/+server.ts`. Créer aussi `apps/web/src/lib/ui/Bulle.svelte` et `apps/web/src/lib/messagerie/regrouper.ts`, avec leurs tests.

**Comportement (maquette M3) :**
- **En-tête :** retour, visage, nom, membres ; il ouvre les infos.
- **Fil :** `role="log"`, nom accessible « Messages de <nom> ».
- **`regrouper(messages, moi)` :** regroupe par auteur (moins de 5 min) et par jour. Elle place les séparateurs « Aujourd'hui », « Hier » et la date, ainsi que le bandeau « N messages non lus ». Fonction pure.
- **Bulles :**
  - les miennes à droite, sur une teinte chaude (jeton à créer, AA en clair et en sombre) ;
  - le nom de l'auteur en couleur sur la première bulle, en groupe ;
  - l'heure dans la bulle ;
  - la coche avec son texte (« envoyé », « lu ») ;
  - la citation, qu'on touche pour remonter au message ;
  - les photos ;
  - les réactions, en texte : « 👏 2, dont vous » ;
  - les mentions « modifié », « Message supprimé » et « Message retiré par la modération » ;
  - les messages système, centrés.
- **Ouverture :** au premier non lu, sinon en bas.
- **Bouton « ↓ » :** avec le nombre de nouveaux messages quand on lit plus haut, sans défilement automatique.
- **Gestes :**
  - **ouverture :** appui long au doigt, bouton « ⋯ » au clavier et à la souris, qui ouvre un menu accessible (`menu` et `menuitem`, Échap pour fermer, focus rendu) ;
  - **actions :** répondre, les 6 réactions, copier, modifier (15 min), supprimer (avec confirmation), signaler (avec confirmation, « Le message a été transmis au chef de centre ») ;
  - **glisser à droite :** au téléphone, ça déclenche « répondre », en Pointer Events ;
  - **ce que le geste ne fait jamais :** il n'est jamais le seul moyen, et « réduire les animations » coupe le mouvement.
- **Saisie :** le champ grandit jusqu'à 5 lignes. À l'ordinateur, Entrée envoie, Maj + Entrée va à la ligne. On joint des photos (4 au plus, réduites à 200 Ko). Le brouillon est gardé par conversation (`localStorage`, dans un `try/catch`). Le bouton « Envoyer » a son `aria-label`.
- **Rafraîchissement :** `suite` toutes les **4 s**, seulement quand la page est visible, et relancé juste après un envoi. Un 403 affiche « Vous ne faites plus partie de ce groupe » et coupe la saisie (vigilance 4).
- **Sans JavaScript :** l'envoi recharge la page, et tout reste lisible.
- **Lecture seule :** une conversation dont l'autre personne a quitté l'annuaire remplace la saisie par « <Prénom> n'est plus dans l'annuaire ».

- [ ] **Étape 1 : tests qui échouent.**
  - `regrouper` : les cas de regroupement, les jours, le bandeau.
  - `Bulle` : chaque variante, et ses textes pour les lecteurs d'écran.
  - Chargement de la page et budget (2 000 messages, vigilance 5).
  - `suite` en JSON, avec son budget de 3 requêtes et le 403.
  - Envoi, réponse, photo.
  - Menu de gestes au clavier : un test Playwright dans `apps/web/e2e`.
- [ ] **Étapes 2 à 5, avec captures** : un groupe de 4 et une conversation à deux, à 390 px en clair et en sombre, et à 1280 px. Commit « Messages : la conversation ».

### Tâche 8 : appli, infos du groupe, fiche agent et réponse en privé

**Fichiers :** créer `apps/web/src/routes/echanges/messages/[id]/infos/`. Modifier la fiche agent (`apps/web/src/routes/agents/[id]/+page.svelte`, qui a aujourd'hui un lien `mailto` « Écrire ») et la carte de publication (`apps/web/src/lib/ui/Publication.svelte`, menu « Répondre en privé »).

**Comportement (maquette M4) :**
- **En-tête des infos :** icône, nom, « Groupe · N membres · créé par X », « Renommer », phrase de confidentialité.
- **Membres :** liste avec « Animateur » écrit en texte et un menu par membre (écrire, nommer animateur, retirer). Les deux derniers sont réservés aux animateurs.
- **Actions :** « Ajouter des membres » vers la sélection de la tâche 6, et « Quitter le groupe » avec confirmation.
- **Conversation à deux :** fiche courte de la personne (équipe, rôle, téléphone s'il est visible) et « Voir la fiche ».
- **Fiche agent :** « Écrire » mène à la conversation, si la personne a `UTILISER_MESSAGERIE` et que ce n'est pas soi. Le `mailto` reste, rangé sous « Courriel ».
- **« Répondre en privé »** (sur une publication dont on n'est pas l'auteur) : il ouvre la conversation avec l'auteur, le champ prérempli par « À propos de « <80 premiers caractères> » : ».

- [ ] **Étapes 1 à 5, avec captures.** Les tests couvrent les droits (un non-animateur ne voit pas les actions des animateurs), les confirmations, les erreurs, les redirections et le budget. Commit « Messages : infos du groupe, Écrire depuis la fiche, Répondre en privé ».

### Tâche 9 : modération, Mon profil, ordinateur, accessibilité et doc

**Fichiers :**
- la cloche et `notifications/` : les signalements pour qui a `MODERER_MESSAGERIE`, avec les actions « Retirer le message » et « Classer » ;
- `apps/web/src/routes/profil/` : la case « Montrer quand j'ai lu les messages » ;
- `apps/web/src/routes/echanges/+layout.svelte` : les colonnes ;
- `apps/web/e2e/accessibilite.spec.ts` ;
- la doc et `CLAUDE.md`.

**Comportement (maquette M5) :**
- **Colonnes :**
  - à 1024 px et plus, la liste des conversations à gauche, la conversation au centre ;
  - à 1280 px et plus, les infos du groupe à droite ;
  - l'ordre au clavier suit l'ordre affiché.
- **Signalement dans la cloche :** il montre le texte copié, l'auteur, la date et qui a signalé, jamais le reste de la conversation.
- **Doc à mettre à jour :**
  - `docs/fonctionnel/messagerie.md` : animateurs multiples et historique visible ; retirer « sauf mention » ;
  - créer `docs/utilisation/comment-ecrire-a-un-collegue.md` et `docs/utilisation/comment-creer-un-groupe.md` ;
  - `docs/technique/` : tables, déclencheur planifié et rafraîchissement ;
  - ajouter à `CLAUDE.md`, section « Code » : « Chaque écran est soigné et son point d'entrée pensé pour être fluide : c'est l'interface qui fait adopter l'appli. »

- [ ] **Étape 1 : tests qui échouent.**
  - Accessibilité Playwright sur la liste, le nouveau message, une conversation et les infos, aux deux tailles, en clair et en sombre, au niveau Vivant et avec les animations réduites.
  - Les signalements dans la cloche : visibles et actions.
  - La case du profil.
  - La colonne des infos à 1280 px.
- [ ] **Étapes 2 à 5, avec captures, CI au vert.** Commit « Messages : modération, profil, ordinateur, accessibilité, doc ».
