import { sql, type SQL } from 'drizzle-orm';
import { STATUTS_AVEC_ACCES } from '../listes.ts';

// Le nombre de demandes à valider par une personne, en SQL : même règle que valideurs() (contexte.ts), pour la cloche,
// sans requête de plus. Les chefs de l'équipe, ni demandeur ni remplaçant ; à défaut, le chef de centre et son adjoint.
const STATUTS = sql.raw(STATUTS_AVEC_ACCES.map((s) => `'${s}'`).join(', '));
const tient = (qui: SQL, systemes: string, equipe: SQL | null, aujourdhui: string) => sql`exists (select 1 from attribution a
	join responsabilite r on r.id = a.responsabilite_id
	join personne p on p.id = a.personne_id
	where ${qui} and r.systeme in (${sql.raw(systemes)}) and r.archivee_le is null and a.perimetre_type = r.type_perimetre
		and p.statut in (${STATUTS}) and a.debut <= ${aujourdhui} and (a.fin is null or a.fin >= ${aujourdhui})
		${equipe === null ? sql`` : sql`and a.perimetre_id = ${equipe}`})`;

export function aValiderPar(moi: number, aujourdhui: string, maintenant: string): SQL<number> {
	const equipe = sql`d.equipe_id`;
	return sql<number>`(select count(*) from demande_remplacement d where d.etat = 'a_valider' and d.debut > ${maintenant.slice(0, 16)} and d.demandeur_id <> ${moi} and coalesce(d.remplacant_id, 0) <> ${moi} and (
		${tient(sql`a.personne_id = ${moi}`, "'chef_equipe'", equipe, aujourdhui)}
		or (${tient(sql`a.personne_id = ${moi}`, "'chef_centre', 'chef_centre_adjoint'", null, aujourdhui)}
			and not ${tient(sql`a.personne_id <> d.demandeur_id and a.personne_id <> coalesce(d.remplacant_id, 0)`, "'chef_equipe'", equipe, aujourdhui)})))`;
}
