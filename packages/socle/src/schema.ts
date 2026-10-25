import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const personne = sqliteTable('personne', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	email: text('email').notNull().unique(),
	prenom: text('prenom').notNull(),
	nom: text('nom').notNull()
});
