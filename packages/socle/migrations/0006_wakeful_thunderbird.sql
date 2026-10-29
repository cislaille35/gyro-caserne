-- Les octets des photos passent dans leur propre base (liaison PHOTOS, décision 0010) : ici, la référence photo_id.
-- La table est refaite vide : seule la préprod a des photos, fictives (accord du porteur, 2026-10-29).
DROP TABLE `photo_publication`;--> statement-breakpoint
CREATE TABLE `photo_publication` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`publication_id` integer NOT NULL,
	`ordre` integer NOT NULL,
	`type` text NOT NULL,
	`photo_id` integer NOT NULL,
	FOREIGN KEY (`publication_id`) REFERENCES `publication`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "photo_publication_type" CHECK("type" IN ('image/jpeg', 'image/webp'))
);
--> statement-breakpoint
CREATE INDEX `photo_publication_publication` ON `photo_publication` (`publication_id`);
