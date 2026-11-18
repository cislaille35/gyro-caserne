import { and, desc, eq, inArray, lt, sql, type SQL } from 'drizzle-orm';
import type { Base } from './base.ts';
import { enCours, exigerDate } from './dates.ts';
import type { Acteur } from './droits.ts';
import { RefusDroit } from './erreurs.ts';
import { attribution, journal, personne, responsabilite } from './schema.ts';

// Le suivi du centre : ce que les autres ont fait au centre, lu dans le journal, pour le chef de centre, l'adjoint et le super administrateur.
// Une liste fixe d'actions : le planning, les nominations, les réglages, les fiches des agents, les décisions sur les demandes et les
// remplacements validés. Rien de privé (conversations, son profil, publications, réservations d'un agent).

type Cible = { nom: string | null; role: string | null };
const de = (nom: string) => (/^[aeiouyhàâéèêëîïôöûü]/i.test(nom) ? `d’${nom}` : `de ${nom}`);
// Le nom d'un agent, ou « un ancien agent » quand sa fiche n'est plus là.
const agent = (c: Cible) => c.nom ?? 'un ancien agent';
const deAgent = (c: Cible) => (c.nom ? de(c.nom) : 'd’un ancien agent');
const nomme = (c: Cible, quoi: string) => (c.nom ? `${quoi} ${c.nom}` : quoi);

