import { and, desc, eq, gte, inArray, lt, sql, type SQL } from 'drizzle-orm';
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

// La phrase de chaque action suivie, après le nom de son auteur, rangée par sujet (les filtres de la page).
const PAR_SUJET = {
	planning: {
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
	// Les urgences signalées par l'appli
	alerter_sans_chef: (c) => `signale ${c.nom ? `l’équipe ${c.nom.replace(/^Équipe /, '')}` : 'une équipe'} sans chef de garde pour la relève de demain`
	},
	nominations: {
	attribuer: (c) => `a nommé ${agent(c)}${c.role ? ` : ${c.role}` : ''}`,
	terminer_attribution: (c) => `a retiré un rôle à ${agent(c)}${c.role ? ` : ${c.role}` : ''}`,
	finir_attribution: (c) => `a fixé la fin d’un rôle ${deAgent(c)}${c.role ? ` : ${c.role}` : ''}`
	},
	reglages: {
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
	retirer_aptitude: (c) => nomme(c, 'a retiré l’aptitude')
	},
	// Fiches des agents (et fiches d'engins : même action, cible différente)
	agents: {
	ajouter_personne: (c) => `a ajouté ${agent(c)}`,
	modifier_fiche: (c) => `a modifié la fiche ${deAgent(c)}`,
	changer_statut: (c) => `a changé le statut ${deAgent(c)}`,
	affecter_equipe: (c) => `a changé l’équipe ${deAgent(c)}`,
	retirer_equipe: (c) => `a retiré ${agent(c)} de son équipe`,
	effacer_agent: () => 'a effacé les données d’un ancien agent',
	donner_aptitude: (c) => `a donné une aptitude à ${agent(c)}`,
	oter_aptitude: (c) => `a retiré une aptitude à ${agent(c)}`
	},
	// Décisions sur les demandes, et remplacements validés ou refusés par le chef de garde
	demandes: {
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
	valider_remplacement: (c) => `a validé le remplacement ${deAgent(c)}`,
	refuser_validation: (c) => `a refusé le remplacement ${deAgent(c)}`
	}
} satisfies Record<string, Record<string, (c: Cible) => string>>;

// L'ordre des filtres de la page.
export const SUJETS_SUIVI = ['planning', 'nominations', 'demandes', 'agents', 'reglages'] as const;
export type SujetSuivi = (typeof SUJETS_SUIVI)[number];
const PHRASES: Record<string, (c: Cible) => string> = Object.assign({}, ...SUJETS_SUIVI.map((s) => PAR_SUJET[s]));
export const ACTIONS_SUIVI = Object.keys(PHRASES) as readonly string[];
export const actionsDuSujet = (sujet: SujetSuivi) => Object.keys(PAR_SUJET[sujet]);
const PAGE = 25;
// Au-delà, l'en-tête n'en dit pas plus : la lecture s'arrête là.
export const NOUVEAUTES_MAX = 99;
// Seules les 1 000 dernières lignes du journal comptent, même pour qui n'a jamais visité ou est parti longtemps (lecture bornée).
const FENETRE = 1000;
const deux = (n: number) => String(n).padStart(2, '0');
// Le suivi montre les trois derniers mois (le journal garde tout) : le même jour, trois mois plus tôt (le 31 mai → le 28 février).
export function ilYaTroisMois(jour: string): string {
	const [a, m, j] = jour.split('-').map(Number) as [number, number, number];
	const debut = new Date(Date.UTC(a, m - 4, 1));
	const dernier = new Date(Date.UTC(a, m - 3, 0)).getUTCDate();
	return `${debut.getUTCFullYear()}-${deux(debut.getUTCMonth() + 1)}-${deux(Math.min(j, dernier))}`;
}

// Les fiches d'engins sont journalisées « modifier_fiche » sur un type d'engin.
const phrase = (action: string, cibleType: string, c: Cible) => (action === 'modifier_fiche' && cibleType === 'type_engin' ? nomme(c, 'a modifié la fiche de') : (PHRASES[action]?.(c) ?? action));

export type LigneSuivi = { id: number; quand: string; qui: string; phrase: string; lien: string | null };

const SYSTEMES_SUIVI = sql.raw(`'chef_centre', 'chef_centre_adjoint'`);
// Écrites une fois : les listes d'actions (toutes, puis par sujet), en clair dans le SQL.
const enClair = (liste: readonly string[]) => sql.raw(liste.map((a) => `'${a}'`).join(', '));
const ACTIONS_SQL = enClair(ACTIONS_SUIVI);
const SUJETS_SQL = Object.fromEntries(SUJETS_SUIVI.map((s) => [s, enClair(actionsDuSujet(s))])) as Record<SujetSuivi, SQL>;
const actions = (sujet?: SujetSuivi) => (sujet ? SUJETS_SQL[sujet] : ACTIONS_SQL);

