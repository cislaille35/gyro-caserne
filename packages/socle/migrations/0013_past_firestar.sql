CREATE TABLE `aptitude` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nom` text NOT NULL,
	`controlee` integer DEFAULT 0 NOT NULL,
	`ordre` integer NOT NULL,
	`retiree_le` text,
	CONSTRAINT "aptitude_controlee" CHECK("controlee" IN (0, 1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `aptitude_nom_unique` ON `aptitude` (`nom`);--> statement-breakpoint
CREATE TABLE `aptitude_agent` (
	`personne_id` integer NOT NULL,
	`aptitude_id` integer NOT NULL,
	`obtenue_le` text NOT NULL,
	`expire_le` text,
	PRIMARY KEY(`personne_id`, `aptitude_id`),
	FOREIGN KEY (`personne_id`) REFERENCES `personne`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`aptitude_id`) REFERENCES `aptitude`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `avis_remplacement` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`personne_id` integer NOT NULL,
	`demande_id` integer NOT NULL,
	`quoi` text NOT NULL,
	`cree_le` text NOT NULL,
	`lue_le` text,
	FOREIGN KEY (`personne_id`) REFERENCES `personne`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`demande_id`) REFERENCES `demande_remplacement`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "avis_remplacement_quoi" CHECK("quoi" IN ('recue', 'acceptee', 'refusee', 'a_valider', 'validee', 'refus_chef', 'desistement', 'expiree', 'annulee', 'relance', 'informe'))
);
--> statement-breakpoint
CREATE INDEX `avis_remplacement_personne` ON `avis_remplacement` (`personne_id`,`lue_le`);--> statement-breakpoint
CREATE TABLE `demande_remplacement` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`genre` text NOT NULL,
	`demandeur_id` integer NOT NULL,
	`cible_id` integer,
	`periodes` text DEFAULT '[]' NOT NULL,
	`periodes_cible` text,
	`manoeuvre_id` integer,
	`manoeuvre_cible_id` integer,
	`equipe_id` integer,
	`debut` text NOT NULL,
	`mot` text,
	`etat` text NOT NULL,
	`remplacant_id` integer,
	`manque` text,
	`cree_le` text NOT NULL,
	`acceptee_le` text,
	`tranchee_par` text,
	`tranchee_le` text,
	`motif` text,
	`relance_le` text,
	FOREIGN KEY (`demandeur_id`) REFERENCES `personne`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cible_id`) REFERENCES `personne`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`manoeuvre_id`) REFERENCES `manoeuvre`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`manoeuvre_cible_id`) REFERENCES `manoeuvre`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`equipe_id`) REFERENCES `equipe`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`remplacant_id`) REFERENCES `personne`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "demande_remplacement_genre" CHECK("genre" IN ('remplacement', 'echange', 'manoeuvre')),
	CONSTRAINT "demande_remplacement_etat" CHECK("etat" IN ('attente', 'a_valider', 'conclue', 'refusee', 'annulee', 'expiree'))
);
--> statement-breakpoint
CREATE INDEX `demande_remplacement_etat` ON `demande_remplacement` (`etat`,`debut`);--> statement-breakpoint
CREATE INDEX `demande_remplacement_demandeur` ON `demande_remplacement` (`demandeur_id`);--> statement-breakpoint
CREATE TABLE `destinataire_remplacement` (
	`demande_id` integer NOT NULL,
	`personne_id` integer NOT NULL,
	`refuse_le` text,
	PRIMARY KEY(`demande_id`, `personne_id`),
	FOREIGN KEY (`demande_id`) REFERENCES `demande_remplacement`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`personne_id`) REFERENCES `personne`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `destinataire_remplacement_personne` ON `destinataire_remplacement` (`personne_id`);--> statement-breakpoint
-- Ajouté à la main, pour les bases déjà remplies par le jeu de départ (une base vide les recevra du jeu de départ) :
-- les aptitudes du modèle métier ; commandement et conduite contrôlées en remplacement.
INSERT INTO `aptitude` (`nom`, `controlee`, `ordre`)
SELECT x.nom, x.controlee, x.ordre FROM (
	SELECT 'CA2' AS nom, 1 AS controlee, 1 AS ordre UNION ALL SELECT 'CA1', 1, 2 UNION ALL SELECT 'CE', 1, 3
	UNION ALL SELECT 'COD1', 1, 4 UNION ALL SELECT 'COD2', 1, 5
	UNION ALL SELECT 'INC', 0, 6 UNION ALL SELECT 'SAP', 0, 7 UNION ALL SELECT 'DIV', 0, 8 UNION ALL SELECT 'FDF1', 0, 9 UNION ALL SELECT 'FDF2', 0, 10
) x
WHERE EXISTS (SELECT 1 FROM `profil`) AND NOT EXISTS (SELECT 1 FROM `aptitude`);
