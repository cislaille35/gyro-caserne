CREATE TABLE `affectation_equipe` (
	`personne_id` integer NOT NULL,
	`equipe_id` integer NOT NULL,
	`debut` text NOT NULL,
	`fin` text,
	FOREIGN KEY (`personne_id`) REFERENCES `personne`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`equipe_id`) REFERENCES `equipe`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `attribution` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`personne_id` integer NOT NULL,
	`responsabilite_id` integer NOT NULL,
	`perimetre_type` text NOT NULL,
	`perimetre_id` integer,
	`debut` text NOT NULL,
	`fin` text,
	`saisie_par` text NOT NULL,
	`saisie_le` text NOT NULL,
	`compte_rendu` text,
	FOREIGN KEY (`personne_id`) REFERENCES `personne`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`responsabilite_id`) REFERENCES `responsabilite`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "attribution_perimetre_type" CHECK("perimetre_type" IN ('centre', 'equipe', 'comite', 'salon', 'ressource')),
	CONSTRAINT "attribution_perimetre_id" CHECK(("perimetre_type" = 'centre') = ("perimetre_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE `champ_centre` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nom` text NOT NULL,
	`visibilite` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `comite` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nom` text NOT NULL,
	`theme` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `equipe` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nom` text NOT NULL,
	`couleur` text NOT NULL,
	`ordre_rotation` integer NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	CONSTRAINT "equipe_active" CHECK("active" IN (0, 1))
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
CREATE TABLE `journal` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`quand` text NOT NULL,
	`acteur` text NOT NULL,
	`action` text NOT NULL,
	`cible_type` text NOT NULL,
	`cible_id` integer,
	`details` text DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `personne` (
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
CREATE UNIQUE INDEX `personne_email_unique` ON `personne` (`email`);--> statement-breakpoint
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
CREATE TABLE `responsabilite` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nom` text NOT NULL,
	`nature` text NOT NULL,
	`type_perimetre` text NOT NULL,
	`comite_attributeur_id` integer,
	`systeme` text,
	FOREIGN KEY (`comite_attributeur_id`) REFERENCES `comite`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "responsabilite_nature" CHECK("nature" IN ('fonction', 'mission')),
	CONSTRAINT "responsabilite_type_perimetre" CHECK("type_perimetre" IN ('centre', 'equipe', 'comite', 'salon', 'ressource')),
	CONSTRAINT "responsabilite_systeme" CHECK("systeme" IS NULL OR "systeme" IN ('chef_centre', 'chef_equipe'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `responsabilite_systeme_unique` ON `responsabilite` (`systeme`);--> statement-breakpoint
CREATE TABLE `responsabilite_droit` (
	`responsabilite_id` integer NOT NULL,
	`droit` text NOT NULL,
	`verrouille` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`responsabilite_id`, `droit`),
	FOREIGN KEY (`responsabilite_id`) REFERENCES `responsabilite`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "responsabilite_droit_droit" CHECK("droit" IN ('VOIR_PLANNING', 'VOIR_ANNUAIRE', 'VOIR_ENGINS', 'VOIR_ANOMALIES', 'SIGNALER_ANOMALIE', 'SIGNALER_BESOIN_STOCK', 'DEMANDER_REMPLACEMENT', 'DECLARER_DISPONIBILITE', 'UTILISER_MESSAGERIE', 'FAIRE_PRISE_DE_GARDE', 'PRENDRE_EN_CHARGE_ANOMALIE', 'TRAITER_ANOMALIE', 'GERER_FICHES', 'GERER_STOCK', 'GERER_PLANNING', 'VALIDER_REMPLACEMENT', 'VOIR_MOTIFS_ABSENCE', 'LIRE_SALON', 'PUBLIER_SALON', 'MODERER_SALON', 'EPINGLER_SALON', 'RESERVER', 'GERER_RESERVATIONS', 'MODERER_MESSAGERIE', 'GERER_LISTES', 'GERER_ACCES', 'GERER_COMITES', 'ATTRIBUER_RESPONSABILITE')),
	CONSTRAINT "responsabilite_droit_verrouille" CHECK("verrouille" IN (0, 1))
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
CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);