// La phrase de chaque action suivie, après le nom de son auteur.
const PHRASES = {
	// Planning et manœuvres
	ajouter_manoeuvre: (c) => nomme(c, 'a ajouté la manœuvre'),
	modifier_manoeuvre: (c) => nomme(c, 'a modifié la manœuvre'),
	annuler_manoeuvre: (c) => nomme(c, 'a annulé la manœuvre'),
	supprimer_manoeuvre: () => 'a retiré une manœuvre pas encore annoncée',
	regler_roulement: () => 'a réglé le roulement des équipes',
	publier_annee: () => 'a publié le planning de l’année',
	changer_semaines: () => 'a changé des semaines d’astreinte',
	ajouter_vacances: () => 'a ajouté des vacances scolaires',
	retirer_vacances: () => 'a retiré des vacances scolaires',
	noter_fete: () => 'a noté une garde de fête',
	importer_planning: () => 'a appliqué un fichier du planning',
	regler_ete: () => 'a réglé le planning d’été',
	proposer_ete: () => 'a proposé le planning d’été',
	publier_ete: () => 'a publié le planning d’été',
	ajouter_plage_ete: () => 'a changé le planning d’été',
	retirer_plage_ete: () => 'a changé le planning d’été',
	// Nominations et retraits
	attribuer: (c) => `a nommé ${agent(c)}${c.role ? ` : ${c.role}` : ''}`,
	terminer_attribution: (c) => `a retiré un rôle à ${agent(c)}${c.role ? ` : ${c.role}` : ''}`,
	finir_attribution: (c) => `a fixé la fin d’un rôle ${deAgent(c)}${c.role ? ` : ${c.role}` : ''}`,
	// Réglages
	creer_responsabilite: (c) => nomme(c, 'a créé le rôle'),
	modifier_responsabilite: (c) => nomme(c, 'a modifié le rôle'),
	archiver_responsabilite: (c) => nomme(c, 'a archivé le rôle'),
	creer_comite: (c) => nomme(c, 'a créé le comité'),
	modifier_comite: (c) => nomme(c, 'a modifié le comité'),
	dissoudre_comite: (c) => nomme(c, 'a dissous le comité'),
	modifier_droits_profil: (c) => nomme(c, 'a modifié les droits du profil'),
	ajouter_engin: (c) => nomme(c, 'a ajouté l’engin'),
	modifier_engin: (c) => nomme(c, 'a modifié l’engin'),
	creer_type_engin: (c) => nomme(c, 'a créé la fiche de'),
	importer_fiches: () => 'a appliqué un fichier des fiches d’engins',
	ajouter_ressource: (c) => nomme(c, 'a ajouté la ressource'),
	modifier_ressource: (c) => nomme(c, 'a modifié la ressource'),
	retirer_ressource: (c) => nomme(c, 'a retiré la ressource'),
	regler_armement: () => 'a réglé l’armement des engins',
	deposer_ecusson: () => 'a déposé l’écusson du centre',
	retirer_ecusson: () => 'a retiré l’écusson du centre',
	ajouter_aptitude: (c) => nomme(c, 'a ajouté l’aptitude'),
	modifier_aptitude: (c) => nomme(c, 'a modifié l’aptitude'),
	retirer_aptitude: (c) => nomme(c, 'a retiré l’aptitude'),
	// Fiches des agents (et fiches d'engins : même action, cible différente)
	ajouter_personne: (c) => `a ajouté ${agent(c)}`,
	modifier_fiche: (c) => `a modifié la fiche ${deAgent(c)}`,
	changer_statut: (c) => `a changé le statut ${deAgent(c)}`,
	affecter_equipe: (c) => `a changé l’équipe ${deAgent(c)}`,
	retirer_equipe: (c) => `a retiré ${agent(c)} de son équipe`,
	effacer_agent: () => 'a effacé les données d’un ancien agent',
	donner_aptitude: (c) => `a donné une aptitude à ${agent(c)}`,
	oter_aptitude: (c) => `a retiré une aptitude à ${agent(c)}`,
	// Décisions sur les demandes
	prendre_habillement: (c) => (c.nom ? `a pris en compte la demande d’habillement ${deAgent(c)}` : 'a pris en compte une demande d’habillement'),
	traiter_habillement: (c) => (c.nom ? `a traité la demande d’habillement ${deAgent(c)}` : 'a traité une demande d’habillement'),
	refuser_habillement: (c) => (c.nom ? `a refusé la demande d’habillement ${deAgent(c)}` : 'a refusé une demande d’habillement'),
	livrer_habillement: (c) => (c.nom ? `a livré la tenue ${deAgent(c)}` : 'a livré une tenue'),
	signaler_anomalie: (c) => nomme(c, 'a signalé une anomalie :'),
	rendre_indisponible: (c) => (c.nom ? `a rendu indisponible ${c.nom}` : 'a rendu un engin indisponible'),
	remettre_en_service: (c) => (c.nom ? `a remis en service ${c.nom}` : 'a remis un engin en service'),
	clore_anomalie: (c) => nomme(c, 'a clos une anomalie :'),
	accepter_reservation: (c) => nomme(c, 'a accepté une réservation :'),
	refuser_reservation: (c) => nomme(c, 'a refusé une réservation :'),
	// Remplacements validés ou refusés par le chef de garde
	valider_remplacement: (c) => `a validé le remplacement ${deAgent(c)}`,
	refuser_validation: (c) => `a refusé le remplacement ${deAgent(c)}`
} satisfies Record<string, (c: Cible) => string>;

export const ACTIONS_SUIVI = Object.keys(PHRASES) as readonly string[];
const PAGE = 25;
// Au-delà, l'en-tête n'en dit pas plus : la lecture s'arrête là.
export const NOUVEAUTES_MAX = 99;

// Les fiches d'engins sont journalisées « modifier_fiche » sur un type d'engin.
const phrase = (action: string, cibleType: string, c: Cible) => (action === 'modifier_fiche' && cibleType === 'type_engin' ? nomme(c, 'a modifié la fiche de') : (PHRASES[action as keyof typeof PHRASES]?.(c) ?? action));

export type LigneSuivi = { id: number; quand: string; qui: string; phrase: string; lien: string | null };

const SYSTEMES_SUIVI = sql.raw(`'chef_centre', 'chef_centre_adjoint'`);
const actions = () => sql.raw(ACTIONS_SUIVI.map((a) => `'${a}'`).join(', '));

