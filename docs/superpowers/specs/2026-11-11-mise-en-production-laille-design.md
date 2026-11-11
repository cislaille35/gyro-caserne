# Mise en production au CIS de Laillé

Cadré avec le porteur le 11/11/2026.

## Pourquoi

L'appli a atteint un niveau suffisant pour remplacer Slack et le MVP au CIS de Laillé. Le passage aux vraies données doit se faire sans surprise : la doc d'installation n'a jamais été suivie de bout en bout sur un compte neuf, et les vraies données sont des données personnelles.

## Cadre

- **Accord du chef de centre.** Usage **local au CIS de Laillé**, pas encore un outil officiel du SDIS.
- **Données personnelles des agents.** Elles restent chez Cloudflare (base de la production), jamais dans GitHub (dépôt public), ni dans une PR, ni dans un journal de CI.
- Pour un usage officiel sur d'autres centres, un changement d'hébergeur reste possible (voir « Chemin de sortie »).

## Objectifs

- Une installation de Laillé qui suit une doc **vérifiée**, sans étape improvisée.
- L'appli remplie par **deux fichiers**, sans saisie à la main : l'effectif et le planning.
- Un démarrage équipe par équipe, avec un retour possible à tout moment.
- Une sauvegarde qu'on a déjà su restaurer.

## Hors sujet

