import { sql } from 'drizzle-orm';
import { check, index, integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { AVIS_ETE, AVIS_REMPLACEMENT, AVIS_RESERVATION, checkDans, ETATS_DEMANDE, GENRES_DEMANDE, DROITS, ETATS_RESERVATION, FETES, FORMES_RESSOURCE, NATURES_RESPONSABILITE, REACTIONS, REPONSES_EVENEMENT, RESPONSABILITES_SYSTEME, STATUTS_OPERATIONNELS, SUPPRESSIONS_MESSAGE, TYPES_CONVERSATION, TYPES_PERIMETRE, TYPES_PERSONNE, TYPES_PHOTO, TYPES_PUBLICATION } from './listes.ts';

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
		sondageCloture: text('sondage_cloture'),
		// Manœuvre annulée (planning) : la publication reste, marquée « Annulée ».
		annuleeLe: text('annulee_le')
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

// `auteur` nul : message système (`systeme`). Pour le rafraîchissement : `maj_le`, dernière création ou modification ;
// `lu_le`, dernière lecture par un autre membre (la coche de l'auteur peut changer).
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
		supprime: text('supprime', { enum: SUPPRESSIONS_MESSAGE }),
		luLe: text('lu_le')
	},
	(t) => [
		check('message_modifie', sql`${sql.identifier('modifie')} IN (0, 1)`),
		check('message_supprime', sql`${sql.identifier('supprime')} IS NULL OR ${checkDans('supprime', SUPPRESSIONS_MESSAGE)}`),
		index('message_conversation').on(t.conversationId, t.id),
		index('message_conversation_maj').on(t.conversationId, t.majLe)
	]
);

const versMessage = () => integer('message_id').notNull().references(() => message.id, { onDelete: 'cascade' });

// Une réaction par personne et par message.
export const reactionMessage = sqliteTable(
	'reaction_message',
	{ messageId: versMessage(), personneId: versPersonne(), emoji: text('emoji', { enum: REACTIONS }).notNull() },
	(t) => [primaryKey({ columns: [t.messageId, t.personneId] }), check('reaction_message_emoji', checkDans('emoji', REACTIONS))]
);

// `photo_id` : la photo dans la base des photos (PHOTOS).
export const photoMessage = sqliteTable(
	'photo_message',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		messageId: versMessage(),
		ordre: integer('ordre').notNull(),
		type: text('type', { enum: TYPES_PHOTO }).notNull(),
		photoId: integer('photo_id').notNull()
	},
	(t) => [check('photo_message_type', checkDans('type', TYPES_PHOTO)), index('photo_message_message').on(t.messageId)]
);

// Un message signalé aux modérateurs. La copie (texte, identifiants des photos dans PHOTOS) survit au message et protège
// ses photos jusqu'au classement, qui l'efface. `message_id` devient nul quand le message est effacé.
export const signalementMessage = sqliteTable(
	'signalement_message',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		messageId: integer('message_id').references(() => message.id, { onDelete: 'set null' }),
		par: integer('par')
			.notNull()
			.references(() => personne.id),
		le: text('le').notNull(),
		auteur: integer('auteur')
			.notNull()
			.references(() => personne.id),
		envoyeLe: text('envoye_le').notNull(),
		texteCopie: text('texte_copie').notNull(),
		photosCopie: text('photos_copie').notNull().default('[]'),
		classeLe: text('classe_le')
	},
	(t) => [uniqueIndex('signalement_message_par').on(t.messageId, t.par), index('signalement_message_classe').on(t.classeLe)]
);

// Notifications (notifications.ts). Le fil de la cloche : une ligne par publication ou commentaire reçu ; `lue_le` nul tant qu'elle n'est pas lue.
export const notification = sqliteTable(
	'notification',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		personneId: versPersonne(),
		publicationId: versPublication(),
		commentaireId: integer('commentaire_id').references(() => commentaire.id, { onDelete: 'cascade' }),
		creeLe: text('cree_le').notNull(),
		lueLe: text('lue_le')
	},
	(t) => [index('notification_personne').on(t.personneId, t.lueLe), index('notification_publication').on(t.publicationId)]
);

// Un appareil où la personne a activé les notifications (Web Push). Un même appareil n'est abonné qu'une fois.
export const abonnementPush = sqliteTable(
	'abonnement_push',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		personneId: versPersonne(),
		endpoint: text('endpoint').notNull().unique(),
		p256dh: text('p256dh').notNull(),
		auth: text('auth').notNull(),
		appareil: text('appareil').notNull().default(''),
		creeLe: text('cree_le').notNull()
	},
	(t) => [index('abonnement_push_personne').on(t.personneId)]
);