// Le chef de centre ou l'adjoint en fonction (`qui` : un identifiant ou la colonne d'une requête).
export const estChefOuAdjointSql = (qui: SQL | number, aujourdhui: string) =>
	sql`exists (select 1 from attribution a join responsabilite r on r.id = a.responsabilite_id where a.personne_id = ${qui} and r.systeme in (${SYSTEMES_SUIVI}) and a.debut <= ${aujourdhui} and (a.fin is null or a.fin >= ${aujourdhui}))`;

// Les nouveautés du suivi de `qui` (la colonne « personne » d'une requête sur personne), au plus NOUVEAUTES_MAX ; nul hors chefs.
export const nouveautesSuiviSql = (aujourdhui: string) =>
	sql<number | null>`case when ${estChefOuAdjointSql(sql`"personne"."id"`, aujourdhui)} then (select count(*) from (select 1 from journal j where j.id > coalesce("personne"."suivi_vu", 0) and j.action in (${actions()}) and j.acteur <> 'personne:' || "personne"."id" order by j.id desc limit ${NOUVEAUTES_MAX})) end`;

// Le nom de ce que vise une ligne du journal, selon sa cible ; et, pour une nomination, le rôle et l'agent (pour le lien).
const cibleSql = sql<string | null>`case "journal"."cible_type"
	when 'personne' then (select p.prenom || ' ' || p.nom from personne p where p.id = "journal"."cible_id")
	when 'attribution' then (select p.prenom || ' ' || p.nom from attribution a join personne p on p.id = a.personne_id where a.id = "journal"."cible_id")
	when 'planning' then (select m.theme from manoeuvre m where m.id = "journal"."cible_id")
	when 'responsabilite' then (select r.nom from responsabilite r where r.id = "journal"."cible_id")
	when 'comite' then (select c.nom from comite c where c.id = "journal"."cible_id")
	when 'engin' then (select e.nom from engin e where e.id = "journal"."cible_id")
	when 'type_engin' then (select t.nom from type_engin t where t.id = "journal"."cible_id")
	when 'ressource' then (select r.nom from ressource r where r.id = "journal"."cible_id")
	when 'reservation' then (select r.nom from reservation x join ressource r on r.id = x.ressource_id where x.id = "journal"."cible_id")
	when 'profil' then (select p.nom from profil p where p.id = "journal"."cible_id")
	when 'aptitude' then (select a.nom from aptitude a where a.id = "journal"."cible_id")
	when 'demande_remplacement' then (select p.prenom || ' ' || p.nom from demande_remplacement d join personne p on p.id = d.demandeur_id where d.id = "journal"."cible_id")
	when 'demande_habillement' then (select p.prenom || ' ' || p.nom from demande_habillement d join personne p on p.id = d.demandeur_id where d.id = "journal"."cible_id")
	when 'anomalie' then (select e.nom || ' · ' || a.libelle from anomalie a join engin e on e.id = a.engin_id where a.id = "journal"."cible_id")
end`;
const roleSql = sql<string | null>`case when "journal"."cible_type" = 'attribution' then (select r.nom from attribution a join responsabilite r on r.id = a.responsabilite_id where a.id = "journal"."cible_id") end`;
const agentDeLAttributionSql = sql<number | null>`case when "journal"."cible_type" = 'attribution' then (select a.personne_id from attribution a where a.id = "journal"."cible_id") end`;
// L'engin de l'anomalie, pour « rendu indisponible » et « remis en service ».
const enginDeLAnomalieSql = sql<string | null>`case when "journal"."cible_type" = 'anomalie' then (select e.nom from anomalie a join engin e on e.id = a.engin_id where a.id = "journal"."cible_id") end`;

