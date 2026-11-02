CREATE TABLE `engin` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nom` text NOT NULL,
	`immatriculation` text,
	`type_id` integer NOT NULL,
	`situation` text DEFAULT 'centre' NOT NULL,
	`provenance` text,
	`etat` text DEFAULT 'disponible' NOT NULL,
	`parti_le` text,
	`cree_le` text NOT NULL,
	FOREIGN KEY (`type_id`) REFERENCES `type_engin`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "engin_situation" CHECK("situation" IN ('centre', 'prete', 'parti')),
	CONSTRAINT "engin_etat" CHECK("etat" IN ('disponible', 'indisponible')),
	CONSTRAINT "engin_provenance" CHECK("situation" <> 'prete' OR "provenance" IS NOT NULL),
	CONSTRAINT "engin_parti" CHECK(("situation" = 'parti') = ("parti_le" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE `fiche_element` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`version_id` integer NOT NULL,
	`zone_id` integer NOT NULL,
	`ref` integer NOT NULL,
	`libelle` text NOT NULL,
	`quantite` integer,
	`ordre` integer NOT NULL,
	FOREIGN KEY (`version_id`) REFERENCES `fiche_version`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`zone_id`) REFERENCES `fiche_zone`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "fiche_element_quantite" CHECK("quantite" IS NULL OR "quantite" >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fiche_element_version_ref` ON `fiche_element` (`version_id`,`ref`);--> statement-breakpoint
CREATE TABLE `fiche_version` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type_id` integer NOT NULL,
	`numero` integer NOT NULL,
	`auteur` text NOT NULL,
	`cree_le` text NOT NULL,
	`utilisee` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`type_id`) REFERENCES `type_engin`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "fiche_version_utilisee" CHECK("utilisee" IN (0, 1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fiche_version_type_numero` ON `fiche_version` (`type_id`,`numero`);--> statement-breakpoint
CREATE TABLE `fiche_zone` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`version_id` integer NOT NULL,
	`ref` integer NOT NULL,
	`nom` text NOT NULL,
	`ordre` integer NOT NULL,
	FOREIGN KEY (`version_id`) REFERENCES `fiche_version`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fiche_zone_version_ref` ON `fiche_zone` (`version_id`,`ref`);--> statement-breakpoint
CREATE TABLE `type_engin` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nom` text NOT NULL,
	`ordre` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `type_engin_nom_unique` ON `type_engin` (`nom`);--> statement-breakpoint
