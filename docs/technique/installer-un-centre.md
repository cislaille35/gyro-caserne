# Installer l'appli pour un nouveau centre

Chaque centre a sa propre copie de l'appli, sur son propre compte Cloudflare (offre gratuite), avec sa propre base. Voir la décision [0006](../decisions/0006-config-cloudflare-par-centre.md).

Suivie de bout en bout le 12/11/2026 (répétition générale, centre jetable sur le compte de Laillé, supprimé ensuite) : les corrections de cette répétition sont intégrées ci-dessous.

## Ce qu'il faut

- Un compte GitHub et un compte Cloudflare au nom du centre (pas d'une personne, pour qu'ils restent au centre).
- Un ordinateur sous Linux, macOS, ou Windows avec WSL.
- Node 24 et pnpm (`corepack enable pnpm`).

## Installer

1. Sur GitHub, créer une copie du dépôt (bouton « Fork »), puis la cloner. **Laillé** travaille dans le dépôt d'origine : pas de fork, et `centres/laille` existe déjà (passer aux étapes 4, puis 6 et suivantes).
2. Choisir l'identifiant du centre : minuscules, chiffres et tirets (par exemple `bruz`).
3. Copier `centres/exemple` en `centres/<id>`, puis dans ce dossier :
   - `centre.ts` : la description du centre, **toute**, pas seulement `id: '<id>'` : `nom`, `commune`, `position`, `departement`, les équipes et leurs couleurs, et surtout `astreinte.reference` (un vendredi et l'équipe d'astreinte ce jour-là : tout le roulement proposé en découle ; une référence fausse fait « changer » toutes les semaines à l'import du planning). Retirer les commentaires « centre fictif » de l'exemple. Conservation, réglable en mois (nombre entier, 1 au moins) : `conservationMessagesMois` (messages, 12 par défaut) et `conservationPublicationsMois` (publications des murs et leurs photos, 24 par défaut ; une publication épinglée est gardée) ; l'effacement se fait chaque nuit. Manœuvres (`manoeuvres`, facultatif) : `debut` et `fin` (HH:MM, la fin après le début), proposés pour une nouvelle manœuvre et donnant la durée d'une ligne sans fin dans le fichier du planning, et `petitDejeuner`, les choix du sondage (de 2 à 6, distincts, 100 caractères au plus) ; sans réglage, de 08:30 à 11:30, « Oui » ou « Non » ;
   - `wrangler.jsonc` : `name` devient `gyro-caserne-<id>`, et `vars.BETTER_AUTH_URL` l'adresse de l'appli, `https://gyro-caserne-<id>.<sous-domaine>.workers.dev` (sous-domaine : étape 7). Elle n'est pas un secret : elle reste en clair dans la config ([0024](../decisions/0024-adresse-dans-la-config.md)). Dans `d1_databases`, `database_name` devient `gyro-caserne-<id>` et `gyro-caserne-<id>-photos` (l'étape 4 le vérifie), et **les deux `database_id` passent tout de suite à `00000000-0000-0000-0000-000000000000`** : ceux de l'exemple sont les bases de la préprod de Laillé, à ne jamais viser par erreur. Les vrais arrivent à l'étape 8.
