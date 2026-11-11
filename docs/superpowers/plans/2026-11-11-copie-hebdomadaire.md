# Copie hebdomadaire chiffrée : plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** chaque semaine, la base principale de la production, exportée, compressée, chiffrée pour le seul porteur, part par e-mail à `cislaille35@gmail.com`.

**Architecture :** un workflow GitHub Actions planifié, `copie-hebdomadaire.yml`, `wrangler d1 export` (la version du lockfile, installée par `pnpm install --frozen-lockfile`), `gzip`, `age`, puis l'API de Brevo par `curl`. Rien ne reste sur GitHub : ni artefact, ni fichier, ni ligne de la base dans le journal.

**Tech Stack :** GitHub Actions, Wrangler 4.152, age 1.3.2, Brevo API v3.

**Spec :** `docs/superpowers/specs/2026-11-11-mise-en-production-laille-design.md`, section « Sauvegarde » ; plan parent, lot 2.

## Choix tranchés

| Question | Choix | Pourquoi |
|---|---|---|
| Où tourne la tâche | GitHub Actions, le dimanche à 2 h 41 (UTC), et à la main | Le jeton `CLOUDFLARE_API_TOKEN` est déjà là, avec le droit **D1 : Edit** (l'export passe par `POST …/d1/database/{id}/export`, une écriture au sens de Cloudflare : « D1 Edit, grants write access to D1 ») ; `wrangler d1 export --remote` l'utilise tel quel. Une tâche de nuit du Worker ne peut pas exporter sa base (pas d'API d'export dans le Worker) et consommerait le calcul de l'offre gratuite. L'export bloque la base quelques secondes : la nuit, hors des réveils de 3 h 30. |
| Chiffrement | **age** 1.3.2, clé X25519 classique, sortie en texte (`-a`) | Une seule commande pour créer la paire (`age-keygen`), une ligne de clé privée à ranger dans un gestionnaire de mots de passe, un seul fichier à déchiffrer, sans trousseau ni réglage. `gpg` est déjà sur les machines de GitHub, mais son trousseau, ses sous-clés et ses dates d'expiration sont un piège pour un non-spécialiste. Binaire officiel téléchargé à une adresse fixe, empreinte SHA-256 vérifiée (`cbe24006…26ac10`, identique à celle que GitHub publie pour la version). |
| Compression | `gzip -9 -n` avant le chiffrement | Le SQL se compresse bien ; le chiffré, lui, ne se compresse plus. |
| Taille | Pièce jointe de **4 000 000 octets** au plus, sinon échec | Brevo : 20 Mo par e-mail, 4 Mo conseillés par pièce jointe ; Gmail reçoit jusqu'à 25 Mo. Au-delà : rien n'est envoyé, message clair (découper ou passer à R2 : décision du porteur). |
| Format de la pièce jointe | `copie-<centre>-<date>.age.txt` | Brevo refuse l'extension `.age` (liste fermée : `txt`, `zip`, `tar`…). La sortie texte d'age (`-a`) est un vrai fichier texte ; `age -d` la lit directement. |
| Envoi | `POST https://api.brevo.com/v3/smtp/email` par `curl`, clé passée par l'entrée standard (jamais sur la ligne de commande) | Comme l'appli (décision 0007), sans bibliothèque. Clé de production : secret de dépôt `BREVO_CLE_PRODUCTION`. Aucun secret du Worker n'est lu. |
| Cible | Entrée `cible` (`production` par défaut, ou `preprod`) ; le passage planifié vise la production | Tant que `CENTRE_PRODUCTION` est vide, le passage le dit et s'arrête au vert, sans rien toucher. |

**Réglages GitHub** (par cible, `<CIBLE>` = `PRODUCTION` ou `PREPROD`) :
- variable `COPIE_CLE_PUBLIQUE_<CIBLE>` : une clé publique age ou plusieurs, séparées par des espaces ;
- secret `BREVO_CLE_<CIBLE>` ;
- secret facultatif `COURRIEL_EXPEDITEUR_<CIBLE>` (sinon : le destinataire, qui est l'expéditeur vérifié de Laillé) ;
- variable `COPIE_DESTINATAIRE` (`cislaille35@gmail.com`).

## Global Constraints

- Dépôt public : ni artefact, ni cache, ni fichier de la base ou ligne de SQL dans un journal (`wrangler` muet, seules ses lignes d'erreur sont montrées en cas d'échec).
- `permissions: {}`, `set -euo pipefail`, `umask 077`, fichiers dans `$RUNNER_TEMP/copie`, effacés par une étape `if: always()`.
- Les secrets ne sont donnés qu'à l'étape qui en a besoin.
- Échec visible : GitHub prévient par courriel.

## Review Focus

- Copie plus grosse que 4 000 000 octets : échec, message clair, rien d'envoyé (essai avec une limite abaissée).
- Clé publique absente ou mal formée : échec avant l'export.
- `cible: preprod` sans clé Brevo de préprod : ne jamais retomber sur la clé de production (choix fait en Bash, pas par `a && b || c`).
- Production pas encore créée : rien sur elle, et le résumé le dit.
- Export vide ou tronqué : échec (le fichier doit contenir `CREATE TABLE` et `d1_migrations`).

---

### Tâche 1 : le workflow et son garde-fou

**Files :**
- Create : `.github/workflows/copie-hebdomadaire.yml`
- Test : `apps/web/src/copie-hebdomadaire.test.ts`

- [ ] **Test d'abord** (lecture du fichier comme texte, sur le modèle de `centres.test.ts`) : `permissions: {}` ; pas d'`upload-artifact` ni de `cache` ; l'adresse `…/age/releases/download/v1.3.2/age-v1.3.2-linux-amd64.tar.gz` et son empreinte ; une étape de ménage `if: always()` qui efface `$RUNNER_TEMP/copie` ; chaque bloc `run:` commence par `set -euo pipefail` ; la limite `4000000` ; `CLOUDFLARE_API_TOKEN` et `BREVO_CLE_` jamais au niveau du job. Il échoue (fichier absent).
- [ ] **Le workflow** : étapes « Centre visé », « age », « Réglages présents », « Export » (jeton Cloudflare seul), « Compression et chiffrement » (aucun secret), « Envoi » (clé Brevo seule), « Ménage ».
- [ ] `pnpm --filter @gyro-caserne/web test copie-hebdomadaire` au vert ; commit, push SSH, PR en brouillon.

### Tâche 2 : essai réel sur la préprod

- [ ] Paire de clés de test (`age-keygen`, clé privée dans le scratchpad, droits 600) ; variable `COPIE_CLE_PUBLIQUE_PREPROD`.
- [ ] Branche jetable `essai/copie-hebdomadaire` : le même workflow déclenché par `push`, cible `preprod`, plus un job « restauration » qui exporte, restaure dans une base D1 jetable créée puis supprimée (base neuve, puis par-dessus elle-même après l'avoir vidée), et compare le nombre de lignes de chaque table ; plus un passage avec une limite de 1 000 octets (doit échouer sans envoi).
- [ ] Envoi réel (demande `BREVO_CLE_PREPROD` au porteur) ; déchiffrement de la pièce jointe reçue sur la machine de développement, restauration dans une base D1 locale neuve, mêmes comptes.
- [ ] Supprimer la branche jetable, ses passages, la base jetable, la clé privée de test.

### Tâche 3 : la doc

- [ ] `docs/fonctionnel/copie-hebdomadaire.md` (mode d'emploi du porteur : créer la paire, la garder, déchiffrer, restaurer dans une base neuve ou l'existante, garder 3 mois, clé perdue = copies perdues) et sa ligne dans le README.
- [ ] `docs/technique/sauvegarde.md`, `docs/technique/README.md` (CI, Technos : age), `installer-un-centre.md` (réglages à poser).
- [ ] Décision `docs/decisions/0029-copie-hebdomadaire.md`.
- [ ] Review (modèle le plus capable, au premier plan), PR prête, CI.
