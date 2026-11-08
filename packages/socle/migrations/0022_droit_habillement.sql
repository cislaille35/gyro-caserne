-- Le droit GERER_HABILLEMENT entre dans la liste figée par les CHECK : profil_droit et responsabilite_droit sont reconstruites (décision 0025).
-- Écrit à la main à partir de drizzle-kit : sans « PRAGMA foreign_keys » (sans effet dans la transaction de D1 ; aucune table ne pointe vers celles-ci,
-- rien n'est donc violé), et rowid recopié pour que chaque ligne reste la même.
CREATE TABLE `__new_profil_droit` (
	`profil_id` integer NOT NULL,
	`droit` text NOT NULL,
	`perimetre_type` text NOT NULL,
	`perimetre_id` integer,
	FOREIGN KEY (`profil_id`) REFERENCES `profil`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "profil_droit_droit" CHECK("droit" IN ('VOIR_PLANNING', 'VOIR_ANNUAIRE', 'VOIR_ENGINS', 'VOIR_ANOMALIES', 'SIGNALER_ANOMALIE', 'SIGNALER_BESOIN_STOCK', 'DEMANDER_REMPLACEMENT', 'DECLARER_DISPONIBILITE', 'UTILISER_MESSAGERIE', 'FAIRE_PRISE_DE_GARDE', 'PRENDRE_EN_CHARGE_ANOMALIE', 'TRAITER_ANOMALIE', 'GERER_FICHES', 'GERER_STOCK', 'GERER_HABILLEMENT', 'GERER_PLANNING', 'VALIDER_REMPLACEMENT', 'VOIR_MOTIFS_ABSENCE', 'LIRE_SALON', 'PUBLIER_SALON', 'MODERER_SALON', 'EPINGLER_SALON', 'RESERVER', 'GERER_RESERVATIONS', 'MODERER_MESSAGERIE', 'GERER_LISTES', 'GERER_ACCES', 'GERER_COMITES', 'ATTRIBUER_RESPONSABILITE')),
	CONSTRAINT "profil_droit_perimetre_type" CHECK("perimetre_type" IN ('centre', 'equipe', 'comite', 'salon', 'ressource')),
	CONSTRAINT "profil_droit_perimetre_id" CHECK(("perimetre_type" = 'centre') = ("perimetre_id" IS NULL))
);
--> statement-breakpoint
INSERT INTO `__new_profil_droit`("rowid", "profil_id", "droit", "perimetre_type", "perimetre_id") SELECT "rowid", "profil_id", "droit", "perimetre_type", "perimetre_id" FROM `profil_droit`;--> statement-breakpoint
DROP TABLE `profil_droit`;--> statement-breakpoint
ALTER TABLE `__new_profil_droit` RENAME TO `profil_droit`;--> statement-breakpoint
CREATE TABLE `__new_responsabilite_droit` (
	`responsabilite_id` integer NOT NULL,
	`droit` text NOT NULL,
	`verrouille` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`responsabilite_id`, `droit`),
	FOREIGN KEY (`responsabilite_id`) REFERENCES `responsabilite`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "responsabilite_droit_droit" CHECK("droit" IN ('VOIR_PLANNING', 'VOIR_ANNUAIRE', 'VOIR_ENGINS', 'VOIR_ANOMALIES', 'SIGNALER_ANOMALIE', 'SIGNALER_BESOIN_STOCK', 'DEMANDER_REMPLACEMENT', 'DECLARER_DISPONIBILITE', 'UTILISER_MESSAGERIE', 'FAIRE_PRISE_DE_GARDE', 'PRENDRE_EN_CHARGE_ANOMALIE', 'TRAITER_ANOMALIE', 'GERER_FICHES', 'GERER_STOCK', 'GERER_HABILLEMENT', 'GERER_PLANNING', 'VALIDER_REMPLACEMENT', 'VOIR_MOTIFS_ABSENCE', 'LIRE_SALON', 'PUBLIER_SALON', 'MODERER_SALON', 'EPINGLER_SALON', 'RESERVER', 'GERER_RESERVATIONS', 'MODERER_MESSAGERIE', 'GERER_LISTES', 'GERER_ACCES', 'GERER_COMITES', 'ATTRIBUER_RESPONSABILITE')),
	CONSTRAINT "responsabilite_droit_verrouille" CHECK("verrouille" IN (0, 1))
);
--> statement-breakpoint
INSERT INTO `__new_responsabilite_droit`("rowid", "responsabilite_id", "droit", "verrouille") SELECT "rowid", "responsabilite_id", "droit", "verrouille" FROM `responsabilite_droit`;--> statement-breakpoint
DROP TABLE `responsabilite_droit`;--> statement-breakpoint
ALTER TABLE `__new_responsabilite_droit` RENAME TO `responsabilite_droit`;
--> statement-breakpoint
-- Ajouté à la main, pour les bases déjà remplies (une base vide le reçoit du jeu de départ) : le droit, verrouillé, au chef de centre et à l'adjoint.
INSERT INTO `responsabilite_droit` (`responsabilite_id`, `droit`, `verrouille`)
SELECT r.`id`, 'GERER_HABILLEMENT', 1
FROM `responsabilite` r
WHERE r.`systeme` IN ('chef_centre', 'chef_centre_adjoint')
	AND NOT EXISTS (SELECT 1 FROM `responsabilite_droit` x WHERE x.`responsabilite_id` = r.`id` AND x.`droit` = 'GERER_HABILLEMENT');
--> statement-breakpoint
-- Le référent habillement, attribué par le comité du centre, sauf si le centre a déjà un rôle de ce nom.
INSERT INTO `responsabilite` (`nom`, `nature`, `type_perimetre`, `comite_attributeur_id`, `systeme`, `modele`)
SELECT 'Référent habillement', 'mission', 'centre', (SELECT c.`id` FROM `comite` c WHERE c.`theme` = 'centre' AND c.`dissous_le` IS NULL ORDER BY c.`id` LIMIT 1), NULL, 'referent_habillement'
WHERE EXISTS (SELECT 1 FROM `profil`)
	AND NOT EXISTS (SELECT 1 FROM `responsabilite` WHERE `nom` = 'Référent habillement');
--> statement-breakpoint
INSERT INTO `responsabilite_droit` (`responsabilite_id`, `droit`, `verrouille`)
SELECT r.`id`, 'GERER_HABILLEMENT', 0
FROM `responsabilite` r
WHERE r.`modele` = 'referent_habillement'
	AND NOT EXISTS (SELECT 1 FROM `responsabilite_droit` x WHERE x.`responsabilite_id` = r.`id` AND x.`droit` = 'GERER_HABILLEMENT');
