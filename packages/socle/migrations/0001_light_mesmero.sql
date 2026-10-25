CREATE TABLE `affectation_equipe` (
	`personne_id` integer NOT NULL,
	`equipe_id` integer NOT NULL,
	`debut` text NOT NULL,
	`fin` text,
	FOREIGN KEY (`personne_id`) REFERENCES `personne`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`equipe_id`) REFERENCES `equipe`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `champ_centre` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nom` text NOT NULL,
	`visibilite` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `equipe` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nom` text NOT NULL,
	`couleur` text NOT NULL,
	`ordre_rotation` integer NOT NULL,
	`active` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `grade` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`libelle` text NOT NULL,
	`ordre` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `grade_code_unique` ON `grade` (`code`);--> statement-breakpoint
CREATE TABLE `profil` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nom` text NOT NULL,
	`type_personne` text NOT NULL,
	CONSTRAINT "profil_type_personne" CHECK("type_personne" IN ('agent', 'exterieur'))
);
--> statement-breakpoint
CREATE TABLE `profil_droit` (
	`profil_id` integer NOT NULL,
	`droit` text NOT NULL,
	`perimetre_type` text NOT NULL,
	`perimetre_id` integer,
	FOREIGN KEY (`profil_id`) REFERENCES `profil`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "profil_droit_droit" CHECK("droit" IN ('VOIR_PLANNING', 'VOIR_ANNUAIRE', 'VOIR_ENGINS', 'VOIR_ANOMALIES', 'SIGNALER_ANOMALIE', 'SIGNALER_BESOIN_STOCK', 'DEMANDER_REMPLACEMENT', 'DECLARER_DISPONIBILITE', 'UTILISER_MESSAGERIE', 'FAIRE_PRISE_DE_GARDE', 'PRENDRE_EN_CHARGE_ANOMALIE', 'TRAITER_ANOMALIE', 'GERER_FICHES', 'GERER_STOCK', 'GERER_PLANNING', 'VALIDER_REMPLACEMENT', 'VOIR_MOTIFS_ABSENCE', 'LIRE_SALON', 'PUBLIER_SALON', 'MODERER_SALON', 'EPINGLER_SALON', 'RESERVER', 'GERER_RESERVATIONS', 'MODERER_MESSAGERIE', 'GERER_LISTES', 'GERER_ACCES', 'GERER_COMITES', 'ATTRIBUER_RESPONSABILITE')),
	CONSTRAINT "profil_droit_perimetre_type" CHECK("perimetre_type" IN ('centre', 'equipe', 'comite', 'salon', 'ressource')),
	CONSTRAINT "profil_droit_perimetre_id" CHECK(("perimetre_type" = 'centre') = ("perimetre_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE `valeur_champ` (
	`personne_id` integer NOT NULL,
	`champ_id` integer NOT NULL,
	`valeur` text NOT NULL,
	PRIMARY KEY(`personne_id`, `champ_id`),
	FOREIGN KEY (`personne_id`) REFERENCES `personne`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`champ_id`) REFERENCES `champ_centre`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_personne` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`prenom` text NOT NULL,
	`nom` text NOT NULL,
	`surnom` text,
	`photo` text,
	`telephone` text,
	`telephone_visible` integer DEFAULT 0 NOT NULL,
	`naissance` text,
	`anniversaire_visible` integer DEFAULT 1 NOT NULL,
	`entree_centre` text,
	`engagement_spv` text,
	`grade_id` integer,
	`date_grade` text,
	`profil_id` integer,
	`statut` text DEFAULT 'operationnel' NOT NULL,
	`contact_urgence` text,
	`cree_le` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`grade_id`) REFERENCES `grade`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`profil_id`) REFERENCES `profil`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "personne_email_normalise" CHECK("email" = lower(trim("email"))),
	CONSTRAINT "personne_statut" CHECK("statut" IN ('operationnel', 'stagiaire', 'inapte_temporaire', 'suspendu', 'parti')),
	CONSTRAINT "personne_telephone_visible" CHECK("telephone_visible" IN (0, 1)),
	CONSTRAINT "personne_anniversaire_visible" CHECK("anniversaire_visible" IN (0, 1))
);
--> statement-breakpoint
INSERT INTO `__new_personne`("id", "email", "prenom", "nom") SELECT "id", "email", "prenom", "nom" FROM `personne`;--> statement-breakpoint
DROP TABLE `personne`;--> statement-breakpoint
ALTER TABLE `__new_personne` RENAME TO `personne`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `personne_email_unique` ON `personne` (`email`);