- Pas de migration des données du MVP ni de Slack (historique des messages, publications) : on part propre.
- **Planning** (décision du porteur) : démarrage avec l'année **2026** importée ; **2027 préparée dans l'appli** (« Préparer l'année ») à partir de 2025 et 2026, qui servent d'historique (tour des fêtes, équité de l'été).
- Pas de saisie manuelle de masse dans l'appli.
- Pas d'écusson réel tant que le droit d'usage n'est pas obtenu (décision 0027).

## Ce qui ferait échouer le projet, même si tout marche

- Une donnée réelle qui apparaît dans le dépôt, une PR, une capture ou un journal de CI.
- Un premier jour où l'accueil est vide (pas de planning) : les agents n'y reviennent pas.
- Une découverte de coquille de la doc sur les vraies données.

## Étape 1 : la répétition générale

Installer un centre **jetable** sur le compte Cloudflare de Laillé, en suivant `docs/technique/installer-un-centre.md` **à la lettre**, et noter chaque écart (étape manquante, commande fausse, ordre, message incompris).
- Centre `repetition` (dossier `centres/repetition/`, Worker `gyro-caserne-repetition`, bases `gyro-caserne-repetition` et `…-photos`), supprimé à la fin (Worker, bases, dossier).
- Bases créées **en Europe** (région ou juridiction européenne de D1, à vérifier dans la doc de Cloudflare et à ajouter à l'installation).
- Import des **copies fictives** des deux fichiers, de même forme que les vrais (mêmes colonnes, mêmes cas particuliers : agent sans adresse, deux grades rapprochés, équipe à 3 ou 4 personnes, vacances en été…).
- Essai de la **sauvegarde et de la restauration** (voir « Sauvegarde ») et du **retour en arrière** (Time Travel de D1).
- Essai du **contrôle après déploiement** et du **premier tag** (`vX.Y.Z`) sur ce centre ou sur la préprod.
- Sortie : la liste des coquilles, corrigées dans la doc et l'outil par une PR, avant toute vraie donnée.

## Étape 2 : préparer les fichiers réels

Le porteur fournit : les plannings annuels 2025 et 2026, le planning d'été passé, et **à part** les adresses e-mail des agents avec leur grade. **Ces fichiers arrivent avant la répétition générale** (choix de Claude) : leur structure sert à fabriquer les copies fictives de l'étape 1 ; ils sont traités comme à l'étape 2 dès leur arrivée.
- Claude les lit, les convertit au **format d'import de l'appli** (fichier de l'effectif, fichier du planning : feuilles Semaines, Manœuvres, Vacances, Été), et liste ce qui manque (adresse, grade, équipe, aptitude…). Porteur et Claude complètent ensemble.
- Un agent sans adresse est signalé : il ne peut pas se connecter tant qu'elle manque.
- **Traitement des fichiers** : sur la machine de développement uniquement, dans un dossier à part **hors de tout dépôt**, droits limités à l'utilisateur ; jamais dans GitHub ; effacés de la machine une fois importés et vérifiés (avec les copies déposées dans la conversation). Les fichiers déposés dans la conversation passent aussi par les serveurs d'Anthropic : le porteur le sait.
- **Données minimales** : nom, prénom, adresse e-mail, équipe, grade, aptitudes, rôles et comités. Téléphone et contact d'urgence restent facultatifs, remplis par l'agent lui-même s'il le veut (choix de Claude). Date de naissance : facultative, ajoutée par l'agent pour son anniversaire.
- **Dates d'entrée et de grade** (décision du porteur) : tout le monde entre en **2025** dans le fichier, chacun ajustera ensuite ; le porteur fournit à part un fichier **adresse e-mail + grade**.

## Étape 3 : installer Laillé

- Adresse de production **choisie par le porteur** : `https://gyro-caserne-laille.cis-laille.workers.dev` (déjà dans `centres/laille/wrangler.jsonc`). Serveur, bases et secrets distincts de la préprod (`gyro-caserne-exemple`) sur le même compte ; seules les limites du compte gratuit sont partagées. Un nom de domaine à soi (environ 10 € par an) le jour où l'appli devient officielle ou change d'hébergeur ; les agents devront alors réactiver leurs notifications une fois.
- Bases de la production **en Europe**, créées selon la doc corrigée.
- **Secrets neufs** : `BETTER_AUTH_SECRET` et une paire VAPID propres à la production ; `BREVO_CLE`, `COURRIEL_EXPEDITEUR`, `SUPER_ADMINS`, `VIGILANCE_CLE` ; variable `CENTRE_PRODUCTION = laille` et secrets `VAPID_*_PRODUCTION` côté GitHub. **Compte Brevo à part pour la production** (recommandation de Claude), pour qu'un essai en préprod n'épuise jamais la limite gratuite (300 courriels par jour) des vrais agents ; adresse d'expédition à vérifier dans ce compte.
- **Point de retour** de la base (`wrangler d1 time-travel info`) noté avant chaque migration, à commencer par la première.
- Premier **tag** de production, après accord du porteur.
- Import des deux fichiers ; vérification en 10 minutes des engins et de leurs fiches (jeu de départ) contre les engins réels de Laillé.
- Page **« Vos données dans Gyro Caserne »** (dans l'appli, lien depuis Moi et la connexion) : ce qui est gardé, où (Cloudflare, en Europe), combien de temps, qui le voit, comment demander une correction ou un effacement.
- **Vigilance pendant l'exploitation** : pas de capture de la production dans une PR (captures toujours sur la préprod fictive) ; diagnostics en production limités aux comptes et aux temps, sans nom ni adresse ; jamais de parcours automatique sur la production.

## Étape 4 : démarrer, équipe par équipe

- Une fois l'effectif importé, tout agent de la liste peut techniquement se connecter : l'ordre d'arrivée se règle par la **communication** (lien et mode d'emploi envoyés à une équipe, puis aux suivantes), pas par l'appli.
- Première équipe, puis les suivantes ; mode d'emploi : `docs/utilisation/` (installer l'appli, se connecter, se faire remplacer…).
- Pendant le démarrage : le relevé quotidien des coupures et du pire temps de calcul est lu chaque jour ; un problème bloquant = arrêt de l'envoi aux équipes suivantes, correction, reprise.

## Agents partis et effacement (décision du porteur)

- Les données personnelles d'un agent parti sont **effacées 12 mois après son départ** par la tâche de nuit ; son nom devient « Ancien agent » dans l'historique (publications, demandes, prises de garde), sans casser les liens.
- Le chef peut aussi **effacer un agent sur demande**, avec confirmation.
- Copies chiffrées gardées 3 mois : un effacement y disparaît au plus tard 3 mois après.
- Demandes de correction ou d'effacement : au chef de centre (dit sur la page « Vos données »).
- **Petit lot de code avant la production** (avec tests, migration éventuelle à faire valider si elle transforme des données).

## Sauvegarde

Choix du porteur (11/11/2026) :
1. **Retour en arrière intégré** (Time Travel de D1) pour une mauvaise manipulation ou une migration ratée (durée de conservation de l'offre gratuite à vérifier, environ 7 jours).
2. **Copie hors de Cloudflare chaque semaine, par e-mail** (décision du porteur, sans carte bancaire : R2 en demande une, décision 0010) : une tâche exporte la **base principale**, la **chiffre avec une clé que seul le porteur possède**, et l'envoie par e-mail à `cislaille35@gmail.com` (boîte principale du centre). La base des photos, trop lourde pour un e-mail, reste couverte par le retour en arrière de Cloudflare.
   - **Jamais dans GitHub** (dépôt public : les fichiers produits par la CI seraient téléchargeables) ; aucune donnée en clair dans un journal.
   - Clé gardée par le porteur en lieu sûr (gestionnaire de mots de passe) ; clé perdue = copies perdues.
   - Copies gardées **3 mois** dans la boîte (les plus anciennes supprimées par le porteur ou par un filtre).
   - Taille à vérifier pendant la répétition (limite de taille des pièces jointes de Brevo et de Gmail) ; si la base dépasse, découper ou compresser.
   - Restauration essayée pendant la répétition générale.

## Chemin de sortie

Une décision courte note ce qu'un changement d'hébergeur demanderait (lot de quelques jours) : la base est du SQLite standard (export en un fichier) ; le socle ne dépend pas de Cloudflare ; à refaire : l'accès à la base (D1), les tâches planifiées, la base des photos, les secrets et le déploiement. Hébergeurs français possibles : OVH, Scaleway, Clever Cloud.

## Contraintes

- Règles de `CLAUDE.md` ; la charte `.claude/skills/charte-gyro/SKILL.md` pour la page « Vos données ».
- Offre gratuite Cloudflare (10 ms de calcul par requête) : rien de nouveau sur les pages ordinaires.
- Chaque changement de code ou de doc passe par une PR validée par le porteur.

## Laissé au constructeur

Le détail des PR (corrections de la doc après la répétition, tâche de sauvegarde, page « Vos données », région européenne), l'outil de conversion des fichiers (script local hors dépôt ou outil commité qui ne contient aucune donnée), le format de chiffrement.

## Choix de Claude, à vérifier par le porteur

- Centre jetable `repetition` sur le compte de Laillé, supprimé ensuite.
- Téléphone et contact d'urgence facultatifs, remplis par l'agent.
- Pas de reprise de l'historique de Slack ni du MVP.
- Page « Vos données dans Gyro Caserne » dans l'appli.
- Vrais fichiers reçus avant la répétition générale.
- Compte Brevo à part pour la production.