-- Ajouté à la main, pour les bases déjà remplies par le jeu de départ (une base vide les recevra du jeu de départ) :
-- les types d'engin et leurs fiches de départ (FICHES_PAR_DEFAUT, reprises du MVP), et les droits « Engins : Gérer » du chef de garde.
INSERT INTO `type_engin` (`nom`, `ordre`)
SELECT t.nom, t.ordre FROM (WITH t(nom, ordre) AS (VALUES ('VSAV', 1), ('FPT', 2), ('VTU', 3)) SELECT * FROM t) t
WHERE EXISTS (SELECT 1 FROM `profil`) AND NOT EXISTS (SELECT 1 FROM `type_engin`);
--> statement-breakpoint
INSERT INTO `fiche_version` (`type_id`, `numero`, `auteur`, `cree_le`)
SELECT t.`id`, 1, 'Fiche de départ', strftime('%Y-%m-%dT%H:%M', 'now') FROM `type_engin` t
WHERE NOT EXISTS (SELECT 1 FROM `fiche_version`);
--> statement-breakpoint
INSERT INTO `fiche_zone` (`version_id`, `ref`, `nom`, `ordre`)
SELECT v.`id`, z.ref, z.nom, z.ordre
FROM (WITH z(type, ref, nom, ordre) AS (VALUES
	('VSAV', 1, 'Cabine', 1),
	('VSAV', 2, 'Cellule sanitaire', 2),
	('VSAV', 3, 'Sac de premiers secours', 3),
	('VSAV', 4, 'Sac d’oxygénothérapie', 4),
	('FPT', 5, 'Cabine', 1),
	('FPT', 6, 'Appareils respiratoires', 2),
	('FPT', 7, 'Hydraulique', 3),
	('FPT', 8, 'Coffres', 4),
	('VTU', 9, 'Cabine', 1),
	('VTU', 10, 'Épuisement', 2),
	('VTU', 11, 'Coffres', 3)
) SELECT * FROM z) z
JOIN `type_engin` t ON t.`nom` = z.type
JOIN `fiche_version` v ON v.`type_id` = t.`id` AND v.`numero` = 1
WHERE NOT EXISTS (SELECT 1 FROM `fiche_zone`);
--> statement-breakpoint
INSERT INTO `fiche_element` (`version_id`, `zone_id`, `ref`, `libelle`, `quantite`, `ordre`)
SELECT v.`id`, fz.`id`, e.ref, e.libelle, e.quantite, e.ordre
FROM (WITH e(type, zone, ref, libelle, quantite, ordre) AS (VALUES
	('VSAV', 1, 1, 'Niveau de carburant (au moins 3/4)', NULL, 1),
	('VSAV', 1, 2, 'Radio : essai', NULL, 2),
	('VSAV', 1, 3, 'Terminal / GPS', NULL, 3),
	('VSAV', 1, 4, 'Gyrophares et deux-tons', NULL, 4),
	('VSAV', 1, 5, 'Gilets haute visibilité', 3, 5),
	('VSAV', 1, 6, 'Lampes portatives chargées', 2, 6),
	('VSAV', 1, 7, 'Documents de bord', NULL, 7),
	('VSAV', 2, 8, 'Brancard principal et matelas', NULL, 1),
	('VSAV', 2, 9, 'Chaise portoir', NULL, 2),
	('VSAV', 2, 10, 'Matelas immobilisateur à dépression', NULL, 3),
	('VSAV', 2, 11, 'Plan dur et immobilisateur de tête', NULL, 4),
	('VSAV', 2, 12, 'Colliers cervicaux (jeu)', NULL, 5),
	('VSAV', 2, 13, 'Attelles (lot)', NULL, 6),
	('VSAV', 2, 14, 'Aspirateur de mucosités : essai', NULL, 7),
	('VSAV', 2, 15, 'Bouteille d’oxygène fixe : pression', NULL, 8),
	('VSAV', 2, 16, 'Couvertures', 4, 9),
	('VSAV', 2, 17, 'Draps à usage unique', NULL, 10),
	('VSAV', 2, 18, 'Gants (boîtes)', 3, 11),
	('VSAV', 2, 19, 'Désinfectant et lingettes', NULL, 12),
	('VSAV', 2, 20, 'DSA : voyant vert, électrodes adulte et enfant', NULL, 13),
	('VSAV', 3, 21, 'Tensiomètre', NULL, 1),
	('VSAV', 3, 22, 'Oxymètre de pouls', NULL, 2),
	('VSAV', 3, 23, 'Thermomètre', NULL, 3),
	('VSAV', 3, 24, 'Lecteur de glycémie et bandelettes', NULL, 4),
	('VSAV', 3, 25, 'Pansements compressifs', 4, 5),
	('VSAV', 3, 26, 'Compresses stériles', NULL, 6),
	('VSAV', 3, 27, 'Garrot tourniquet', 2, 7),
	('VSAV', 3, 28, 'Couvertures de survie', 4, 8),
	('VSAV', 3, 29, 'Ciseaux', NULL, 9),
	('VSAV', 4, 30, 'Bouteille d’oxygène portable : pression', NULL, 1),
	('VSAV', 4, 31, 'Insufflateurs adulte, enfant et nourrisson', NULL, 2),
	('VSAV', 4, 32, 'Masques haute concentration', NULL, 3),
	('VSAV', 4, 33, 'Canules oropharyngées (jeu)', NULL, 4),
	('FPT', 5, 34, 'Niveau de carburant (au moins 3/4)', NULL, 1),
	('FPT', 5, 35, 'Radio : essai', NULL, 2),
	('FPT', 5, 36, 'Gyrophares et deux-tons', NULL, 3),
	('FPT', 5, 37, 'Lampes portatives chargées', 4, 4),
	('FPT', 5, 38, 'Caméra thermique chargée', NULL, 5),
	('FPT', 6, 39, 'ARI : pression et fonctionnement', 4, 1),
	('FPT', 6, 40, 'Masques ARI', 4, 2),
	('FPT', 6, 41, 'Bouteilles de réserve', 4, 3),
	('FPT', 6, 42, 'Balises de détresse', 4, 4),
	('FPT', 7, 43, 'Citerne pleine', NULL, 1),
	('FPT', 7, 44, 'Émulseur : niveau', NULL, 2),
	('FPT', 7, 45, 'Pompe : essai', NULL, 3),
	('FPT', 7, 46, 'Tuyaux 45 mm', 6, 4),
	('FPT', 7, 47, 'Tuyaux 70 mm', 4, 5),
	('FPT', 7, 48, 'Lances', 2, 6),
	('FPT', 7, 49, 'Division', NULL, 7),
	('FPT', 7, 50, 'Clés tricoises', 2, 8),
	('FPT', 8, 51, 'Lot de sauvetage et de protection contre les chutes', NULL, 1),
	('FPT', 8, 52, 'Échelle à crochets', NULL, 2),
	('FPT', 8, 53, 'Échelle 3 plans', NULL, 3),
	('FPT', 8, 54, 'Lot de balisage (cônes)', NULL, 4),
	('FPT', 8, 55, 'Extincteurs eau, CO2, poudre', 3, 5),
	('FPT', 8, 56, 'Outils de forcement (lot)', NULL, 6),
	('FPT', 8, 57, 'Tronçonneuse : plein et essai', NULL, 7),
	('VTU', 9, 58, 'Niveau de carburant (au moins 3/4)', NULL, 1),
	('VTU', 9, 59, 'Radio : essai', NULL, 2),
	('VTU', 9, 60, 'Gyrophares et deux-tons', NULL, 3),
	('VTU', 9, 61, 'Gilets haute visibilité', 3, 4),
	('VTU', 10, 62, 'Motopompe : plein et essai', NULL, 1),
	('VTU', 10, 63, 'Électropompe', NULL, 2),
	('VTU', 10, 64, 'Aspirateur à eau', NULL, 3),
	('VTU', 10, 65, 'Raclettes et seaux', NULL, 4),
	('VTU', 11, 66, 'Bâches (lot)', NULL, 1),
	('VTU', 11, 67, 'Groupe électrogène : plein et essai', NULL, 2),
	('VTU', 11, 68, 'Projecteurs d’éclairage', 2, 3),
	('VTU', 11, 69, 'Tronçonneuse : plein et essai', NULL, 4),
	('VTU', 11, 70, 'Lot de balisage', NULL, 5),
	('VTU', 11, 71, 'Cordes et sangles', NULL, 6),
	('VTU', 11, 72, 'Caisse à outils', NULL, 7)
) SELECT * FROM e) e
JOIN `type_engin` t ON t.`nom` = e.type
JOIN `fiche_version` v ON v.`type_id` = t.`id` AND v.`numero` = 1
JOIN `fiche_zone` fz ON fz.`version_id` = v.`id` AND fz.`ref` = e.zone
WHERE NOT EXISTS (SELECT 1 FROM `fiche_element`);
--> statement-breakpoint
INSERT INTO `responsabilite_droit` (`responsabilite_id`, `droit`, `verrouille`)
SELECT r.`id`, d.droit, 1
FROM `responsabilite` r, (WITH d(droit) AS (VALUES ('TRAITER_ANOMALIE'), ('GERER_FICHES')) SELECT * FROM d) d
WHERE r.`systeme` = 'chef_equipe'
	AND NOT EXISTS (SELECT 1 FROM `responsabilite_droit` x WHERE x.`responsabilite_id` = r.`id` AND x.`droit` = d.droit);
