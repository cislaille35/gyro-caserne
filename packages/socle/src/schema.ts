import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const personne = sqliteTable('personne', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	email: text('email').notNull().unique(),
	prenom: text('prenom').notNull(),
	nom: text('nom').notNull()
});
