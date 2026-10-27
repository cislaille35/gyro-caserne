ALTER TABLE `comite` ADD `dissous_le` text;--> statement-breakpoint
ALTER TABLE `responsabilite` ADD `archivee_le` text;--> statement-breakpoint
-- Ajouté à la main : le référent technique, pour les bases déjà remplies par le jeu de départ (une base vide le recevra du jeu de départ).
INSERT INTO `responsabilite` (`nom`, `nature`, `type_perimetre`, `comite_attributeur_id`, `systeme`)
SELECT 'Référent technique', 'fonction', 'centre', NULL, NULL
WHERE EXISTS (SELECT 1 FROM `profil`)
	AND NOT EXISTS (SELECT 1 FROM `responsabilite` WHERE `nom` = 'Référent technique');
--> statement-breakpoint
INSERT INTO `responsabilite_droit` (`responsabilite_id`, `droit`, `verrouille`)
SELECT r.`id`, d.`droit`, 0
FROM `responsabilite` r, (SELECT 'GERER_LISTES' AS `droit` UNION ALL SELECT 'GERER_COMITES') d
WHERE r.`nom` = 'Référent technique'
	AND NOT EXISTS (SELECT 1 FROM `responsabilite_droit` x WHERE x.`responsabilite_id` = r.`id` AND x.`droit` = d.`droit`);
