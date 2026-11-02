CREATE TABLE `anomalie` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`engin_id` integer NOT NULL,
	`ref` integer,
	`zone` text NOT NULL,
	`libelle` text NOT NULL,
	`genre` text NOT NULL,
	`manque` integer,
	`note` text,
	`photo_id` integer,
	`prise_id` integer,
	`signalee_par` integer NOT NULL,
	`signalee_le` text NOT NULL,
	`close_par` integer,
	`close_le` text,
	`close_prise_id` integer,
	FOREIGN KEY (`engin_id`) REFERENCES `engin`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`prise_id`) REFERENCES `prise_garde`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`signalee_par`) REFERENCES `personne`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`close_par`) REFERENCES `personne`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`close_prise_id`) REFERENCES `prise_garde`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "anomalie_genre" CHECK("genre" IN ('manquant', 'abime', 'a_remplacer')),
	CONSTRAINT "anomalie_manque" CHECK("manque" IS NULL OR "manque" >= 1)
);
--> statement-breakpoint
CREATE INDEX `anomalie_engin` ON `anomalie` (`engin_id`,`close_le`);--> statement-breakpoint
CREATE TABLE `prise_garde` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`engin_id` integer NOT NULL,
	`releve` text NOT NULL,
	`version_id` integer NOT NULL,
	`equipe_id` integer,
	`etat` text DEFAULT 'en_cours' NOT NULL,
	`saisie` text DEFAULT '{}' NOT NULL,
	`compteur` integer DEFAULT 0 NOT NULL,
	`commencee_par` integer NOT NULL,
	`commencee_le` text NOT NULL,
	`modifiee_par` integer NOT NULL,
	`modifiee_le` text NOT NULL,
	`validee_le` text,
	FOREIGN KEY (`engin_id`) REFERENCES `engin`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`version_id`) REFERENCES `fiche_version`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`equipe_id`) REFERENCES `equipe`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`commencee_par`) REFERENCES `personne`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`modifiee_par`) REFERENCES `personne`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "prise_garde_etat" CHECK("etat" IN ('en_cours', 'validee')),
	CONSTRAINT "prise_garde_validee" CHECK(("etat" = 'validee') = ("validee_le" IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `prise_garde_engin_releve` ON `prise_garde` (`engin_id`,`releve`);--> statement-breakpoint
-- Ajouté à la main, pour les bases déjà remplies (une base vide le reçoit du jeu de départ) : la prise de garde pour le profil Agent.
INSERT INTO `profil_droit` (`profil_id`, `droit`, `perimetre_type`, `perimetre_id`)
SELECT p.`id`, 'FAIRE_PRISE_DE_GARDE', 'centre', NULL FROM `profil` p
WHERE p.`nom` = 'Agent' AND NOT EXISTS (SELECT 1 FROM `profil_droit` d WHERE d.`profil_id` = p.`id` AND d.`droit` = 'FAIRE_PRISE_DE_GARDE');
