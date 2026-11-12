# Agents partis et effacement : plan du lot 1

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Étapes en cases à cocher.

**Goal :** effacer les données personnelles d'un agent parti 12 mois après son dernier départ (tâche de nuit), ou sur demande du chef ; son nom devient « Ancien agent » dans l'historique, sans casser les liens.

**Spec :** `docs/superpowers/specs/2026-11-11-mise-en-production-laille-design.md`, « Agents partis et effacement ». Plan général : `2026-11-11-mise-en-production-laille.md`, lot 1.

## Comment on sait qu'un agent est parti, et depuis quand

- Parti : `personne.statut = 'parti'` (déjà là, posé par `changerStatut`, y compris depuis l'import).
- Depuis quand : nouvelle colonne **`personne.parti_le`** (date), posée par `changerStatut` au passage à « Parti », remise à vide au retour. Un nouveau départ la repose : le délai part toujours du **dernier** départ. Le journal (`changer_statut`) le dit aussi, mais le lire chaque nuit coûterait un parcours de toute la table.
- Effacé : nouvelle colonne **`personne.efface_le`** (date). Un agent effacé ne revient plus (`changerStatut`, `modifierFiche` refusent) ; s'il revient au centre, on lui refait une fiche.
- **Migration `0025`, purement additive** : deux `ALTER TABLE personne ADD` sans valeur, et un index `journal(cible_type, cible_id)` (ajouté après la review). Aucune ligne n'est touchée. Conséquence : un agent parti avant cette version n'a pas de date, et la nuit ne l'efface pas ; le chef peut l'effacer sur demande. La production part d'une base vide : elle n'est pas concernée.

## Qui efface

- **Nuit** (`CRON_NUIT`) : `effacerAgentsPartis(base, photos, limite)`, limite = `limiteDeConservation(quand, 12)` ; efface quand `parti_le <= limite`. Borne : **10 agents par nuit** (le reste la nuit suivante), une requête de lecture puis deux par agent.
- **Sur demande** : `effacerAgent(base, photos, acteur, id, maintenant, adressesReservees)`. Droit : **`GERER_ACCES` sur le centre** (le chef de centre et son adjoint, le super administrateur), le même qui fait revenir un agent parti. Refusé : sur soi-même, sur une adresse de super administrateur, sur un agent qui n'est pas parti (déclarer le départ d'abord, qui fait déjà le ménage du départ), sur un agent déjà effacé.
- Écran : fiche de l'agent parti, bloc « Départ du centre », sous « Plus » : « Effacer ses données », dépliage qui dit ce qui sera perdu, « Je confirme », bouton `grave`.

## Tables qui citent une personne

| Table, colonnes | Sort |
|---|---|
| `personne` : `email` | **anonymisée** : `efface-<id>@efface.invalid` (unique, ne reçoit rien) |
| `personne` : `prenom`, `nom` | **anonymisés** : « Ancien », « agent » |
| `personne` : `surnom`, `photo`, `telephone`, `naissance`, `contact_urgence`, `entree_centre`, `engagement_spv`, `grade_id`, `date_grade` | **effacés** (vides) ; `telephone_visible`, `anniversaire_visible` à 0 |
| `personne` : `profil_id`, `statut` (« parti »), `cree_le` | gardés |
| `user` (+ `session`, `account` en cascade), `verification`, `envoi_lien` | **effacés** (par l'adresse) |
| `valeur_champ`, `aptitude_agent`, `cle_agenda`, `visite_mur` | **effacés** |
| `abonnement_push` (+ `envoi_push` en cascade), `coupure`, `notification`, `avis_reservation`, `avis_remplacement`, `avis_ete`, `avis_anomalie`, `avis_habillement` | **effacés** (déjà au départ ; refait) |
| `journal` : `details.email` des lignes qui le visent (`ajouter_personne`, `modifier_fiche`) | **effacé** ; `acteur`, `cible_id` gardés |
| `affectation_equipe`, `attribution` (dont `saisie_par`) | gardés : équipes et rôles passés (planning passé, équité) |
| `publication.auteur`, `commentaire.auteur`, `jaime`, `reponse_evenement`, `vote_sondage`, `prise_connaissance`, `fiche_version.auteur` | gardés, sous « Ancien agent » (publications : 24 mois, décision 0023) |
| `conversation.cree_par`, `membre_conversation`, `message.auteur`, `reaction_message`, `signalement_message.par/auteur` | gardés, sous « Ancien agent » (messages : 12 mois) |
| `reservation.personne_id` ; `avis_reservation` | gardée (12 mois après la fin) ; avis effacés |
| `demande_remplacement.demandeur_id/cible_id/remplacant_id`, `destinataire_remplacement` | gardés (les demandes ouvertes sont déjà closes au départ) |
| `reponse_ete`, `vacances_agent`, `plage_ete` (JSON) | gardés : l'équité de l'été compte les années passées |
| `prise_garde.commencee_par/modifiee_par`, `saisie` (JSON), `anomalie.signalee_par/close_par/prise_en_charge_par`, `anomalie_suivi.par` | gardés, sous « Ancien agent » |
| `demande_habillement.demandeur_id/prise_par`, `fil_habillement.par` | gardés, sous « Ancien agent » (24 mois après la fin) ; une demande en cours reste traitable par le référent |
| PHOTOS | aucune photo n'est à lui seul : celles des publications, messages, anomalies et prises restent avec elles ; `personne.photo` n'est jamais remplie. Le ménage de nuit (#62) reste le filet. |

Champs personnels effacés : nom, prénom, adresse, téléphone, contact d'urgence, date de naissance, surnom, photo, grade et dates (entrée, engagement, grade), champs du centre, aptitudes, compte de connexion, appareils et notifications.
Gardé pour l'historique : l'identifiant (les liens), le profil, le statut « Parti », les dates de départ et d'effacement, les équipes et rôles passés, et ses traces dans les publications, messages, demandes, prises de garde, anomalies, habillement, été.

Ailleurs : un agent effacé sort de la liste des agents (gestion, export, import) ; sa fiche reste ouverte (« Ancien agent ») pour ne casser aucun lien.

## Tâches

- [ ] Migration 0025 (drizzle-kit), schéma.
- [ ] Tests d'abord (`test/agents-partis.test.ts`) : 12 mois oui, 11 mois 29 jours non ; revenu jamais ; dernier départ ; borne de nuit ; ce qui est effacé et gardé ; lectures (remplacements, habillement, publications, prises, anomalies) sous « Ancien agent » ; droit, soi-même, super administrateur, pas parti, déjà effacé ; retour et fiche refusés.
- [ ] Code : `partis.ts` (socle), `changerStatut`, `modifierFiche`, effectif, export et import, `planifie.ts`.
- [ ] Écran : action `effacer` de la fiche, test du serveur, captures (téléphone clair, ordinateur sombre).
- [ ] Doc : `fonctionnel/donnees-des-agents.md`, `utilisation/effacer-un-agent.md`, `technique/socle.md`, décision 0029.
- [ ] Review (modèle le plus capable), CI complète, PR prête.
