import { sql } from 'drizzle-orm';
import { check, index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { checkDans, DROITS, NATURES_RESPONSABILITE, REPONSES_EVENEMENT, RESPONSABILITES_SYSTEME, STATUTS_OPERATIONNELS, SUPPRESSIONS_MESSAGE, TYPES_CONVERSATION, TYPES_PERIMETRE, TYPES_PERSONNE, TYPES_PHOTO, TYPES_PUBLICATION } from './listes.ts';

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

export const equipe = sqliteTable(
	'equipe',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		nom: text('nom').notNull(),
		couleur: text('couleur').notNull(),
		ordreRotation: integer('ordre_rotation').notNull(),
		active: integer('active').notNull().default(1)
	},
	() => [check('equipe_active', sql`${sql.identifier('active')} IN (0, 1)`)]
);

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
		// Messagerie : 0, la personne ne montre plus ses lectures et ne voit plus celles des autres.
		cochesLecture: integer('coches_lecture').notNull().default(1),
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

export const comite = sqliteTable('comite', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	nom: text('nom').notNull(),
	theme: text('theme').notNull(),
	// Date ISO de dissolution ; nul tant que le comité existe.
	dissousLe: text('dissous_le'),
	// Icône du mur du comité ; nulle, elle découle du thème.
	icone: text('icone')
});

export const responsabilite = sqliteTable(
	'responsabilite',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		nom: text('nom').notNull(),
		nature: text('nature', { enum: NATURES_RESPONSABILITE }).notNull(),
		typePerimetre: text('type_perimetre', { enum: TYPES_PERIMETRE }).notNull(),
		// Nul : pour un périmètre « comité », le comité visé attribue lui-même.
		comiteAttributeurId: integer('comite_attributeur_id').references(() => comite.id),
		systeme: text('systeme', { enum: RESPONSABILITES_SYSTEME }).unique(),
		// Date ISO d'archivage ; nul tant que la responsabilité sert.
		archiveeLe: text('archivee_le'),
		// Identifiant du modèle d'origine (modeles.ts) ; nul pour un rôle fait à la main.
		modele: text('modele'),
		// Nom d'icône (icones.ts) ; nul : l'appli choisit.
		icone: text('icone')
	},
	() => [
		check('responsabilite_nature', checkDans('nature', NATURES_RESPONSABILITE)),
		check('responsabilite_type_perimetre', checkDans('type_perimetre', TYPES_PERIMETRE)),
		check('responsabilite_systeme', sql`${sql.identifier('systeme')} IS NULL OR ${checkDans('systeme', RESPONSABILITES_SYSTEME)}`)
	]
);

export const responsabiliteDroit = sqliteTable(
	'responsabilite_droit',
	{
		responsabiliteId: integer('responsabilite_id')
			.notNull()
			.references(() => responsabilite.id),
		droit: text('droit', { enum: DROITS }).notNull(),
		verrouille: integer('verrouille').notNull().default(0)
	},
	(t) => [
		primaryKey({ columns: [t.responsabiliteId, t.droit] }),
		check('responsabilite_droit_droit', checkDans('droit', DROITS)),
		check('responsabilite_droit_verrouille', sql`${sql.identifier('verrouille')} IN (0, 1)`)
	]
);

export const attribution = sqliteTable(
	'attribution',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		personneId: integer('personne_id')
			.notNull()
			.references(() => personne.id),
		responsabiliteId: integer('responsabilite_id')
			.notNull()
			.references(() => responsabilite.id),
		perimetreType: text('perimetre_type', { enum: TYPES_PERIMETRE }).notNull(),
		perimetreId: integer('perimetre_id'),
		debut: text('debut').notNull(),
		fin: text('fin'),
		// Format du journal : personne:<id> ou super:<email>.
		saisiePar: text('saisie_par').notNull(),
		saisieLe: text('saisie_le').notNull(),
		compteRendu: text('compte_rendu')
	},
	() => [
		check('attribution_perimetre_type', checkDans('perimetre_type', TYPES_PERIMETRE)),
		check('attribution_perimetre_id', sql`(${sql.identifier('perimetre_type')} = 'centre') = (${sql.identifier('perimetre_id')} IS NULL)`)
	]
);

