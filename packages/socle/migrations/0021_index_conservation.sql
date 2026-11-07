CREATE INDEX `manoeuvre_publication` ON `manoeuvre` (`publication_id`);--> statement-breakpoint
CREATE INDEX `message_cree_le` ON `message` (`cree_le`);--> statement-breakpoint
CREATE INDEX `publication_conservation` ON `publication` (`epinglee`,`cree_le`);