// Le chef de centre ou l'adjoint en fonction (`qui` : un identifiant ou la colonne d'une requête).
export const estChefOuAdjointSql = (qui: SQL | number, aujourdhui: string) =>
	sql`exists (select 1 from attribution a join responsabilite r on r.id = a.responsabilite_id where a.personne_id = ${qui} and r.systeme in (${SYSTEMES_SUIVI}) and a.debut <= ${aujourdhui} and (a.fin is null or a.fin >= ${aujourdhui}))`;

// Les nouveautés du suivi de `qui` (la colonne « personne » d'une requête sur personne), au plus NOUVEAUTES_MAX ; nul hors chefs.
export const nouveautesSuiviSql = (aujourdhui: string) =>
	sql<number | null>`case when ${estChefOuAdjointSql(sql`"personne"."id"`, aujourdhui)} then (select count(*) from (select 1 from journal j where j.id > max(coalesce("personne"."suivi_vu", 0), coalesce((select max(id) from journal), 0) - ${FENETRE}) and j.quand >= ${ilYaTroisMois(aujourdhui)} and j.action in (${actions()}) and j.acteur <> 'personne:' || "personne"."id" order by j.id desc limit ${NOUVEAUTES_MAX})) end`;

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
	when 'equipe' then (select e.nom from equipe e where e.id = "journal"."cible_id")
	when 'anomalie' then (select e.nom || ' · ' || a.libelle from anomalie a join engin e on e.id = a.engin_id where a.id = "journal"."cible_id")
end`;
const roleSql = sql<string | null>`case when "journal"."cible_type" = 'attribution' then (select r.nom from attribution a join responsabilite r on r.id = a.responsabilite_id where a.id = "journal"."cible_id") end`;
const agentDeLAttributionSql = sql<number | null>`case when "journal"."cible_type" = 'attribution' then (select a.personne_id from attribution a where a.id = "journal"."cible_id") end`;
// L'engin de l'anomalie, pour « rendu indisponible » et « remis en service ».
const enginDeLAnomalieSql = sql<string | null>`case when "journal"."cible_type" = 'anomalie' then (select e.nom from anomalie a join engin e on e.id = a.engin_id where a.id = "journal"."cible_id") end`;

function lienDe(l: { action: string; cibleType: string; cibleId: number | null; agent: number | null }): string | null {
	// Une manœuvre retirée n'existe plus : le planning à préparer.
	const id = l.action === 'supprimer_manoeuvre' ? null : l.cibleId;
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
		case 'equipe':
			return '/nominations';
		default:
			return null;
	}
}

const quiDe = (acteur: string, nom: string | null) => (acteur.startsWith('super:') ? 'Super administrateur' : acteur === 'planning' ? 'Planning' : acteur === 'nuit' ? 'Ménage de nuit' : (nom ?? 'Ancien agent'));

// Une page du suivi, du plus récent au plus ancien, sur trois mois (`avant` : la suite, sous cet identifiant ; `sujet` : un filtre).
// Une requête. L'arrivée (sans `vu` ni `avant`) lit la dernière visite (`vu` : la dernière ligne vue, nulle sans visite) puis la
// marque : les nouveautés de l'en-tête repartent de zéro. Ensuite, filtres et suite redonnent cette marque (`vu`) : elle place le
// repère, et rien n'est marqué.
export async function suiviDuCentre(
	base: Base,
	acteur: Acteur,
	aujourdhui: string,
	{ avant, sujet, vu }: { avant?: number; sujet?: SujetSuivi; vu?: number } = {}
): Promise<{ lignes: LigneSuivi[]; suite: number | null; vu: number | null }> {
	exigerDate(aujourdhui);
	const moi = acteur.type === 'personne' ? acteur.id : 0;
	const arrivee = acteur.type === 'personne' && avant === undefined && vu === undefined;
	const visite = arrivee ? [base.update(personne).set({ suiviVu: sql`(select max(${journal.id}) from ${journal})` }).where(and(eq(personne.id, moi), estChefOuAdjointSql(moi, aujourdhui)))] : [];
	const [roles, lignes] = await base.batch([
		base
			// Lue avant d'être marquée : le lot s'exécute dans l'ordre.
			.select({ debut: attribution.debut, fin: attribution.fin, vu: sql<number | null>`(select p.suivi_vu from personne p where p.id = ${moi})` })
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
				// Par la clé de la fiche : l'index sert.
				auteur: sql<string | null>`(select p.prenom || ' ' || p.nom from personne p where "journal"."acteur" like 'personne:%' and p.id = cast(substr("journal"."acteur", 10) as integer))`,
				cible: cibleSql,
				role: roleSql,
				agent: agentDeLAttributionSql,
				engin: enginDeLAnomalieSql
			})
			.from(journal)
			// La liste écrite en clair : D1 ne lie que 100 paramètres par requête.
			.where(and(sql`${journal.action} in (${actions(sujet)})`, gte(journal.quand, ilYaTroisMois(aujourdhui)), avant === undefined ? undefined : lt(journal.id, avant)))
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
		suite: lignes.length > PAGE ? page.at(-1)!.id : null,
		vu: vu ?? (arrivee ? (roles[0]?.vu ?? null) : null)
	};
}
