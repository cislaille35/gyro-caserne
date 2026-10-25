import { sql } from 'drizzle-orm';
import { check, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { checkDans, DROITS, STATUTS_OPERATIONNELS, TYPES_PERIMETRE, TYPES_PERSONNE } from './listes.ts';

export const profil = sqliteTable(
	'profil',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		nom: text('nom').notNull(),
		typePersonne: text('type_personne', { enum: TYPES_PERSONNE }).notNull()
	},
	() => [check('profil_type_personne', checkDans('type_personne', TYPES_PERSONNE))]
);

export const profilDroit = sqliteTable(
	'profil_droit',
	{
		profilId: integer('profil_id')
			.notNull()
			.references(() => profil.id),
		droit: text('droit', { enum: DROITS }).notNull(),
		perimetreType: text('perimetre_type', { enum: TYPES_PERIMETRE }).notNull(),
		perimetreId: integer('perimetre_id')
	},
	() => [
		check('profil_droit_droit', checkDans('droit', DROITS)),
		check('profil_droit_perimetre_type', checkDans('perimetre_type', TYPES_PERIMETRE)),
		// Le centre n'a pas d'identifiant ; tout autre périmètre en exige un.
		check('profil_droit_perimetre_id', sql`(${sql.identifier('perimetre_type')} = 'centre') = (${sql.identifier('perimetre_id')} IS NULL)`)
	]
);

export const grade = sqliteTable('grade', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	code: text('code').notNull().unique(),
	libelle: text('libelle').notNull(),
	ordre: integer('ordre').notNull()
});

export const equipe = sqliteTable('equipe', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	nom: text('nom').notNull(),
	couleur: text('couleur').notNull(),
	ordreRotation: integer('ordre_rotation').notNull(),
	active: integer('active').notNull().default(1)
});

export const personne = sqliteTable(
	'personne',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		email: text('email').notNull().unique(),
		prenom: text('prenom').notNull(),
		nom: text('nom').notNull(),
		surnom: text('surnom'),
		photo: text('photo'),
		telephone: text('telephone'),
		telephoneVisible: integer('telephone_visible').notNull().default(0),
		naissance: text('naissance'),
		anniversaireVisible: integer('anniversaire_visible').notNull().default(1),
		entreeCentre: text('entree_centre'),
		engagementSpv: text('engagement_spv'),
		gradeId: integer('grade_id').references(() => grade.id),
		dateGrade: text('date_grade'),
		profilId: integer('profil_id').references(() => profil.id),
		statut: text('statut', { enum: STATUTS_OPERATIONNELS }).notNull().default('operationnel'),
		contactUrgence: text('contact_urgence'),
		creeLe: text('cree_le').notNull().default(sql`(datetime('now'))`)
	},
	(t) => [
		check('personne_email_normalise', sql`${sql.identifier('email')} = lower(trim(${sql.identifier('email')}))`),
		check('personne_statut', checkDans('statut', STATUTS_OPERATIONNELS)),
		check('personne_telephone_visible', sql`${sql.identifier('telephone_visible')} IN (0, 1)`),
		check('personne_anniversaire_visible', sql`${sql.identifier('anniversaire_visible')} IN (0, 1)`)
	]
);

export const affectationEquipe = sqliteTable('affectation_equipe', {
	personneId: integer('personne_id')
		.notNull()
		.references(() => personne.id),
	equipeId: integer('equipe_id')
		.notNull()
		.references(() => equipe.id),
	debut: text('debut').notNull(),
	fin: text('fin')
});

export const champCentre = sqliteTable('champ_centre', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	nom: text('nom').notNull(),
	visibilite: text('visibilite').notNull()
});

export const valeurChamp = sqliteTable(
	'valeur_champ',
	{
		personneId: integer('personne_id')
			.notNull()
			.references(() => personne.id),
		champId: integer('champ_id')
			.notNull()
			.references(() => champCentre.id),
		valeur: text('valeur').notNull()
	},
	(t) => [primaryKey({ columns: [t.personneId, t.champId] })]
);
