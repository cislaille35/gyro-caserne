# Copie hebdomadaire de la base

Chaque dimanche vers 3 h 40 (heure de Paris en hiver, 4 h 40 en été), la base principale de la production est copiée, chiffrée, puis envoyée par e-mail à `cislaille35@gmail.com`. Elle contient tout ce que l'appli sait : agents, plannings, remplacements, messages, prises de garde, réglages.

- **Objet** : « Copie de la base Gyro Caserne (laille) du 15/11/2026 ».
- **Pièce jointe** : `copie-laille-2026-11-15.age.txt`, chiffrée.
- **Photos** : elles ne sont pas copiées, car elles sont trop lourdes pour un e-mail. Elles sont couvertes par le retour en arrière de Cloudflare, sur 7 jours.

> **Seule la clé privée du porteur ouvre les copies. Si la clé est perdue, toutes les copies sont perdues.** Personne ne peut les rouvrir : ni Cloudflare, ni GitHub, ni Claude.

Détail technique : [sauvegarde.md](../technique/sauvegarde.md). Décision : [0029](../decisions/0029-copie-hebdomadaire.md).

## 1. Créer la paire de clés (une fois)

1. Installer age (version 1.2 ou plus récente) :
   - Debian ou Ubuntu : `sudo apt install age` ;
   - macOS : `brew install age` ;
   - Windows : `winget install --id FiloSottile.age`.
2. Créer la paire : `age-keygen -o cle-gyro.txt`. La commande affiche la clé publique, `Public key: age1…`. Le fichier contient la clé privée, `AGE-SECRET-KEY-1…`.
3. Copier tout le contenu de `cle-gyro.txt` dans le gestionnaire de mots de passe, dans une note sécurisée « Gyro Caserne : clé des copies ». Vérifier que la note est bien enregistrée.
4. Poser la clé publique dans GitHub : Settings › Secrets and variables › Actions › onglet Variables, variable `COPIE_CLE_PUBLIQUE_PRODUCTION` = `age1…`. Elle n'est pas secrète.
5. Effacer le fichier : `rm cle-gyro.txt`.

**Option : une deuxième clé.** Une personne de confiance crée sa propre paire. On ajoute sa clé publique dans la même variable, après un espace. Chaque clé ouvre alors chaque copie : une clé perdue ne fait plus tout perdre. En contrepartie, cette personne peut lire toutes les données.

**Changer de clé.** On crée une paire neuve, puis on remplace la variable. On garde l'ancienne clé privée tant que la boîte contient des copies faites avec elle, c'est-à-dire 3 mois.

## 2. Vérifier dès la première copie

1. Lancer une copie à la main : onglet Actions › « Copie hebdomadaire » › Run workflow › `production`.
2. L'ouvrir en suivant l'étape 3. Une copie qu'on ne sait pas ouvrir ne sert à rien : la vérification se fait tout de suite, pas le jour d'une panne.

## 3. Ouvrir une copie

1. Enregistrer la pièce jointe sur l'ordinateur.
2. Recopier la clé du gestionnaire dans un fichier protégé : `umask 077`, puis coller la clé dans `cle-gyro.txt`.
3. Déchiffrer : `age -d -i cle-gyro.txt copie-laille-2026-11-15.age.txt | gunzip > copie.sql`.
4. Effacer la clé : `rm cle-gyro.txt`.

`copie.sql` contient les vraies données, en clair. Il reste sur l'ordinateur le temps de la restauration seulement. Il ne va jamais dans un dépôt, une PR ni un message. On l'efface ensuite.

## 4. Restaurer

**D'abord, choisir le bon outil.** Si le problème date de moins de 7 jours, le retour en arrière de Cloudflare vaut mieux : il est plus récent que la copie et couvre aussi les photos. Voir [sauvegarde.md](../technique/sauvegarde.md). La copie sert pour un problème plus ancien, ou si le compte Cloudflare est perdu.

**Toujours :**
- prévenir les agents : ce qu'ils ont saisi depuis la copie sera perdu ;
- travailler depuis le dépôt, dans `apps/web`, connecté à Cloudflare (`pnpm exec wrangler login`) ;
- utiliser la config du centre, `C=../../centres/laille/wrangler.jsonc`.

### A. Dans une base neuve (conseillé)

L'ancienne base n'est pas touchée : on peut y revenir, ou la comparer.

