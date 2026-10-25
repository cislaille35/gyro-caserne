CREATE TABLE `personne` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`prenom` text NOT NULL,
	`nom` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `personne_email_unique` ON `personne` (`email`);