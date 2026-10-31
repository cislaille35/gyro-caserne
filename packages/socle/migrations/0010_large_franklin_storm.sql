CREATE TABLE `abonnement_push` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`personne_id` integer NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`appareil` text DEFAULT '' NOT NULL,
	`cree_le` text NOT NULL,
	FOREIGN KEY (`personne_id`) REFERENCES `personne`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `abonnement_push_endpoint_unique` ON `abonnement_push` (`endpoint`);--> statement-breakpoint
CREATE INDEX `abonnement_push_personne` ON `abonnement_push` (`personne_id`);--> statement-breakpoint
CREATE TABLE `coupure` (
	`personne_id` integer NOT NULL,
	`lieu` text NOT NULL,
	PRIMARY KEY(`personne_id`, `lieu`),
	FOREIGN KEY (`personne_id`) REFERENCES `personne`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `envoi_push` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`abonnement_id` integer NOT NULL,
	`donnees` text NOT NULL,
	`cree_le` text NOT NULL,
	FOREIGN KEY (`abonnement_id`) REFERENCES `abonnement_push`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `notification` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`personne_id` integer NOT NULL,
	`publication_id` integer NOT NULL,
	`commentaire_id` integer,
	`cree_le` text NOT NULL,
	`lue_le` text,
	FOREIGN KEY (`personne_id`) REFERENCES `personne`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`publication_id`) REFERENCES `publication`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`commentaire_id`) REFERENCES `commentaire`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `notification_personne` ON `notification` (`personne_id`,`lue_le`);--> statement-breakpoint
CREATE INDEX `notification_publication` ON `notification` (`publication_id`);