1. Créer la base : `pnpm exec wrangler d1 create gyro-caserne-laille-restauree`. La commande affiche son `database_id`.
2. Dans `centres/laille/wrangler.jsonc`, sur la liaison `BASE`, remplacer `database_name` et `database_id` par ceux de la nouvelle base.
3. Charger la copie : `pnpm exec wrangler d1 execute BASE --remote --config $C --file copie.sql`.
4. Appliquer les mises à jour de la base plus récentes que la copie : `CENTRE=laille pnpm base-en-ligne`.
5. Vérifier quelques comptes, par exemple `pnpm exec wrangler d1 execute BASE --remote --config $C --command "SELECT count(*) FROM personne"`.
6. Mettre l'appli sur la nouvelle base : PR de `wrangler.jsonc`, puis tag, comme toute mise en production. En urgence, on peut déployer à la main avec `CENTRE=laille pnpm deployer`, puis faire la PR pour que le dépôt suive.
7. Supprimer l'ancienne base plus tard, une fois sûr : `pnpm exec wrangler d1 delete gyro-caserne-laille`.

### B. Dans la base existante

Cette voie **efface toute la base** avant de la recharger. Pendant l'opération, quelques minutes, l'appli ne marche pas.

1. Noter le point de retour, pour revenir en arrière pendant 7 jours : `pnpm exec wrangler d1 time-travel info BASE --config $C`.
2. Lister les tables actuelles : `pnpm exec wrangler d1 export BASE --remote --config $C --no-data --output tables-actuelles.sql`.
3. Préparer le vidage : `node --experimental-transform-types --no-warnings scripts/copie-restaurable.ts --vider tables-actuelles.sql > vider.sql`. Le script supprime chaque table avant celles qu'elle cite, sinon D1 refuse.
4. Vider la base : `pnpm exec wrangler d1 execute BASE --remote --config $C --file vider.sql`.
5. Charger la copie : `pnpm exec wrangler d1 execute BASE --remote --config $C --file copie.sql`.
6. Appliquer les mises à jour plus récentes que la copie : `CENTRE=laille pnpm base-en-ligne`.
7. Vérifier la connexion, le planning et quelques comptes, comme en A.5.
8. En cas de souci, revenir au point noté : `pnpm exec wrangler d1 time-travel restore BASE --config $C --bookmark=<point noté>`.

**Après la restauration, par A ou par B :**
- effacer `copie.sql`, `tables-actuelles.sql` et `vider.sql` ;
- les photos publiées après la copie restent dans la base des photos, sans publication pour les afficher, ce qui ne gêne rien ;
- les photos effacées depuis la copie manquent : leur publication s'affiche sans image.

## 5. Garder 3 mois

Un filtre Gmail ne sait pas supprimer un message selon son âge. Il ne trie que les messages qui arrivent. Deux façons de faire :

**À la main, une fois par mois :**
1. Créer le filtre, une fois : Paramètres › Filtres › Créer un filtre, objet `Copie de la base Gyro Caserne`, puis « Appliquer le libellé » `Copies Gyro`.
2. Chaque mois, chercher `label:copies-gyro older_than:3m`, tout sélectionner, puis Supprimer.

**Tout seul, par un petit script Google :**
1. Ouvrir script.google.com, connecté à `cislaille35@gmail.com`, puis Nouveau projet.
2. Coller ce script :
   ```js
   function supprimerVieillesCopies() {
     GmailApp.search('subject:"Copie de la base Gyro Caserne" older_than:3m').forEach((fil) => fil.moveToTrash());
   }
   ```
3. Déclencheurs › Ajouter : `supprimerVieillesCopies`, « Déclencheur horaire », une fois par semaine. Accepter l'accès à Gmail.

La corbeille se vide seule après 30 jours. Une copie pèse bien moins de 1 Mo : 13 copies tiennent largement dans la boîte.

## 6. Si un passage échoue

GitHub prévient par courriel, et le passage dit pourquoi, sans aucune donnée :

| Message | Que faire |
|---|---|
| « il manque … » | Poser la variable ou le secret nommé (installation : [installer-un-centre.md](../technique/installer-un-centre.md)). |
| « Clé publique mal formée » | Recopier la clé publique `age1…` (62 caractères). |
| « au-delà de la limite de 4000000 octets » | La base est devenue trop grosse pour un e-mail. Rien n'est parti. Décision à prendre : découper la copie, ou un stockage (R2, qui demande une carte bancaire). |
| « Brevo n'a pas accepté l'envoi » | Clé Brevo de production invalide, expéditeur non vérifié dans Brevo, ou quota du jour atteint (300 e-mails). |
| « L'export de la base a échoué » | Cloudflare indisponible ou jeton changé : relancer à la main plus tard. |

Sans activité sur le dépôt pendant 60 jours, GitHub suspend les tâches planifiées et prévient par courriel. Il suffit de les réactiver dans l'onglet Actions.
