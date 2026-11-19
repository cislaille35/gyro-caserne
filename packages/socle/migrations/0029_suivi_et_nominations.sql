CREATE TABLE `avis_nomination` (
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
CREATE INDEX `avis_nomination_personne` ON `avis_nomination` (`personne_id`,`lue_le`);--> statement-breakpoint
ALTER TABLE `personne` ADD `suivi_vu` integer;