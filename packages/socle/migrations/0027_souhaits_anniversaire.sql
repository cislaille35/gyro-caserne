CREATE TABLE `souhait_anniversaire` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`personne_id` integer NOT NULL,
	`auteur_id` integer NOT NULL,
	`jour` text NOT NULL,
	`cree_le` text NOT NULL,
	`lue_le` text,
	FOREIGN KEY (`personne_id`) REFERENCES `personne`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`auteur_id`) REFERENCES `personne`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `souhait_anniversaire_unique` ON `souhait_anniversaire` (`personne_id`,`jour`,`auteur_id`);