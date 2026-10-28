CREATE TABLE `commentaire` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`publication_id` integer NOT NULL,
	`auteur` text NOT NULL,
	`texte` text NOT NULL,
	`cree_le` text NOT NULL,
	FOREIGN KEY (`publication_id`) REFERENCES `publication`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `commentaire_publication` ON `commentaire` (`publication_id`);--> statement-breakpoint
CREATE TABLE `jaime` (
	`publication_id` integer NOT NULL,
	`personne_id` integer NOT NULL,
	PRIMARY KEY(`publication_id`, `personne_id`),
	FOREIGN KEY (`publication_id`) REFERENCES `publication`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`personne_id`) REFERENCES `personne`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `photo_publication` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`publication_id` integer NOT NULL,
	`ordre` integer NOT NULL,
	`type` text NOT NULL,
	`donnees` blob NOT NULL,
	FOREIGN KEY (`publication_id`) REFERENCES `publication`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "photo_publication_type" CHECK("type" IN ('image/jpeg', 'image/webp'))
);
--> statement-breakpoint
CREATE INDEX `photo_publication_publication` ON `photo_publication` (`publication_id`);--> statement-breakpoint
CREATE TABLE `prise_connaissance` (
	`publication_id` integer NOT NULL,
	`personne_id` integer NOT NULL,
	`le` text NOT NULL,
	PRIMARY KEY(`publication_id`, `personne_id`),
	FOREIGN KEY (`publication_id`) REFERENCES `publication`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`personne_id`) REFERENCES `personne`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `publication` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`mur` text NOT NULL,
	`auteur` text NOT NULL,
	`type` text NOT NULL,
	`texte` text NOT NULL,
	`prise_de_connaissance` integer DEFAULT 0 NOT NULL,
	`epinglee` integer DEFAULT 0 NOT NULL,
	`commentaires_fermes` integer DEFAULT 0 NOT NULL,
	`cree_le` text NOT NULL,
	`modifiee_le` text,
	`debut` text,
	`lieu` text,
	`convoques` text,
	`sondage_question` text,
	`sondage_reponses` text,
	CONSTRAINT "publication_type" CHECK("type" IN ('message', 'annonce', 'evenement', 'bravo')),
	CONSTRAINT "publication_prise_de_connaissance" CHECK("prise_de_connaissance" IN (0, 1)),
	CONSTRAINT "publication_epinglee" CHECK("epinglee" IN (0, 1)),
	CONSTRAINT "publication_commentaires_fermes" CHECK("commentaires_fermes" IN (0, 1))
);
--> statement-breakpoint
CREATE INDEX `publication_mur` ON `publication` (`mur`,`cree_le`);--> statement-breakpoint
CREATE TABLE `reponse_evenement` (
	`publication_id` integer NOT NULL,
	`personne_id` integer NOT NULL,
	`reponse` text NOT NULL,
	PRIMARY KEY(`publication_id`, `personne_id`),
	FOREIGN KEY (`publication_id`) REFERENCES `publication`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`personne_id`) REFERENCES `personne`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "reponse_evenement_reponse" CHECK("reponse" IN ('present', 'absent', 'incertain'))
);
--> statement-breakpoint
CREATE TABLE `visite_mur` (
	`personne_id` integer NOT NULL,
	`mur` text NOT NULL,
	`vue_le` text NOT NULL,
	PRIMARY KEY(`personne_id`, `mur`),
	FOREIGN KEY (`personne_id`) REFERENCES `personne`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `vote_sondage` (
	`publication_id` integer NOT NULL,
	`personne_id` integer NOT NULL,
	`reponse` integer NOT NULL,
	PRIMARY KEY(`publication_id`, `personne_id`),
	FOREIGN KEY (`publication_id`) REFERENCES `publication`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`personne_id`) REFERENCES `personne`(`id`) ON UPDATE no action ON DELETE no action
);