// Ce que la personne a coupé au téléphone : « tout », « mur:<clé> » ou « conversation:<id> ».
export const coupure = sqliteTable('coupure', { personneId: versPersonne(), lieu: text('lieu').notNull() }, (t) => [primaryKey({ columns: [t.personneId, t.lieu] })]);

// La file des envois au téléphone, vidée par lots (tâche planifiée). `donnees` : JSON { titre, texte, url, tag }.
export const envoiPush = sqliteTable('envoi_push', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	abonnementId: integer('abonnement_id')
		.notNull()
		.references(() => abonnementPush.id, { onDelete: 'cascade' }),
	donnees: text('donnees').notNull(),
	creeLe: text('cree_le').notNull()
});

// Réservations (reservations.ts). Une ressource est gérée par un rôle ou par un comité, jamais les deux.
// `stock` : pour une ressource prise par jours ; vide pour un créneau. `retiree_le` : date de retrait, vide tant qu'elle sert.
export const ressource = sqliteTable(
	'ressource',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		nom: text('nom').notNull(),
		forme: text('forme', { enum: FORMES_RESSOURCE }).notNull(),
		stock: integer('stock'),
		icone: text('icone').notNull(),
		ouverteReserve: integer('ouverte_reserve').notNull().default(0),
		gereeParResponsabiliteId: integer('geree_par_responsabilite_id').references(() => responsabilite.id),
		gereeParComiteId: integer('geree_par_comite_id').references(() => comite.id),
		retireeLe: text('retiree_le'),
		creeLe: text('cree_le').notNull()
	},
	() => [
		check('ressource_forme', checkDans('forme', FORMES_RESSOURCE)),
		check('ressource_ouverte_reserve', sql`${sql.identifier('ouverte_reserve')} IN (0, 1)`),
		check('ressource_gestionnaire', sql`(${sql.identifier('geree_par_responsabilite_id')} IS NULL) <> (${sql.identifier('geree_par_comite_id')} IS NULL)`),
		check('ressource_stock', sql`(${sql.identifier('forme')} = 'jours') = (${sql.identifier('stock')} IS NOT NULL)`)
	]
);

// Jours « AAAA-MM-JJ » inclus pour une ressource prise par jours ; « AAAA-MM-JJTHH:MM », fin exclue, pour un créneau (heure de Paris).
// `nom_demandeur`, `telephone` : saisis par le compte partagé de la réserve citoyenne. `tranchee_par` : format du journal.
export const reservation = sqliteTable(
	'reservation',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		ressourceId: integer('ressource_id')
			.notNull()
			.references(() => ressource.id),
		personneId: versPersonne(),
		nomDemandeur: text('nom_demandeur'),
		telephone: text('telephone'),
		debut: text('debut').notNull(),
		fin: text('fin').notNull(),
		quantite: integer('quantite').notNull().default(1),
		mot: text('mot'),
		etat: text('etat', { enum: ETATS_RESERVATION }).notNull(),
		creeLe: text('cree_le').notNull(),
		trancheePar: text('tranchee_par'),
		trancheeLe: text('tranchee_le'),
		motif: text('motif')
	},
	(t) => [check('reservation_etat', checkDans('etat', ETATS_RESERVATION)), index('reservation_ressource').on(t.ressourceId, t.etat, t.debut), index('reservation_personne').on(t.personneId)]
);

// Ce que le demandeur apprend d'un gestionnaire (accord, refus, annulation) : sa ligne dans la cloche.
export const avisReservation = sqliteTable(
	'avis_reservation',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		personneId: versPersonne(),
		reservationId: integer('reservation_id')
			.notNull()
			.references(() => reservation.id, { onDelete: 'cascade' }),
		quoi: text('quoi', { enum: AVIS_RESERVATION }).notNull(),
		creeLe: text('cree_le').notNull(),
		lueLe: text('lue_le')
	},
	(t) => [check('avis_reservation_quoi', checkDans('quoi', AVIS_RESERVATION)), index('avis_reservation_personne').on(t.personneId, t.lueLe)]
);

// Planning de l'année (planning/annee.ts). `ordre` : JSON, identifiants des équipes dans l'ordre du roulement, la première tient la première semaine.
// `publiee_le` nul : l'année n'est pas encore visible des agents.
export const anneePlanning = sqliteTable('annee_planning', {
	annee: integer('annee').primaryKey(),
	ordre: text('ordre').notNull().default('[]'),
	publieeLe: text('publiee_le')
});

// Une semaine dont le chef a changé l'équipe, désignée par son jour de relève.
export const semaineChangee = sqliteTable('semaine_changee', {
	debut: text('debut').primaryKey(),
	equipeId: integer('equipe_id')
		.notNull()
		.references(() => equipe.id)
});

