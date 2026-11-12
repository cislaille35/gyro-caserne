# Sauvegarde

Deux niveaux, sans carte bancaire (décision [0030](../decisions/0030-copie-hebdomadaire.md)) :

| | Retour en arrière de D1 (Time Travel) | Copie hebdomadaire |
|---|---|---|
| Couvre | les deux bases, `BASE` et `PHOTOS` | la base principale `BASE` seulement |
| Recul | 7 jours (offre gratuite ; 30 jours avec l'offre payante) | 3 mois, dans la boîte `cislaille35@gmail.com` |
| Pour | une mauvaise manipulation, une migration ratée | un problème plus ancien, un compte Cloudflare perdu |
| Où | chez Cloudflare | hors de Cloudflare, chiffrée |

## Retour en arrière (Time Travel)

Toujours actif, sans réglage. Depuis `apps/web`, avec `C=../../centres/<id>/wrangler.jsonc` :
- noter un point de retour avant une opération risquée : `pnpm exec wrangler d1 time-travel info BASE --config $C` (même chose avec `PHOTOS`) ;
- revenir : `pnpm exec wrangler d1 time-travel restore BASE --config $C --bookmark=<point>`, ou `--timestamp=<date Unix>`. La base est remplacée sur place, les requêtes en cours sont coupées, et la commande donne un point pour annuler.

Time Travel ne sait pas restaurer dans une autre base.

La commande de retour que Wrangler affiche après `info` ou `restore` oublie `--config` : toujours la rajouter. Sans terminal interactif, `restore` ne demande pas de confirmation (il répond oui tout seul). Marche de la même façon sur une base créée avec `--jurisdiction eu`.

## Copie hebdomadaire

Workflow `.github/workflows/copie-hebdomadaire.yml`, chaque dimanche à 2 h 41 UTC. On peut aussi le lancer à la main (Run workflow), avec la cible `production` (par défaut) ou `preprod`.

1. **Centre visé** : `CENTRE_PRODUCTION` ou `CENTRE_PREPROD`. Si la variable est vide, la cible n'existe pas encore : le passage le dit et s'arrête au vert, sans rien toucher. La production ne se copie qu'avec le workflow de `main` : une branche en cours pourrait afficher des données.
2. **Réglages présents**, avant tout export : la clé publique, le destinataire et la clé Brevo de la cible. Seule leur présence est lue. Les clés publiques doivent être des clés age X25519 (`age1…`, 62 caractères).
3. **age** : le binaire officiel est téléchargé à une adresse fixe, puis son empreinte SHA-256 est vérifiée.
4. **Export** : `wrangler d1 export BASE --remote`, en une fois (un seul instantané). Le jeton `CLOUDFLARE_API_TOKEN` en place suffit : l'export demande le droit **D1 : Edit**, déjà donné pour le déploiement. Il bloque la base quelques secondes, d'où l'heure de nuit. Wrangler reste muet : seules ses lignes d'erreur sont montrées en cas d'échec.
5. **Mise en ordre** : `apps/web/scripts/copie-restaurable.ts` remet l'export dans un ordre que D1 accepte. Il faut ce détour, vu à l'essai : l'export suit l'ordre de création des tables, qui n'est pas celui des liens entre tables. Un export brut ne se restaure pas : « no such table », puis « FOREIGN KEY constraint failed ». En effet, D1 contrôle les liens à chaque instruction d'un fichier, malgré `PRAGMA defer_foreign_keys`. Le script met :
   - les tables et les index d'abord ;
   - puis les données, chaque table après celles qu'elle cite ;
   - les compteurs AUTOINCREMENT (`sqlite_sequence`) à la fin, effacés puis remis, pour qu'un id effacé ne soit jamais réutilisé ;
   - les statistiques `sqlite_stat1` sont laissées de côté.

   Il refuse un cycle entre tables, qu'aucun ordre ne restaurerait, une table inconnue et toute autre instruction. Avec `--vider`, il écrit le vidage d'une base, chaque table supprimée avant celles qu'elle cite. Tests : `src/copie-restaurable.test.ts`, dont un rechargement dans SQLite avec les liens contrôlés à chaque instruction, comme D1.
6. **Compression et chiffrement** : `gzip -9`, puis `age -a`, pour chaque clé publique de la variable. La copie en clair est effacée aussitôt.
7. **Taille** : 4 000 000 octets au plus pour la pièce jointe chiffrée. Au-delà, le passage échoue et rien n'est envoyé. Les limites : Brevo accepte 20 Mo par e-mail et conseille 4 Mo par pièce jointe ; Gmail reçoit jusqu'à 25 Mo. La préprod fait 212 Ko de SQL, 24 Ko compressés.
8. **Envoi** : `POST https://api.brevo.com/v3/smtp/email`, sans bibliothèque, comme l'appli (décision 0007). La clé passe par l'entrée standard de `curl`, jamais sur la ligne de commande. La réponse de Brevo n'est montrée qu'en cas de refus (code et message). La pièce jointe s'appelle `copie-<centre>-<AAAA-MM-JJ>.age.txt`, car Brevo refuse l'extension `.age`. La sortie `-a` d'age est un vrai fichier texte.
9. **Ménage** (`if: always()`) : `$RUNNER_TEMP/copie` est effacé, même après un échec.

Discrétion, le dépôt étant public :
- `permissions: {}` ;
- ni artefact, ni cache ;
- chaque secret est donné à la seule étape qui s'en sert ;
- le journal ne montre que des tailles et des noms de fichier.

Gardé par `src/copie-hebdomadaire.test.ts`. Un échec fait échouer le passage, et GitHub prévient par courriel. Sans activité sur le dépôt pendant 60 jours, GitHub suspend les tâches planifiées.

### Réglages GitHub

| Nom | Sorte | Valeur |
|---|---|---|
| `COPIE_CLE_PUBLIQUE_PRODUCTION` | variable | la ou les clés publiques age du porteur, séparées par des espaces |
| `BREVO_CLE_PRODUCTION` | secret | la clé d'API Brevo de la production, la même que `BREVO_CLE` sur le Worker. Le workflow ne lit jamais un secret du Worker. |
| `COURRIEL_EXPEDITEUR_PRODUCTION` | secret, facultatif | l'expéditeur vérifié dans Brevo (à défaut : le destinataire) |
| `COPIE_DESTINATAIRE` | variable | la boîte qui reçoit les copies : `cislaille35@gmail.com` pour Laillé |
| `…_PREPROD` | mêmes noms | pour une copie de la préprod, à la main seulement |

### Restaurer

Mode d'emploi du porteur : [copie-hebdomadaire.md](../fonctionnel/copie-hebdomadaire.md). Il couvre l'ouverture de la copie, puis la restauration dans une base neuve ou dans la base existante.

### Essai du 12/11/2026 (préprod, données fictives)

Avec une paire de clés de test, effacée ensuite. Sur une branche jetable, supprimée ensuite :
- l'export fait 212 Ko de SQL, soit 24 Ko compressés ;
- la restauration dans une base D1 jetable, neuve puis vidée et rechargée en un seul fichier, donne les mêmes comptes sur les 71 tables (980 lignes) et les mêmes 35 compteurs AUTOINCREMENT ; la base jetable a été supprimée ;
- sans production, le passage dit « elle n'existe pas encore, rien n'est copié » ;
- sans clé Brevo, il échoue avant l'export ;
- avec une limite abaissée à 1 000 octets, il échoue au chiffrement (copie de 33 511 octets) et n'envoie rien ;
- l'envoi réel est arrivé dans la boîte du centre : `copie-exemple-2026-11-12.age.txt`, 33 511 octets. Déchiffrée avec la clé de test, elle donne 211 996 octets de SQL. Rechargée dans une base D1 jetable locale (Wrangler `--local`), elle donne les mêmes comptes que la préprod : 71 tables, 980 lignes, 35 compteurs.

Le détail est dans la PR #88.

### Essai du 12/11/2026 (répétition générale, base `eu`, données fictives)

Sur le centre jetable `repetition` (bases `--jurisdiction eu`), après import des copies fictives de l'effectif et des plannings :
- export : 139 Ko de SQL, 14,5 Ko compressés ; l'export d'une base `eu` passe par un stockage européen de Cloudflare ;
- restauration A (base neuve `eu`, chargée par `d1 execute --file`) et B (vidée puis rechargée en un seul fichier) : mêmes comptes que l'origine sur les 71 tables (643 lignes) et les 17 compteurs AUTOINCREMENT ;
- Time Travel : un point noté, une table vidée, `restore --bookmark` : la table revient, le reste est intact, l'appli répond ;
- tout a été supprimé ensuite (Worker et trois bases).

Pour comparer les comptes : D1 refuse un `UNION ALL` de plus de quelques `SELECT` (« too many terms in compound SELECT ») ; compter par lots de 5 tables.