export const journal = sqliteTable('journal', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	quand: text('quand').notNull(),
	acteur: text('acteur').notNull(),
	action: text('action').notNull(),
	cibleType: text('cible_type').notNull(),
	cibleId: integer('cible_id'),
	details: text('details').notNull().default('{}')
});

// Dernier lien de connexion envoyé à chaque adresse : un lien par minute au plus.
export const envoiLien = sqliteTable('envoi_lien', {
	adresse: text('adresse').primaryKey(),
	envoyeLe: integer('envoye_le', { mode: 'timestamp_ms' }).notNull()
});

// Murs : une publication appartient à un mur désigné par sa clé (« centre », « vie », « equipe:<id> », « comite:<id> », voir murs.ts).
// Format de l'auteur comme le journal : personne:<id> ou super:<email>.
export const publication = sqliteTable(
	'publication',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		mur: text('mur').notNull(),
		auteur: text('auteur').notNull(),
		type: text('type', { enum: TYPES_PUBLICATION }).notNull(),
		texte: text('texte').notNull(),
		priseDeConnaissance: integer('prise_de_connaissance').notNull().default(0),
		epinglee: integer('epinglee').notNull().default(0),
		commentairesFermes: integer('commentaires_fermes').notNull().default(0),
		creeLe: text('cree_le').notNull(),
		modifieeLe: text('modifiee_le'),
		// Événement : début (date et heure), lieu, convoqués (JSON : « tous » ou liste d'identifiants d'équipes).
		debut: text('debut'),
		lieu: text('lieu'),
		convoques: text('convoques'),
		// Sondage : question et réponses (JSON, liste de textes).
		sondageQuestion: text('sondage_question'),
		sondageReponses: text('sondage_reponses'),
		// Dates du sondage (« AAAA-MM-JJTHH:MM », heure de Paris) ; vides pour un sondage publié sans dates.
		sondageOuverture: text('sondage_ouverture'),
		sondageCloture: text('sondage_cloture')
	},
	(t) => [
		check('publication_type', checkDans('type', TYPES_PUBLICATION)),
		check('publication_prise_de_connaissance', sql`${sql.identifier('prise_de_connaissance')} IN (0, 1)`),
		check('publication_epinglee', sql`${sql.identifier('epinglee')} IN (0, 1)`),
		check('publication_commentaires_fermes', sql`${sql.identifier('commentaires_fermes')} IN (0, 1)`),
		index('publication_mur').on(t.mur, t.creeLe)
	]
);

const versPublication = () => integer('publication_id').notNull().references(() => publication.id, { onDelete: 'cascade' });
const versPersonne = () => integer('personne_id').notNull().references(() => personne.id);

export const commentaire = sqliteTable(
	'commentaire',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		publicationId: versPublication(),
		auteur: text('auteur').notNull(),
		texte: text('texte').notNull(),
		creeLe: text('cree_le').notNull()
	},
	(t) => [index('commentaire_publication').on(t.publicationId)]
);

export const jaime = sqliteTable('jaime', { publicationId: versPublication(), personneId: versPersonne() }, (t) => [primaryKey({ columns: [t.publicationId, t.personneId] })]);

export const reponseEvenement = sqliteTable(
	'reponse_evenement',
	{ publicationId: versPublication(), personneId: versPersonne(), reponse: text('reponse', { enum: REPONSES_EVENEMENT }).notNull() },
	(t) => [primaryKey({ columns: [t.publicationId, t.personneId] }), check('reponse_evenement_reponse', checkDans('reponse', REPONSES_EVENEMENT))]
);

