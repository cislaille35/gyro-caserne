CREATE TABLE `conversation` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`nom` text,
	`icone` text,
	`cle_paire` text,
	`cree_par` integer NOT NULL,
	`cree_le` text NOT NULL,
	`dernier_le` text NOT NULL,
	CONSTRAINT "conversation_type" CHECK("type" IN ('deux', 'groupe'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `conversation_cle_paire_unique` ON `conversation` (`cle_paire`);--> statement-breakpoint
CREATE TABLE `membre_conversation` (
	`conversation_id` integer NOT NULL,
	`personne_id` integer NOT NULL,
	`animateur` integer DEFAULT 0 NOT NULL,
	`entre_le` text NOT NULL,
	`lu_jusqu_a` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`conversation_id`, `personne_id`),
	FOREIGN KEY (`conversation_id`) REFERENCES `conversation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`personne_id`) REFERENCES `personne`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "membre_conversation_animateur" CHECK("animateur" IN (0, 1))
);
--> statement-breakpoint
CREATE INDEX `membre_conversation_personne` ON `membre_conversation` (`personne_id`);--> statement-breakpoint
CREATE TABLE `message` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`conversation_id` integer NOT NULL,
	`auteur` integer,
	`texte` text NOT NULL,
	`reponse_a` integer,
	`systeme` text,
	`cree_le` text NOT NULL,
	`maj_le` text NOT NULL,
	`modifie` integer DEFAULT 0 NOT NULL,
	`supprime` text,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`auteur`) REFERENCES `personne`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "message_modifie" CHECK("modifie" IN (0, 1)),
	CONSTRAINT "message_supprime" CHECK("supprime" IS NULL OR "supprime" IN ('auteur', 'moderation'))
);
--> statement-breakpoint
CREATE INDEX `message_conversation` ON `message` (`conversation_id`,`id`);--> statement-breakpoint
CREATE INDEX `message_conversation_maj` ON `message` (`conversation_id`,`maj_le`);--> statement-breakpoint
ALTER TABLE `personne` ADD `coches_lecture` integer DEFAULT 1 NOT NULL;