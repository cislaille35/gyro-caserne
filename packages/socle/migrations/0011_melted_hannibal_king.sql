CREATE TABLE `avis_reservation` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`personne_id` integer NOT NULL,
	`reservation_id` integer NOT NULL,
	`quoi` text NOT NULL,
	`cree_le` text NOT NULL,
	`lue_le` text,
	FOREIGN KEY (`personne_id`) REFERENCES `personne`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reservation_id`) REFERENCES `reservation`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "avis_reservation_quoi" CHECK("quoi" IN ('acceptee', 'refusee', 'annulee'))
);
--> statement-breakpoint
CREATE INDEX `avis_reservation_personne` ON `avis_reservation` (`personne_id`,`lue_le`);--> statement-breakpoint
CREATE TABLE `reservation` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ressource_id` integer NOT NULL,
	`personne_id` integer NOT NULL,
	`nom_demandeur` text,
	`telephone` text,
	`debut` text NOT NULL,
	`fin` text NOT NULL,
	`quantite` integer DEFAULT 1 NOT NULL,
	`mot` text,
	`etat` text NOT NULL,
	`cree_le` text NOT NULL,
	`tranchee_par` text,
	`tranchee_le` text,
	`motif` text,
	FOREIGN KEY (`ressource_id`) REFERENCES `ressource`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`personne_id`) REFERENCES `personne`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "reservation_etat" CHECK("etat" IN ('attente', 'acceptee', 'refusee', 'annulee'))
);
--> statement-breakpoint
CREATE INDEX `reservation_ressource` ON `reservation` (`ressource_id`,`etat`,`debut`);--> statement-breakpoint
CREATE INDEX `reservation_personne` ON `reservation` (`personne_id`);--> statement-breakpoint
CREATE TABLE `ressource` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nom` text NOT NULL,
	`forme` text NOT NULL,
	`stock` integer,
	`icone` text NOT NULL,
	`ouverte_reserve` integer DEFAULT 0 NOT NULL,
	`geree_par_responsabilite_id` integer,
	`geree_par_comite_id` integer,
	`retiree_le` text,
	`cree_le` text NOT NULL,
	FOREIGN KEY (`geree_par_responsabilite_id`) REFERENCES `responsabilite`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`geree_par_comite_id`) REFERENCES `comite`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "ressource_forme" CHECK("forme" IN ('jours', 'creneau')),
	CONSTRAINT "ressource_ouverte_reserve" CHECK("ouverte_reserve" IN (0, 1)),
	CONSTRAINT "ressource_gestionnaire" CHECK(("geree_par_responsabilite_id" IS NULL) <> ("geree_par_comite_id" IS NULL)),
	CONSTRAINT "ressource_stock" CHECK(("forme" = 'jours') = ("stock" IS NOT NULL))
);
--> statement-breakpoint
-- Ajouté à la main, pour les bases déjà remplies par le jeu de départ (une base vide les recevra du jeu de départ) :
-- la VL, gérée par le référent engins, et le droit de réserver pour les profils Agent et Réserve citoyenne.
INSERT INTO `ressource` (`nom`, `forme`, `stock`, `icone`, `ouverte_reserve`, `geree_par_responsabilite_id`, `cree_le`)
SELECT 'VL', 'creneau', NULL, 'camion', 1, r.`id`, strftime('%Y-%m-%dT%H:%M', 'now')
FROM `responsabilite` r
WHERE r.`nom` = 'Référent engins'
	AND EXISTS (SELECT 1 FROM `profil`)
	AND NOT EXISTS (SELECT 1 FROM `ressource` WHERE `forme` = 'creneau');
--> statement-breakpoint
INSERT INTO `profil_droit` (`profil_id`, `droit`, `perimetre_type`, `perimetre_id`)
SELECT p.`id`, 'RESERVER', 'centre', NULL
FROM `profil` p
WHERE p.`nom` IN ('Agent', 'Réserve citoyenne')
	AND NOT EXISTS (SELECT 1 FROM `profil_droit` x WHERE x.`profil_id` = p.`id` AND x.`droit` = 'RESERVER' AND x.`perimetre_type` = 'centre');
