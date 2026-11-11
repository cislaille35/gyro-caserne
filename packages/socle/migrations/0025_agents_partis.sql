ALTER TABLE `personne` ADD `parti_le` text;--> statement-breakpoint
ALTER TABLE `personne` ADD `efface_le` text;--> statement-breakpoint
CREATE INDEX `journal_cible` ON `journal` (`cible_type`,`cible_id`);