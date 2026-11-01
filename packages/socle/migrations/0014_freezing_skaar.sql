CREATE TABLE `avis_ete` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`personne_id` integer NOT NULL,
	`quoi` text NOT NULL,
	`texte` text NOT NULL,
	`url` text NOT NULL,
	`cree_le` text NOT NULL,
	`lue_le` text,
	FOREIGN KEY (`personne_id`) REFERENCES `personne`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "avis_ete_quoi" CHECK("quoi" IN ('rappel', 'repartition', 'vacances_changees'))
);
--> statement-breakpoint
CREATE INDEX `avis_ete_personne` ON `avis_ete` (`personne_id`,`lue_le`);--> statement-breakpoint
CREATE TABLE `ete` (
	`annee` integer PRIMARY KEY NOT NULL,
	`debut` text NOT NULL,
	`fin` text NOT NULL,
	`date_limite` text NOT NULL,
	`publiee_le` text,
	`rappel_mois_le` text,
	`rappel_semaine_le` text
);
--> statement-breakpoint
CREATE TABLE `plage_ete` (
	`debut` text PRIMARY KEY NOT NULL,
	`fin` text NOT NULL,
	`annee` integer NOT NULL,
	`ajoutes` text DEFAULT '[]' NOT NULL,
	`retires` text DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `plage_ete_annee` ON `plage_ete` (`annee`);--> statement-breakpoint
CREATE TABLE `reglage_armement` (
	`id` integer PRIMARY KEY NOT NULL,
	`valeur` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reponse_ete` (
	`annee` integer NOT NULL,
	`personne_id` integer NOT NULL,
	`tout_ete` integer DEFAULT 0 NOT NULL,
	`modifiee_le` text NOT NULL,
	PRIMARY KEY(`annee`, `personne_id`),
	FOREIGN KEY (`personne_id`) REFERENCES `personne`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "reponse_ete_tout_ete" CHECK("tout_ete" IN (0, 1))
);
--> statement-breakpoint
CREATE TABLE `vacances_agent` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`personne_id` integer NOT NULL,
	`annee` integer NOT NULL,
	`debut` text NOT NULL,
	`fin` text NOT NULL,
	FOREIGN KEY (`personne_id`) REFERENCES `personne`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `vacances_agent_annee` ON `vacances_agent` (`annee`,`personne_id`);--> statement-breakpoint
-- Ajouté à la main (accordé par le porteur) : le rôle « Chef d’équipe » devient « Chef de garde ». Seul le libellé change,
-- l'identifiant interne reste `chef_equipe` ; un nom déjà changé par le centre est gardé.
UPDATE `responsabilite` SET `nom` = 'Chef de garde' WHERE `systeme` = 'chef_equipe' AND `nom` = 'Chef d’équipe';
