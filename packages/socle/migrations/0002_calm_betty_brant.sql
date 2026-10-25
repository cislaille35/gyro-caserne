PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_equipe` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nom` text NOT NULL,
	`couleur` text NOT NULL,
	`ordre_rotation` integer NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	CONSTRAINT "equipe_active" CHECK("active" IN (0, 1))
);
--> statement-breakpoint
INSERT INTO `__new_equipe`("id", "nom", "couleur", "ordre_rotation", "active") SELECT "id", "nom", "couleur", "ordre_rotation", "active" FROM `equipe`;--> statement-breakpoint
DROP TABLE `equipe`;--> statement-breakpoint
ALTER TABLE `__new_equipe` RENAME TO `equipe`;--> statement-breakpoint
PRAGMA foreign_keys=ON;