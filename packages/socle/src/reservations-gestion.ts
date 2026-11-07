import { sql, type SQL } from 'drizzle-orm';
import { STATUTS_AVEC_ACCES } from './listes.ts';

// Qui gère une ressource, en SQL : sans dépendance, pour les réservations et la pastille des notifications.
const STATUTS = sql.raw(STATUTS_AVEC_ACCES.map((s) => `'${s}'`).join(', '));

// La personne gère la ressource de la ligne courante (table `ressource`) : elle a accès et tient aujourd'hui le rôle gestionnaire,
// ou un rôle dans le comité gestionnaire (non dissous). Rôle archivé ou hors de son type de périmètre : rien.
export function gere(personneId: SQL | number, aujourdhui: string): SQL {
	return sql`exists (select 1 from attribution a
		join responsabilite x on x.id = a.responsabilite_id
		join personne p on p.id = a.personne_id
		where a.personne_id = ${personneId} and p.statut in (${STATUTS}) and x.archivee_le is null and a.perimetre_type = x.type_perimetre
			and a.debut <= ${aujourdhui} and (a.fin is null or a.fin >= ${aujourdhui})
			and (a.responsabilite_id = "ressource"."geree_par_responsabilite_id"
				or (a.perimetre_type = 'comite' and a.perimetre_id = "ressource"."geree_par_comite_id"
					and exists (select 1 from comite c where c.id = a.perimetre_id and c.dissous_le is null))))`;
}

// Le même nombre en SQL, pour une personne ou la colonne d'une requête (la pastille de chaque personne d'un lot d'envois).
export const aTrancherPar = (qui: SQL | number, aujourdhui: string) =>
	sql<number>`(select count(*) from reservation join ressource on ressource.id = reservation.ressource_id where reservation.etat = 'attente' and ressource.retiree_le is null and substr(reservation.fin, 1, 10) >= ${aujourdhui} and ${gere(qui, aujourdhui)})`;