// `convoques` : JSON, « tous » ou identifiants d'équipes. `publication_id` : son annonce sur « Le centre », une fois publiée (tâche de nuit).
export const manoeuvre = sqliteTable(
	'manoeuvre',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		debut: text('debut').notNull(),
		theme: text('theme').notNull(),
		lieu: text('lieu').notNull(),
		convoques: text('convoques').notNull(),
		petitDejeuner: integer('petit_dejeuner').notNull().default(0),
		annuleeLe: text('annulee_le'),
		publicationId: integer('publication_id').references(() => publication.id, { onDelete: 'set null' }),
		relanceLe: text('relance_le'),
		// Annoncée sur « Le centre » : jamais une seconde fois, même si la publication est supprimée.
		annonceeLe: text('annoncee_le')
	},
	(t) => [check('manoeuvre_petit_dejeuner', sql`${sql.identifier('petit_dejeuner')} IN (0, 1)`), index('manoeuvre_debut').on(t.debut)]
);

export const vacancesScolaires = sqliteTable('vacances_scolaires', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	nom: text('nom').notNull(),
	debut: text('debut').notNull(),
	fin: text('fin').notNull()
});

// Qui a tenu Noël et le Nouvel An les années passées (saisi par le chef), pour le tour des fêtes.
export const gardeFete = sqliteTable(
	'garde_fete',
	{
		annee: integer('annee').notNull(),
		fete: text('fete', { enum: FETES }).notNull(),
		equipeId: integer('equipe_id')
			.notNull()
			.references(() => equipe.id)
	},
	(t) => [primaryKey({ columns: [t.annee, t.fete] }), check('garde_fete_fete', checkDans('fete', FETES))]
);

// La clé secrète du lien d'agenda d'une personne : la changer invalide l'ancien lien.
export const cleAgenda = sqliteTable('cle_agenda', {
	personneId: integer('personne_id')
		.primaryKey()
		.references(() => personne.id),
	cle: text('cle').notNull(),
	creeLe: text('cree_le').notNull()
});

// Aptitudes du centre (aptitudes.ts) : `controlee`, vérifiée lors d'un remplacement. `retiree_le` : plus proposée, gardée pour l'historique.
export const aptitude = sqliteTable(
	'aptitude',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		nom: text('nom').notNull().unique(),
		controlee: integer('controlee').notNull().default(0),
		ordre: integer('ordre').notNull(),
		retireeLe: text('retiree_le')
	},
	() => [check('aptitude_controlee', sql`${sql.identifier('controlee')} IN (0, 1)`)]
);

// L'aptitude d'un agent, datée ; sans expiration, elle vaut tant qu'on ne la retire pas.
export const aptitudeAgent = sqliteTable(
	'aptitude_agent',
	{
		personneId: versPersonne(),
		aptitudeId: integer('aptitude_id')
			.notNull()
			.references(() => aptitude.id),
		obtenueLe: text('obtenue_le').notNull(),
		expireLe: text('expire_le')
	},
	(t) => [primaryKey({ columns: [t.personneId, t.aptitudeId] })]
);

// Remplacements (remplacements/). `periodes` : JSON [{ debut, fin }] du demandeur ; `periodes_cible` : celles du collègue (échange).
// Échange de manœuvre : `manoeuvre_id` (celle du demandeur) contre `manoeuvre_cible_id`. `debut` : le premier début, où la demande expire.
// `equipe_id` : l'équipe dont le chef valide. `manque` : JSON, aptitudes contrôlées manquantes notées à l'acceptation.
export const demandeRemplacement = sqliteTable(
	'demande_remplacement',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		genre: text('genre', { enum: GENRES_DEMANDE }).notNull(),
		demandeurId: integer('demandeur_id')
			.notNull()
			.references(() => personne.id),
		cibleId: integer('cible_id').references(() => personne.id),
		periodes: text('periodes').notNull().default('[]'),
		periodesCible: text('periodes_cible'),
		manoeuvreId: integer('manoeuvre_id').references(() => manoeuvre.id),
		manoeuvreCibleId: integer('manoeuvre_cible_id').references(() => manoeuvre.id),
		equipeId: integer('equipe_id').references(() => equipe.id),
		debut: text('debut').notNull(),
		mot: text('mot'),
		etat: text('etat', { enum: ETATS_DEMANDE }).notNull(),
		remplacantId: integer('remplacant_id').references(() => personne.id),
		manque: text('manque'),
		creeLe: text('cree_le').notNull(),
		accepteeLe: text('acceptee_le'),
		trancheePar: text('tranchee_par'),
		trancheeLe: text('tranchee_le'),
		motif: text('motif'),
		relanceLe: text('relance_le')
	},
	(t) => [
		check('demande_remplacement_genre', checkDans('genre', GENRES_DEMANDE)),
		check('demande_remplacement_etat', checkDans('etat', ETATS_DEMANDE)),
		index('demande_remplacement_etat').on(t.etat, t.debut),
		index('demande_remplacement_demandeur').on(t.demandeurId)
	]
);