4. Vérifier : `pnpm install && pnpm check && pnpm test`. Une erreur dans la description est signalée avec la liste des corrections à faire. Un `database_name` resté à `gyro-caserne-exemple` fait échouer `centres.test.ts` (« … a les mêmes réglages techniques que centres/exemple »).
5. Enregistrer le dossier dans le fork : `git add centres/<id> && git commit -m "Centre <id>" && git push`.
6. Se connecter à Cloudflare : `pnpm --filter @gyro-caserne/web exec wrangler login` (une page s'ouvre dans le navigateur). Sur une machine sans navigateur : un jeton d'API (droits de l'étape 1 du déploiement automatique, avec une date d'expiration), donné par les variables `CLOUDFLARE_API_TOKEN` et `CLOUDFLARE_ACCOUNT_ID` du terminal, lues depuis un fichier protégé (`chmod 600`) hors du dépôt. Jamais dans un fichier du dépôt, une commande copiée dans une PR ni un journal.
7. Créer le sous-domaine `workers.dev` du compte, s'il n'existe pas : ouvrir une fois « Workers & Pages » dans le tableau de bord Cloudflare (ou le choisir dans Workers › « Change subdomain »). Il entre dans l'adresse de l'appli : `gyro-caserne-<id>.<sous-domaine>.workers.dev`. Pour Laillé : `cis-laille`. Compter quelques minutes avant de l'utiliser (le temps de son certificat).
8. Créer les deux bases **dans l'Union européenne** (voir [0010](../decisions/0010-photos-dans-leur-base.md)) et reporter chaque `database_id` affiché dans `centres/<id>/wrangler.jsonc` :
   - la base principale : `pnpm --filter @gyro-caserne/web exec wrangler d1 create gyro-caserne-<id> --jurisdiction eu`, liaison `BASE` ;
   - la base des photos : `pnpm --filter @gyro-caserne/web exec wrangler d1 create gyro-caserne-<id>-photos --jurisdiction eu`, liaison `PHOTOS`.

   `--jurisdiction eu` garantit que la base tourne et reste stockée dans l'Union européenne (Wrangler répond par exemple « in region EEUR »). Elle ne se pose **qu'à la création** : impossible de l'ajouter ensuite, il faudrait une base neuve et une restauration. L'indice `--location weur` n'est qu'une préférence, sans garantie : ne pas l'utiliser à la place. Vérifié sur une base `eu` : Time Travel, `d1 export` et `d1 execute --file` marchent comme ailleurs ; `wrangler d1 list` montre `eu` dans la colonne `jurisdiction`.
   Wrangler propose un extrait de config avec une liaison à son nom (`gyro_caserne_<id>`) : n'en recopier que le `database_id`, les liaisons restent `BASE` et `PHOTOS`.
9. Créer les tables en ligne, dans les deux bases : `CENTRE=<id> pnpm --filter @gyro-caserne/web base-en-ligne`. Pour tout ce qui est en ligne (`base-en-ligne`, `jeu-de-depart --en-ligne`, `deployer`), `CENTRE` est obligatoire : sans lui, la commande s'arrête tout de suite avec un message.
10. Charger le jeu de départ en ligne (une seule fois) : `CENTRE=<id> pnpm --filter @gyro-caserne/web jeu-de-depart --en-ligne`. Sans personne fictive. Il pose les profils, rôles, comités, grades, aptitudes, la VL, les types d'engin (FPT, VSAV, VTU) avec leur fiche de prise de garde et l'armement par défaut, mais **aucun engin** : ils s'ajoutent à l'étape 13.
11. Compiler et déployer : `CENTRE=<id> pnpm deployer`. L'adresse de l'appli s'affiche à la fin (en `….workers.dev`) : elle doit être celle de `vars.BETTER_AUTH_URL`, sinon la corriger et redéployer. L'appli ne marche qu'une fois les secrets posés.
12. Poser les secrets, un par un (la valeur est demandée) : `pnpm --filter @gyro-caserne/web exec wrangler secret put <NOM> --config ../../centres/<id>/wrangler.jsonc`. Ils s'appliquent tout de suite, sans redéployer. Sans terminal interactif, la valeur passe par l'entrée standard, sans s'afficher : `openssl rand -base64 32 | tr -d '\n' | pnpm --filter @gyro-caserne/web exec wrangler secret put BETTER_AUTH_SECRET --config …`. **Jamais `--var` pour un secret** : une variable est écrite en clair dans la config du Worker.

    | Secret | Valeur |
    |---|---|
    | `BETTER_AUTH_SECRET` | une longue chaîne aléatoire : `openssl rand -base64 32` |
    | `SUPER_ADMINS` | l'adresse du super administrateur (plusieurs : séparées par des virgules) |
    | `BREVO_CLE` | la clé d'API Brevo du centre |
    | `COURRIEL_EXPEDITEUR` | l'adresse d'expédition vérifiée dans Brevo, par exemple la boîte du centre (le nom « Gyro Caserne » est ajouté par l'appli). Voir [0007](../decisions/0007-brevo.md) |
    | `VAPID_PUBLIQUE` et `VAPID_PRIVEE` | les clés des notifications au téléphone, propres au centre : `pnpm --filter @gyro-caserne/web cles-vapid` les affiche (une paire neuve à chaque fois, jamais écrite sur le disque). Sans elles, l'appli marche, sans notifications au téléphone. Les changer plus tard oblige chaque agent à réactiver les notifications sur ses appareils |
    | `VIGILANCE_CLE` | facultatif : la clé de l'API Vigilance de Météo-France. Créer un compte gratuit sur portail-api.meteofrance.fr, s'abonner à l'API « Données Publiques Vigilance », puis générer une clé d'API (« API Key », de longue durée). Avec `departement` dans `centres/<id>/centre.ts`. Sans elle, l'appli marche, sans bandeau de vigilance ni alerte rouge ; la météo du centre (Open-Meteo) ne demande pas de clé |

    **Sans `BREVO_CLE`**, aucun e-mail ne part : l'appli écrit le lien de connexion dans le journal du Worker (`pnpm --filter @gyro-caserne/web exec wrangler tail gyro-caserne-<id>`). C'est voulu pour un centre d'essai ; en production, qui lit ce journal pourrait se connecter à la place d'un agent. Le contrôle après déploiement refuse donc un Worker sans `BREVO_CLE`.
13. Premier passage dans l'appli : se connecter avec l'adresse de `SUPER_ADMINS`, puis :
    - Caserne › Engins › « Ajouter un engin », pour chaque engin du centre, et vérifier sa fiche de prise de garde ([Comment ajouter un engin ?](../utilisation/ajouter-un-engin.md)) ;
    - Réglages › Armement des engins : vérifier l'équipage de chaque type ;
    - charger l'effectif et le planning ([importer l'effectif](../utilisation/importer-l-effectif.md), [préparer l'année par fichier](../utilisation/preparer-l-annee-par-fichier.md)).
14. Vérifier : `CENTRE=<id> pnpm --filter @gyro-caserne/web controle-deploiement` (voir plus bas, déploiement automatique, étape 7).

## Production : points de vigilance

- **Point de retour avant toute migration.** Avant un tag ou un `base-en-ligne`, noter le point de Time Travel des deux bases (`wrangler d1 time-travel info BASE --config …`, puis `PHOTOS`) dans le compte rendu de la mise en production. Le workflow ne le fait pas. Garder `--config` : la commande de retour que Wrangler propose l'oublie.
- **Commandes qui répondent « oui » toutes seules.** Sans terminal interactif (script, CI), `wrangler d1 time-travel restore` ne pose pas sa question « OK to proceed? » : il répond oui tout seul (« Using fallback value in non-interactive context: yes ») ; `wrangler secret delete` supprime aussi sans demander. Vérifier la config visée avant de lancer.
- **Jamais `--var` ni de `vars` pour un secret** (clé Brevo, `BETTER_AUTH_SECRET`, clés VAPID, `SUPER_ADMINS`) : seulement `wrangler secret`.
- **Export de la base.** `wrangler d1 export` affiche une adresse de téléchargement valable une heure, qui donne toute la base : ne jamais la coller dans une PR, un ticket ou un message. Le fichier exporté ne va jamais dans un dépôt.
- **Pas de données réelles hors de Cloudflare** : pas de capture de la production dans une PR (captures sur la préprod fictive), pas de parcours automatique sur la production, diagnostics limités aux comptes et aux temps, sans nom ni adresse.
- **Clé Brevo à part** pour la production, révocable sans toucher à la préprod. Un compte Brevo à part évite en plus qu'un essai en préprod épuise la limite gratuite (300 e-mails par jour). Laillé garde un seul compte (peu d'envois en préprod) : à séparer si la limite gêne un jour.

## Supprimer un centre

Pour un centre d'essai, ou après un déménagement :
1. `pnpm --filter @gyro-caserne/web exec wrangler delete --name gyro-caserne-<id>` (Worker, secrets et tâches planifiées). Avec un jeton limité aux droits du déploiement, Wrangler finit sur « Authentication error » en cherchant d'éventuels stockages KV : le Worker est pourtant supprimé (l'adresse répond 404).
2. `pnpm --filter @gyro-caserne/web exec wrangler d1 delete gyro-caserne-<id>`, puis `gyro-caserne-<id>-photos` (et toute base de restauration). Définitif après la fenêtre de Time Travel.
3. Retirer `centres/<id>`, et les variables et secrets GitHub qui le nomment.
4. Vérifier : `wrangler d1 list` et la liste des Workers (tableau de bord, Workers & Pages).

