CREATE TABLE `photo_message` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`message_id` integer NOT NULL,
	`ordre` integer NOT NULL,
	`type` text NOT NULL,
	`photo_id` integer NOT NULL,
	FOREIGN KEY (`message_id`) REFERENCES `message`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "photo_message_type" CHECK("type" IN ('image/jpeg', 'image/webp'))
);
--> statement-breakpoint
CREATE INDEX `photo_message_message` ON `photo_message` (`message_id`);--> statement-breakpoint
CREATE TABLE `reaction_message` (
	`message_id` integer NOT NULL,
	`personne_id` integer NOT NULL,
	`emoji` text NOT NULL,
	PRIMARY KEY(`message_id`, `personne_id`),
	FOREIGN KEY (`message_id`) REFERENCES `message`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`personne_id`) REFERENCES `personne`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "reaction_message_emoji" CHECK("emoji" IN ('👍', '❤️', '😂', '😮', '😢', '👏'))
);