// Qui a reçu la demande (le collègue visé, ou les disponibles) ; `refuse_le` : il l'a écartée.
export const destinataireRemplacement = sqliteTable(
	'destinataire_remplacement',
	{
		demandeId: integer('demande_id')
			.notNull()
			.references(() => demandeRemplacement.id, { onDelete: 'cascade' }),
		personneId: versPersonne(),
		refuseLe: text('refuse_le')
	},
	(t) => [primaryKey({ columns: [t.demandeId, t.personneId] }), index('destinataire_remplacement_personne').on(t.personneId)]
);

// Ce qu'une personne apprend d'une demande : sa ligne dans la cloche.
export const avisRemplacement = sqliteTable(
	'avis_remplacement',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		personneId: versPersonne(),
		demandeId: integer('demande_id')
			.notNull()
			.references(() => demandeRemplacement.id, { onDelete: 'cascade' }),
		quoi: text('quoi', { enum: AVIS_REMPLACEMENT }).notNull(),
		creeLe: text('cree_le').notNull(),
		lueLe: text('lue_le')
	},
	(t) => [check('avis_remplacement_quoi', checkDans('quoi', AVIS_REMPLACEMENT)), index('avis_remplacement_personne').on(t.personneId, t.lueLe)]
);

// Règles d'armement (armement.ts) : une seule ligne, `valeur` JSON { engins, niveaux }. Absente : les règles par défaut.
export const reglageArmement = sqliteTable('reglage_armement', {
	id: integer('id').primaryKey(),
	valeur: text('valeur').notNull()
});

// L'été d'une année (planning/ete.ts) : `debut` et `fin`, jours de relève de la première et de la dernière semaine.
// Ouvert par le chef : les agents donnent leurs vacances jusqu'à `date_limite`. `publiee_le` : la répartition est visible.
export const ete = sqliteTable('ete', {
	annee: integer('annee').primaryKey(),
	debut: text('debut').notNull(),
	fin: text('fin').notNull(),
	dateLimite: text('date_limite').notNull(),
	publieeLe: text('publiee_le'),
	rappelMoisLe: text('rappel_mois_le'),
	rappelSemaineLe: text('rappel_semaine_le')
});

// La réponse d'un agent pour l'été : `tout_ete`, disponible tout l'été ; sinon ses vacances sont dans vacances_agent.
export const reponseEte = sqliteTable(
	'reponse_ete',
	{
		annee: integer('annee').notNull(),
		personneId: versPersonne(),
		toutEte: integer('tout_ete').notNull().default(0),
		modifieeLe: text('modifiee_le').notNull()
	},
	(t) => [primaryKey({ columns: [t.annee, t.personneId] }), check('reponse_ete_tout_ete', sql`${sql.identifier('tout_ete')} IN (0, 1)`)]
);

export const vacancesAgent = sqliteTable(
	'vacances_agent',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		personneId: versPersonne(),
		annee: integer('annee').notNull(),
		debut: text('debut').notNull(),
		fin: text('fin').notNull()
	},
	(t) => [index('vacances_agent_annee').on(t.annee, t.personneId)]
);

// Une plage de l'été (nuit de semaine, 24 h de week-end ou de férié) : les écarts à l'équipe de base de la semaine,
// en JSON d'identifiants : `ajoutes` (renforts), `retires` (vacances, ou retirés par le chef).
export const plageEte = sqliteTable(
	'plage_ete',
	{
		debut: text('debut').primaryKey(),
		fin: text('fin').notNull(),
		annee: integer('annee').notNull(),
		ajoutes: text('ajoutes').notNull().default('[]'),
		retires: text('retires').notNull().default('[]')
	},
	(t) => [index('plage_ete_annee').on(t.annee)]
);

// La cloche de l'été.
export const avisEte = sqliteTable(
	'avis_ete',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		personneId: versPersonne(),
		quoi: text('quoi', { enum: AVIS_ETE }).notNull(),
		texte: text('texte').notNull(),
		url: text('url').notNull(),
		creeLe: text('cree_le').notNull(),
		lueLe: text('lue_le')
	},
	(t) => [check('avis_ete_quoi', checkDans('quoi', AVIS_ETE)), index('avis_ete_personne').on(t.personneId, t.lueLe)]
);

// Tables de connexion (Better Auth), dans la même base.
export * from './schema-auth.ts';

// Météo et vigilance (meteo.ts) : le dernier relevé de chaque source, « meteo » (Open-Meteo) ou « vigilance » (Météo-France). `donnees` : JSON.
export const releve = sqliteTable('releve', {
	cle: text('cle').primaryKey(),
	donnees: text('donnees').notNull(),
	majLe: text('maj_le').notNull()
});
