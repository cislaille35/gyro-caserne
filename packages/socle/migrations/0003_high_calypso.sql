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
CREATE TABLE `comite` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nom` text NOT NULL,
	`theme` text NOT NULL
);
--> statement-breakpoint
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
