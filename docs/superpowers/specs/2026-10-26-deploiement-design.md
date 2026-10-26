# Déploiement : préprod et production

Date : 2026-10-26. Validé en conversation avec le porteur, avant relecture du document.

## Pourquoi

Le socle est fusionné, mais l'appli n'existe encore nulle part en ligne. Le déploiement vient avant le design des écrans :
- il lève un risque (les commandes en ligne n'ont jamais tourné, SvelteKit 3 et l'adaptateur Cloudflare 8 ont déjà surpris) ;
- la préprod permet au porteur de voir chaque proposition d'écran sur son téléphone.

## Mot d'ordre

**Gratuit de bout en bout.** Il pourra changer plus tard (domaine à 10 €/an si le comité l'accepte) : ce changement ne doit demander aucune modification de code.

## Ce qui est décidé

- **Deux applis** sur le compte Cloudflare du CIS Laillé, chacune avec sa base D1 (décision 0006) :
  - préprod : `gyro-caserne-exemple` (centre fictif `exemple`), adresse en `….workers.dev` ;
  - production : `gyro-caserne-laille`, adresse en `….workers.dev`.
- **Préprod à chaque fusion sur `main`** : la CI vérifie (types, tests, compilation), applique les migrations à la base de préprod, puis déploie.
- **Production sur un tag `vX.Y.Z`** posé par Claude après accord du porteur : même enchaînement, sur la base et l'appli de production. Avant de déployer, la CI vérifie que le tag pointe sur un commit de `main`, sinon elle s'arrête.
- **Dépôt privé** (décision du porteur). Sur l'offre gratuite, un dépôt privé n'a ni environnements GitHub, ni protection de branche, ni règles sur les tags : la garde est le déclenchement sur tag et la vérification ci-dessus. Le risque restant (quelqu'un qui peut pousser pose un tag ou modifie le workflow) se limite au compte de la caserne.
- **Mise en ligne en deux temps** (décision du porteur) : la préprod maintenant ; la production seulement quand les premiers écrans de gestion permettent d'ajouter des agents. Le workflow de production est prêt, mais aucun tag n'est posé avant.
- **Premier jour (préprod)** : la base est créée et reçoit le jeu de départ (grades, profils, responsabilités) ; le porteur est super administrateur (`SUPER_ADMINS`) et se connecte par lien.
- **Courriels par Brevo** (offre gratuite, 300 par jour), expéditeur `cislaille35@gmail.com` vérifié dans Brevo, nom affiché « Gyro Caserne ». Brevo remplace l'adresse d'envoi réelle par une adresse à lui (pas de domaine authentifié) : plus de risque de spam.
- **Écran de connexion** : il dit de regarder dans les indésirables si le courriel n'arrive pas.
- **Resend est retiré** : Brevo s'appelle par une simple requête HTTP (`fetch`), sans bibliothèque. Une dépendance en moins.
- **Passage futur à un domaine** : authentifier le domaine dans Brevo et changer le secret de l'expéditeur. Aucun code.
- **Secrets** : jamais dans le dépôt. Ceux de l'appli dans Cloudflare (`wrangler secret put`), ceux de la CI dans GitHub.

## Choix de Claude, à vérifier par le porteur

- La préprod garde le centre fictif `exemple` : aucune donnée réelle hors de la production.
- Une migration en ligne ne revient pas en arrière toute seule : si une migration échoue, Claude s'arrête et demande avant de la rejouer.
- `centres/exemple` garde son double rôle : modèle copié par les autres centres et préprod de Laillé. Le guide d'installation dit de remplacer le `database_id` en copiant le modèle.
- La préprod reçoit quelques agents fictifs (option du script de jeu de départ), pour que le porteur y voie quelque chose. L'adresse du porteur dans les secrets de préprod est un réglage, pas une donnée d'agent.

## Hors périmètre

- **Import des agents par fichier** : une fonction à part, avec écran ; le format du fichier se définit avec le porteur, après la discussion sur le design. L'ajout à la main reste.
- Le domaine, les écrans de gestion.

## Ce qui reste au constructeur

- **Envoi par Brevo** : remplacer `envoyerCourriel` (même signature, mêmes tests : sans clé, message écrit dans la console). Secrets `BREVO_CLE` et `COURRIEL_EXPEDITEUR` (adresse vérifiée) ; le nom « Gyro Caserne » est fixé dans le code. Retirer `resend` des dépendances et de `docs/technique/`. Une décision `docs/decisions/0007-…` (Brevo au lieu de Resend : gratuité sans domaine, contrepartie spam).
- **Workflow de déploiement** (GitHub Actions), séparé de `verifier.yml` ou à sa suite : préprod sur `push` vers `main`, production sur tag `v*.*.*`. Mêmes règles que la CI actuelle (actions figées par empreinte, droits minimum). Le centre de chaque environnement vient de variables du dépôt GitHub (pas écrit dans le code), pour qu'un autre centre puisse s'en servir dans son fork, ou ne rien déployer s'il ne les définit pas. Jeton et identifiant de compte Cloudflare en secrets GitHub. Pas d'environnements GitHub (indisponibles sur un dépôt privé gratuit).
- **Création de la base de préprod et premier chargement** (la production suivra avec les écrans) : faits une fois, à la main par Claude avec le jeton du porteur (`wrangler d1 create`, `database_id` reporté dans `centres/<id>/wrangler.jsonc`, `base-en-ligne`, `jeu-de-depart --en-ligne`, `wrangler secret put`). `jeu-de-depart --en-ligne` n'a jamais tourné en vrai : le vérifier à cette occasion.
- **Guide** `docs/technique/installer-un-centre.md` et doc de la CI dans `docs/technique/README.md` à mettre à jour (Brevo, déploiement automatique).
- **Ce que le porteur doit fournir** : un jeton Cloudflare (droits Workers et D1, compte du CIS Laillé) et l'identifiant du compte ; une clé d'API Brevo avec `cislaille35@gmail.com` vérifiée comme expéditeur ; l'adresse du super administrateur. Claude donne la marche à suivre pas à pas pour chacun.
- **Vérification de bout en bout** : après le premier déploiement de préprod, demander un lien, le recevoir (y compris dans les indésirables), se connecter.
