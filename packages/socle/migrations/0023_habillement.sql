CREATE TABLE `avis_habillement` (
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
CREATE INDEX `avis_habillement_personne` ON `avis_habillement` (`personne_id`,`lue_le`);--> statement-breakpoint
CREATE TABLE `demande_habillement` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`demandeur_id` integer NOT NULL,
	`texte` text NOT NULL,
	`etape` text DEFAULT 'demandee' NOT NULL,
	`issue` text,
	`prise_par` integer,
	`livraison` text,
	`cree_le` text NOT NULL,
	`maj_le` text NOT NULL,
	`fin_le` text,
	FOREIGN KEY (`demandeur_id`) REFERENCES `personne`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`prise_par`) REFERENCES `personne`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "demande_habillement_etape" CHECK("etape" IN ('demandee', 'prise', 'question', 'traitee', 'livree', 'refusee', 'annulee')),
	CONSTRAINT "demande_habillement_issue" CHECK("issue" IS NULL OR "issue" IN ('stock', 'commande'))
);
--> statement-breakpoint
CREATE INDEX `demande_habillement_demandeur` ON `demande_habillement` (`demandeur_id`);--> statement-breakpoint
CREATE INDEX `demande_habillement_etape` ON `demande_habillement` (`etape`);--> statement-breakpoint
CREATE INDEX `demande_habillement_fin` ON `demande_habillement` (`fin_le`);--> statement-breakpoint
CREATE TABLE `fil_habillement` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`demande_id` integer NOT NULL,
	`quoi` text NOT NULL,
	`texte` text,
	`par` integer NOT NULL,
	`le` text NOT NULL,
	`jeton` text,
	FOREIGN KEY (`demande_id`) REFERENCES `demande_habillement`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`par`) REFERENCES `personne`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "fil_habillement_quoi" CHECK("quoi" IN ('prise', 'reprise', 'question', 'reponse', 'precision', 'stock', 'commande', 'refus', 'livraison', 'annulation'))
);
--> statement-breakpoint
CREATE INDEX `fil_habillement_demande` ON `fil_habillement` (`demande_id`);