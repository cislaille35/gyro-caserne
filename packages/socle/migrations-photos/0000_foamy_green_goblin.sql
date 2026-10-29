CREATE TABLE `photo` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`donnees` blob NOT NULL,
	`taille` integer NOT NULL,
	`cree_le` text NOT NULL,
	CONSTRAINT "photo_type" CHECK("type" IN ('image/jpeg', 'image/webp'))
);
