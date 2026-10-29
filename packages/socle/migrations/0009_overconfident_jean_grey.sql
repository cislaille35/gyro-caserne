CREATE TABLE `signalement_message` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`message_id` integer,
	`par` integer NOT NULL,
	`le` text NOT NULL,
	`auteur` integer NOT NULL,
	`envoye_le` text NOT NULL,
	`texte_copie` text NOT NULL,
	`photos_copie` text DEFAULT '[]' NOT NULL,
	`classe_le` text,
	FOREIGN KEY (`message_id`) REFERENCES `message`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`par`) REFERENCES `personne`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`auteur`) REFERENCES `personne`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `signalement_message_par` ON `signalement_message` (`message_id`,`par`);--> statement-breakpoint
CREATE INDEX `signalement_message_classe` ON `signalement_message` (`classe_le`);--> statement-breakpoint
ALTER TABLE `message` ADD `lu_le` text;