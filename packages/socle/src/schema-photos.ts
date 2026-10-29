import { check, customType, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { checkDans, TYPES_PHOTO } from './listes.ts';

// Base des photos (liaison PHOTOS), à part de la base principale : une base D1 gratuite tient 500 Mo au plus.
// Voir docs/decisions/0010-photos-dans-leur-base.md.

// Octets bruts ; D1 rend un BLOB en ArrayBuffer, SQLite de Node en Uint8Array : toujours relu en Uint8Array.
const octets = customType<{ data: Uint8Array; driverData: ArrayBuffer | Uint8Array | number[] }>({
	dataType: () => 'blob',
	fromDriver: (valeur) => (valeur instanceof Uint8Array ? valeur : new Uint8Array(valeur))
});

// `taille` : nombre d'octets, pour la jauge de remplissage sans relire les photos.
export const photo = sqliteTable(
	'photo',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		type: text('type', { enum: TYPES_PHOTO }).notNull(),
		donnees: octets('donnees').notNull(),
		taille: integer('taille').notNull(),
		creeLe: text('cree_le').notNull()
	},
	() => [check('photo_type', checkDans('type', TYPES_PHOTO))]
);