function lienDe(l: { cibleType: string; cibleId: number | null; agent: number | null }): string | null {
	const id = l.cibleId;
	switch (l.cibleType) {
		case 'personne':
			return id === null ? '/agents' : `/agents/${id}`;
		case 'attribution':
			return l.agent === null ? '/nominations' : `/agents/${l.agent}`;
		case 'planning':
			return id === null ? '/planning/preparer' : `/planning/preparer/manoeuvre?id=${id}`;
		case 'responsabilite':
			return id === null ? '/reglages' : `/reglages/roles/${id}`;
		case 'comite':
			return id === null ? '/comites' : `/reglages/comites/${id}`;
		case 'engin':
			return id === null ? '/engins' : `/engins/${id}`;
		case 'type_engin':
			return id === null ? '/engins/fiches' : `/engins/fiches/${id}`;
		case 'ressource':
			return id === null ? '/reservations' : `/reservations/${id}`;
		case 'reservation':
			return '/reservations/a-valider';
		case 'profil':
			return id === null ? '/reglages' : `/reglages/profils/${id}`;
		case 'aptitude':
			return '/reglages/aptitudes';
		case 'demande_remplacement':
			return id === null ? '/remplacements' : `/remplacements/${id}`;
		case 'demande_habillement':
			return id === null ? '/habillement' : `/habillement/${id}`;
		case 'anomalie':
			return id === null ? '/engins/anomalies' : `/engins/anomalies/${id}`;
		case 'centre':
			return '/reglages';
		default:
			return null;
	}
}

const quiDe = (acteur: string, nom: string | null) => (acteur.startsWith('super:') ? 'Super administrateur' : acteur === 'planning' ? 'Planning' : (nom ?? 'Ancien agent'));

// Une page du suivi, du plus récent au plus ancien (`avant` : la suite, sous cet identifiant). Une requête. Ouvrir la première page
// marque la visite : les nouveautés de l'en-tête repartent de zéro.
export async function suiviDuCentre(base: Base, acteur: Acteur, aujourdhui: string, { avant }: { avant?: number } = {}): Promise<{ lignes: LigneSuivi[]; suite: number | null }> {
	exigerDate(aujourdhui);
	const moi = acteur.type === 'personne' ? acteur.id : 0;
	const visite = acteur.type === 'personne' && avant === undefined ? [base.update(personne).set({ suiviVu: sql`(select max(${journal.id}) from ${journal})` }).where(and(eq(personne.id, moi), estChefOuAdjointSql(moi, aujourdhui)))] : [];
	const [roles, lignes] = await base.batch([
		base
			.select({ debut: attribution.debut, fin: attribution.fin })
			.from(attribution)
			.innerJoin(responsabilite, eq(responsabilite.id, attribution.responsabiliteId))
			.where(and(eq(attribution.personneId, moi), inArray(responsabilite.systeme, ['chef_centre', 'chef_centre_adjoint']))),
		base
			.select({
				id: journal.id,
				quand: journal.quand,
				acteur: journal.acteur,
				action: journal.action,
				cibleType: journal.cibleType,
				cibleId: journal.cibleId,
				auteur: sql<string | null>`(select p.prenom || ' ' || p.nom from personne p where 'personne:' || p.id = "journal"."acteur")`,
				cible: cibleSql,
				role: roleSql,
				agent: agentDeLAttributionSql,
				engin: enginDeLAnomalieSql
			})
			.from(journal)
			// La liste écrite en clair : D1 ne lie que 100 paramètres par requête.
			.where(and(sql`${journal.action} in (${actions()})`, avant === undefined ? undefined : lt(journal.id, avant)))
			.orderBy(desc(journal.id))
			.limit(PAGE + 1),
		...visite
	]);
	if (acteur.type !== 'super' && !roles.some((r) => enCours(r.debut, r.fin, aujourdhui))) throw new RefusDroit('GERER_ACCES', { type: 'centre' }, 'Le suivi du centre est réservé au chef de centre et à l’adjoint');
	const page = lignes.slice(0, PAGE);
	return {
		lignes: page.map((l) => ({
			id: l.id,
			quand: l.quand,
			qui: quiDe(l.acteur, l.auteur),
			phrase: phrase(l.action, l.cibleType, { nom: l.action === 'rendre_indisponible' || l.action === 'remettre_en_service' ? l.engin : l.cible, role: l.role }),
			lien: lienDe(l)
		})),
		suite: lignes.length > PAGE ? page.at(-1)!.id : null
	};
}