// Une seule réponse par personne : son rang dans la liste des réponses du sondage.
export const voteSondage = sqliteTable(
	'vote_sondage',
	{ publicationId: versPublication(), personneId: versPersonne(), reponse: integer('reponse').notNull() },
	(t) => [primaryKey({ columns: [t.publicationId, t.personneId] })]
);

export const priseConnaissance = sqliteTable(
	'prise_connaissance',
	{ publicationId: versPublication(), personneId: versPersonne(), le: text('le').notNull() },
	(t) => [primaryKey({ columns: [t.publicationId, t.personneId] })]
);

// Les octets sont dans la base des photos (schema-photos.ts) : ici, la référence seulement (`photo_id`, sans lien vérifiable d'une base à l'autre).
export const photoPublication = sqliteTable(
	'photo_publication',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		publicationId: versPublication(),
		ordre: integer('ordre').notNull(),
		type: text('type', { enum: TYPES_PHOTO }).notNull(),
		photoId: integer('photo_id').notNull()
	},
	(t) => [check('photo_publication_type', checkDans('type', TYPES_PHOTO)), index('photo_publication_publication').on(t.publicationId)]
);

// Dernière visite d'une personne sur un mur : sert à compter les nouveautés.
export const visiteMur = sqliteTable(
	'visite_mur',
	{ personneId: versPersonne(), mur: text('mur').notNull(), vueLe: text('vue_le').notNull() },
	(t) => [primaryKey({ columns: [t.personneId, t.mur] })]
);

// Messagerie (messagerie.ts). Une conversation à deux a une clé de paire « petit id:grand id » : une seule par paire de personnes.
export const conversation = sqliteTable(
	'conversation',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		type: text('type', { enum: TYPES_CONVERSATION }).notNull(),
		nom: text('nom'),
		icone: text('icone'),
		clePaire: text('cle_paire').unique(),
		creePar: integer('cree_par').notNull(),
		creeLe: text('cree_le').notNull(),
		dernierLe: text('dernier_le').notNull()
	},
	() => [check('conversation_type', checkDans('type', TYPES_CONVERSATION))]
);

// `lu_jusqu_a` : id du dernier message lu.
export const membreConversation = sqliteTable(
	'membre_conversation',
	{
		conversationId: integer('conversation_id')
			.notNull()
			.references(() => conversation.id, { onDelete: 'cascade' }),
		personneId: versPersonne(),
		animateur: integer('animateur').notNull().default(0),
		entreLe: text('entre_le').notNull(),
		luJusquA: integer('lu_jusqu_a').notNull().default(0)
	},
	(t) => [primaryKey({ columns: [t.conversationId, t.personneId] }), check('membre_conversation_animateur', sql`${sql.identifier('animateur')} IN (0, 1)`), index('membre_conversation_personne').on(t.personneId)]
);

// `auteur` nul : message système (`systeme`). `maj_le` : dernière création ou modification, pour le rafraîchissement.
export const message = sqliteTable(
	'message',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		conversationId: integer('conversation_id')
			.notNull()
			.references(() => conversation.id, { onDelete: 'cascade' }),
		auteur: integer('auteur').references(() => personne.id),
		texte: text('texte').notNull(),
		reponseA: integer('reponse_a'),
		systeme: text('systeme'),
		creeLe: text('cree_le').notNull(),
		majLe: text('maj_le').notNull(),
		modifie: integer('modifie').notNull().default(0),
		supprime: text('supprime', { enum: SUPPRESSIONS_MESSAGE })
	},
	(t) => [
		check('message_modifie', sql`${sql.identifier('modifie')} IN (0, 1)`),
		check('message_supprime', sql`${sql.identifier('supprime')} IS NULL OR ${checkDans('supprime', SUPPRESSIONS_MESSAGE)}`),
		index('message_conversation').on(t.conversationId, t.id),
		index('message_conversation_maj').on(t.conversationId, t.majLe)
	]
);

// Tables de connexion (Better Auth), dans la même base.
export * from './schema-auth.ts';