## Déploiement automatique (facultatif)

Pour que GitHub déploie tout seul :

1. Dans Cloudflare, créer un jeton d'API (« Create Custom Token ») avec les droits Account › Workers Scripts : Edit, Account › D1 : Edit et Account › Account Settings : Read.
2. Dans le fork, onglet Settings › Secrets and variables › Actions :
   - secrets `CLOUDFLARE_API_TOKEN` (le jeton) et `CLOUDFLARE_ACCOUNT_ID` (affiché sur la page d'accueil du compte Cloudflare) ;
   - variable `CENTRE_PRODUCTION` = `<id>` ; et, pour une préprod, `CENTRE_PREPROD` = l'identifiant de son centre de démonstration.
3. Facultatif, pour que le déploiement pose aussi la clé de la vigilance : secret `VIGILANCE_CLE` (la même pour la préprod et la production ; à renouveler avant son expiration, le bandeau disparaît sinon sans bloquer l'appli).
4. Facultatif, pour que le déploiement pose aussi les clés des notifications : secrets `VAPID_PUBLIQUE_PRODUCTION` et `VAPID_PRIVEE_PRODUCTION` (et `…_PREPROD` pour une préprod), avec des paires créées par `pnpm --filter @gyro-caserne/web cles-vapid`. Par exemple, sans afficher la clé privée : `node --experimental-transform-types apps/web/scripts/cles-vapid.ts | while IFS='=' read -r nom valeur; do printf %s "$valeur" | gh secret set "${nom}_PRODUCTION"; done`.
5. Copie hebdomadaire de la base, chiffrée et envoyée par e-mail ([sauvegarde.md](sauvegarde.md)). Sans ces réglages, le passage du dimanche échoue et GitHub prévient :
   - le porteur crée sa paire de clés age et garde la clé privée en lieu sûr ([mode d'emploi](../fonctionnel/copie-hebdomadaire.md)) ;
   - variable `COPIE_CLE_PUBLIQUE_PRODUCTION` = sa clé publique `age1…` ;
   - variable `COPIE_DESTINATAIRE` = la boîte qui reçoit les copies ;
   - secret `BREVO_CLE_PRODUCTION` = la clé Brevo de la production, la même que le secret `BREVO_CLE` du Worker ;
   - facultatif, secret `COURRIEL_EXPEDITEUR_PRODUCTION` = l'expéditeur vérifié dans Brevo ; à défaut, le destinataire ;
   - puis lancer une copie à la main (Actions › Copie hebdomadaire › Run workflow) et vérifier qu'elle s'ouvre.
6. Ensuite : chaque mise à jour de `main` déploie la préprod ; un tag `vX.Y.Z` posé sur `main` déploie la production. Ce que fait un tag, dans l'ordre : vérification complète (types, accessibilité) ; contrôle que le tag est sur `main` ; `base-en-ligne` sur les deux bases de `CENTRE_PRODUCTION` ; `pnpm deployer` ; pose des clés VAPID et de la vigilance si leurs secrets existent ; contrôle après déploiement ; fiche de version (Releases) si le déploiement a réussi. Sans variable `CENTRE_PRODUCTION`, le tag ne lance que la vérification. Avec des `database_id` encore à zéro, `base-en-ligne` échoue et rien n'est déployé. Avant le premier tag : bases créées (étape 8) et leurs `database_id` fusionnés sur `main`, secrets du Worker posés (étape 12, le Worker existe après un premier `CENTRE=<id> pnpm deployer` à la main), variable `CENTRE_PRODUCTION`, secrets `VAPID_*_PRODUCTION`, et le point de retour noté.
7. Après chaque déploiement, un contrôle fait échouer le passage, avec la liste des noms manquants, si `BETTER_AUTH_SECRET`, `SUPER_ADMINS` ou `BREVO_CLE` manque sur le Worker, ou l'adresse de l'appli ; puis il vérifie que `/connexion` répond. À la main : `CENTRE=<id> pnpm --filter @gyro-caserne/web controle-deploiement`. Seuls les noms des secrets sont lus, jamais leurs valeurs.

`centres/exemple` sert à la fois de modèle et de préprod pour le CIS Laillé : ses `database_id` sont ceux de la préprod de Laillé (voir l'étape 3 de l'installation).

## Mettre à jour

1. Sur GitHub, dans le fork : « Sync fork ». Seul `centres/<id>/` a été modifié, donc il n'y a pas de conflit.
2. En local : `git pull`, puis `pnpm install && pnpm test`. Si un test signale un réglage technique différent de `centres/exemple`, recopier ce réglage dans `centres/<id>/wrangler.jsonc`.
3. Mettre à jour les tables en ligne (les deux bases) : `CENTRE=<id> pnpm --filter @gyro-caserne/web base-en-ligne`. Si la mise à jour ajoute la base des photos (décision 0010), la créer d'abord comme à l'étape 8.
4. `CENTRE=<id> pnpm deployer`.

## Adresse posée en secret (avant novembre 2026)

Si `BETTER_AUTH_URL` était un secret sur le Worker, rien à retirer : au premier déploiement avec `vars.BETTER_AUTH_URL`, Wrangler prévient que la variable remplace le secret (en local, il demande de confirmer : répondre oui), et la nouvelle version porte l'adresse en clair. Ne jamais la repasser en `--var` ni en secret.

## Règle

Ne modifier que `centres/<id>/`. Une correction du code commun se propose au dépôt d'origine, pour en faire profiter tous les centres.
