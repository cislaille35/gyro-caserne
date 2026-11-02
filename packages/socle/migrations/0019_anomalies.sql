CREATE TABLE `anomalie_suivi` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`anomalie_id` integer NOT NULL,
	`quoi` text NOT NULL,
	`texte` text,
	`par` integer NOT NULL,
	`le` text NOT NULL,
	FOREIGN KEY (`anomalie_id`) REFERENCES `anomalie`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`par`) REFERENCES `personne`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "anomalie_suivi_quoi" CHECK("quoi" IN ('prise_en_charge', 'en_attente', 'reparee', 'verifiee', 'close', 'indisponible', 'remise_en_service'))
);
--> statement-breakpoint
CREATE INDEX `anomalie_suivi_anomalie` ON `anomalie_suivi` (`anomalie_id`);--> statement-breakpoint
CREATE TABLE `avis_anomalie` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`personne_id` integer NOT NULL,
	`titre` text NOT NULL,
	`texte` text NOT NULL,
	`url` text NOT NULL,
	`cree_le` text NOT NULL,
	`lue_le` text,
	FOREIGN KEY (`personne_id`) REFERENCES `personne`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `avis_anomalie_personne` ON `avis_anomalie` (`personne_id`,`lue_le`);--> statement-breakpoint
ALTER TABLE `anomalie` ADD `etape` text DEFAULT 'signalee' NOT NULL;--> statement-breakpoint
ALTER TABLE `anomalie` ADD `motif_attente` text;--> statement-breakpoint
ALTER TABLE `anomalie` ADD `prise_en_charge_par` integer REFERENCES personne(id);--> statement-breakpoint
ALTER TABLE `anomalie` ADD `bloquante` integer DEFAULT 0 NOT NULL;