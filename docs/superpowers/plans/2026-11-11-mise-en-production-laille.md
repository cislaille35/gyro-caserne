# Mise en production de Laillé : plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** installer Gyro Caserne pour le CIS de Laillé avec les vraies données, sur une doc vérifiée, puis démarrer équipe par équipe.

**Architecture :** quatre lots livrés par PR (deux de code, un de répétition qui corrige la doc, un de préparation des fichiers), puis l'installation et le démarrage, qui sont des opérations et non du code. Chaque lot de code a son propre plan détaillé, écrit par son sous-agent au début du lot (règle « plan court » de `CLAUDE.md`).

**Tech Stack :** SvelteKit 3, Cloudflare Workers et D1, drizzle, Brevo, GitHub Actions.

**Spec :** `docs/superpowers/specs/2026-11-11-mise-en-production-laille-design.md` (validée le 11/11/2026).

## Global Constraints

- Aucune donnée réelle dans le dépôt, une PR, une capture ou un journal de CI (dépôt public).
- Fichiers réels : machine de développement seulement, dossier `/home/maxvm/donnees-laille/` (droits `700`, hors de tout dépôt), effacés après import et vérification.
- Offre gratuite Cloudflare : rien de plus sur les pages ordinaires (`budget.test.ts`, tests `*-calcul.test.ts`).
- Toute migration qui supprime ou transforme des données : accord explicite du porteur.
- Interface : la charte `.claude/skills/charte-gyro/SKILL.md`.
- Chaque PR validée par le porteur avant fusion ; production seulement par tag, après son accord.

## Review Focus

- Un agent parti puis revenu avant 12 mois : il ne doit pas être effacé (le départ se compte à partir du dernier départ).
- Un agent effacé qui avait des demandes de remplacement ou d'habillement en cours : rien ne casse, son nom devient « Ancien agent ».
- La copie hebdomadaire plus grosse que la limite des pièces jointes : le passage échoue avec un message clair, sans envoyer de donnée en clair.
- Un fichier réel avec un agent sans adresse, ou une adresse en double : l'aperçu d'import le signale, rien n'est écrit.
- Un déploiement de production lancé par erreur sur un mauvais tag : le contrôle après déploiement le révèle, et le point de retour permet de revenir.

---

### Lot 1 : agents partis et effacement (code, PR)

**Comportement (spec, « Agents partis et effacement ») :**
- **Effacement automatique :** la tâche de nuit efface les données personnelles d'un agent parti depuis 12 mois. L'agent devient « Ancien agent » dans l'historique, sans casser les liens.
- **Effacement sur demande :** le chef efface un agent sur demande, avec confirmation (bouton grave sous « Plus », charte).
- **Documentation :** la page fonctionnelle et la doc technique.

- [ ] Plan détaillé du lot (sous-agent) : tables qui citent une personne, champs effacés, migration éventuelle (à faire valider si elle transforme des données).
- [ ] Tests d'abord : effacement à 12 mois et pas avant ; agent revenu ; demandes en cours ; publications et prises de garde gardées sous « Ancien agent » ; effacement sur demande réservé au chef.
- [ ] Code, review au premier plan (modèle le plus capable : données), CI complète, PR validée par le porteur.

### Lot 2 : copie hebdomadaire chiffrée par e-mail (code, PR)

**Comportement (spec, « Sauvegarde ») :**
- **Export chiffré :** chaque semaine, export de la base principale de production, chiffré avec la clé publique du porteur.
- **Envoi :** la copie est envoyée par Brevo à `cislaille35@gmail.com`.
- **Discrétion :** aucune donnée en clair dans un journal, et rien dans GitHub (pas d'artefact).

- [ ] Plan détaillé (sous-agent) : où tourne la tâche (GitHub Actions avec le jeton déjà en place, ou tâche de nuit), outil de chiffrement (une clé publique dans un secret, la clé privée chez le porteur seul), taille et limites des pièces jointes.
- [ ] Mode d'emploi pour le porteur : créer sa paire de clés, garder la clé privée en lieu sûr, déchiffrer et restaurer une copie.
- [ ] Tests ou essai réel sur la préprod (données fictives), review, CI, PR validée.

### Lot 3 : fichiers réels (préparation, hors dépôt)

- [ ] Recevoir du porteur :
  - les plannings 2025 et 2026 ;
  - l'été passé ;
  - le fichier e-mail + grade.

  Les ranger dans `/home/maxvm/donnees-laille/` (`chmod 700`).
- [ ] Lire leur structure. Discuter avec le porteur de l'extraction des manœuvres et de leurs thèmes.
- [ ] Construire le fichier de l'effectif et le fichier du planning au format d'import de l'appli :
  - tout le monde entré en 2025 ;
  - grades du fichier du porteur ;
  - liste de ce qui manque, à compléter ensemble.
- [ ] Fabriquer les **copies fictives de même forme** pour la répétition. Elles peuvent aller dans le dépôt si elles ne contiennent rien de réel ; sinon, dans le scratchpad.
- [ ] Si un outil de conversion est utile pour d'autres centres : le commiter **sans aucune donnée**, par une PR. Sinon, script local hors dépôt.

### Lot 4 : répétition générale (opération, puis PR de corrections)

- [x] Centre `repetition` sur le compte de Laillé, en suivant `docs/technique/installer-un-centre.md` **à la lettre**, avec un journal de chaque écart.
- [x] Bases en Europe (région ou juridiction D1 : doc Cloudflare, puis ajout à l'installation).
- [x] Secrets de test, import des copies fictives (lot 3), vérification des engins.
- [x] Essai de la copie hebdomadaire (lot 2) et d'une **restauration** complète. Essai du retour en arrière (Time Travel).
- [x] Essai du contrôle après déploiement et d'un tag (sur le centre de répétition ou la préprod, selon le workflow).
- [x] Suppression du centre `repetition` : Worker, bases, dossier, secrets.
- [x] PR « Doc d'installation corrigée » : chaque coquille, la région européenne, la page « Vos données dans Gyro Caserne » (fonctionnelle, dans l'appli, lien depuis Moi et la connexion), les points de vigilance de la production, et une décision courte « Chemin de sortie » (changement d'hébergeur, spec).

### Étape 5 : installation de Laillé (opération, avec le porteur)

- [ ] Bases de production en Europe, `database_id` dans `centres/laille/wrangler.jsonc` (PR).
- [ ] Le porteur crée le compte Brevo de production et la clé de la vigilance. Secrets neufs, variable `CENTRE_PRODUCTION = laille`, secrets `VAPID_*_PRODUCTION`.
- [ ] Point de retour D1 noté, puis premier tag `vX.Y.Z`, avec l'accord du porteur. Contrôle après déploiement au vert.
- [ ] Import de l'effectif puis du planning 2026 par le porteur, dans le navigateur. Vérification des engins.
- [ ] Effacement des fichiers réels de la machine.

### Étape 6 : démarrage équipe par équipe

- [ ] Lien et mode d'emploi à la première équipe ; lecture quotidienne du relevé.
- [ ] Équipes suivantes. 2027 préparée dans l'appli (« Préparer l'année ») à partir de 2025 et 2026.
- [ ] Bilan avec le porteur ; décision de suite (nom de domaine à soi, autres centres).

**Ordre :** lots 1 et 2 en parallèle (fichiers distincts), lot 3 dès réception des fichiers, puis lot 4, puis étapes 5 et 6.
