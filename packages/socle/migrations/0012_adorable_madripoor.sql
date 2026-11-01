CREATE TABLE `annee_planning` (
	`annee` integer PRIMARY KEY NOT NULL,
	`ordre` text DEFAULT '[]' NOT NULL,
	`publiee_le` text
);
--> statement-breakpoint
CREATE TABLE `cle_agenda` (
	`personne_id` integer PRIMARY KEY NOT NULL,
	`cle` text NOT NULL,
	`cree_le` text NOT NULL,
	FOREIGN KEY (`personne_id`) REFERENCES `personne`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `garde_fete` (
	`annee` integer NOT NULL,
	`fete` text NOT NULL,
	`equipe_id` integer NOT NULL,
	PRIMARY KEY(`annee`, `fete`),
	FOREIGN KEY (`equipe_id`) REFERENCES `equipe`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "garde_fete_fete" CHECK("fete" IN ('noel', 'nouvel_an'))
);
--> statement-breakpoint
CREATE TABLE `manoeuvre` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`debut` text NOT NULL,
	`theme` text NOT NULL,
	`lieu` text NOT NULL,
	`convoques` text NOT NULL,
	`petit_dejeuner` integer DEFAULT 0 NOT NULL,
	`annulee_le` text,
	`publication_id` integer,
	`relance_le` text,
	`annoncee_le` text,
	FOREIGN KEY (`publication_id`) REFERENCES `publication`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "manoeuvre_petit_dejeuner" CHECK("petit_dejeuner" IN (0, 1))
);
--> statement-breakpoint
CREATE INDEX `manoeuvre_debut` ON `manoeuvre` (`debut`);--> statement-breakpoint
CREATE TABLE `semaine_changee` (
	`debut` text PRIMARY KEY NOT NULL,
	`equipe_id` integer NOT NULL,
	FOREIGN KEY (`equipe_id`) REFERENCES `equipe`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `vacances_scolaires` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nom` text NOT NULL,
	`debut` text NOT NULL,
	`fin` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `publication` ADD `annulee_le` text;