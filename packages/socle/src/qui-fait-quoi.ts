import { and, asc, eq, isNotNull, isNull } from 'drizzle-orm';
import type { Base } from './base.ts';
import { tenuesValides } from './casquettes.ts';
import { exigerDate } from './dates.ts';
import { accorde, droitsDe, type Acteur } from './droits.ts';
import { RefusDroit } from './erreurs.ts';
import { iconeDuComite, iconeDuRole, type NomIcone } from './icones.ts';
import { agentsDuJour, lecturesAgents } from './murs.ts';
import { comite, equipe, responsabilite, ressource } from './schema.ts';

export type RoleTenu = { id: number; nom: string; icone: NomIcone; titulaires: string[] };
export type QuiFaitQuoi = {
	comites: { id: number; nom: string; icone: NomIcone; mur: boolean; membres: { id: number; nom: string; roles: string[] }[]; ressources: { id: number; nom: string; icone: NomIcone; lien: boolean }[] }[];
	commandement: RoleTenu[];
	equipes: { id: number; nom: string; systeme: string | null; parEquipe: { equipe: string; titulaires: string[] }[] }[];
	referents: RoleTenu[];
};

// « Rapporteur de comité » se lit « Rapporteur » sous le nom du comité.
const roleCourt = (nom: string) => nom.replace(/\s+(de|du) comité$/i, '') || nom;

// Caserne → Comités et référents : qui tient quoi aujourd'hui, sans les droits. Pour les agents qui ont accès et le super administrateur.
// Les titulaires sont les agents qui ont accès (ni partis, ni suspendus, ni extérieurs), comme les membres des murs. Une seule requête (un batch).
export async function quiFaitQuoi(base: Base, acteur: Acteur, aujourdhui: string): Promise<QuiFaitQuoi> {
	exigerDate(aujourdhui);
	const [personnes, affectations, tenues, comites, roles, equipes, materiel] = await base.batch([
		...lecturesAgents(base, aujourdhui),
		base.select({ id: comite.id, nom: comite.nom, theme: comite.theme, icone: comite.icone }).from(comite).where(isNull(comite.dissousLe)).orderBy(asc(comite.nom)),
		base
			.select({ id: responsabilite.id, nom: responsabilite.nom, portee: responsabilite.typePerimetre, systeme: responsabilite.systeme, icone: responsabilite.icone, modele: responsabilite.modele })
			.from(responsabilite)
			.where(isNull(responsabilite.archiveeLe))
			.orderBy(asc(responsabilite.nom)),
		base.select({ id: equipe.id, nom: equipe.nom }).from(equipe).where(eq(equipe.active, 1)).orderBy(asc(equipe.ordreRotation)),
		base
			.select({ id: ressource.id, nom: ressource.nom, icone: ressource.icone, comiteId: ressource.gereeParComiteId })
			.from(ressource)
			.where(and(isNull(ressource.retireeLe), isNotNull(ressource.gereeParComiteId)))
			.orderBy(asc(ressource.nom))
	]);
	const agents = agentsDuJour([personnes, affectations, tenues], aujourdhui);
	const moi = acteur.type === 'super' ? null : agents.find((a) => a.id === acteur.id);
	if (acteur.type !== 'super' && !moi) throw new RefusDroit('VOIR_ANNUAIRE', { type: 'centre' }, 'Réservé aux agents du centre');
	// Mêmes règles que les murs (mursDe) : le chef, l'adjoint et le super administrateur lisent tous les comités, un agent les siens.
	const tous = moi === null || moi.a.tous;
	const droits = await droitsDe(base, acteur, aujourdhui);

	const nomDe = new Map(agents.map((a) => [a.id, `${a.prenom} ${a.nom}`]));
	const ordre = new Map([...agents].sort((x, y) => x.nom.localeCompare(y.nom, 'fr') || x.prenom.localeCompare(y.prenom, 'fr')).map((a, i) => [a.id, i]));
	const valides = tenuesValides(tenues).filter((t) => nomDe.has(t.personneId));
	const titulaires = (garde: (t: (typeof valides)[number]) => boolean) =>
		[...new Set(valides.filter(garde).map((t) => t.personneId))].sort((x, y) => ordre.get(x)! - ordre.get(y)!).map((id) => nomDe.get(id)!);
	const roleTenu = (r: (typeof roles)[number]): RoleTenu => ({ id: r.id, nom: r.nom, icone: iconeDuRole(r), titulaires: titulaires((t) => t.responsabiliteId === r.id) });

	return {
		comites: comites.map((c) => {
			const lignes = valides.filter((t) => t.type === 'comite' && t.perimetreId === c.id);
			const ids = [...new Set(lignes.map((t) => t.personneId))];
			// Le rapporteur (un rôle qui nomme) d'abord, puis par nom.
			const nomme = (id: number) => (lignes.some((t) => t.personneId === id && t.nomme !== null) ? 0 : 1);
			const membres = ids
				.sort((x, y) => nomme(x) - nomme(y) || ordre.get(x)! - ordre.get(y)!)
				.map((id) => ({ id, nom: nomDe.get(id)!, roles: [...new Set(lignes.filter((t) => t.personneId === id).map((t) => roleCourt(t.nom)))] }));
			const membre = moi?.a.membreComite.has(c.id) ?? false;
			return {
				id: c.id,
				nom: c.nom,
				icone: iconeDuComite(c),
				mur: tous || membre,
				membres,
				// Lien vers sa page pour qui peut la voir (reservations.ts) : qui la gère (le comité, le super administrateur) ou peut la réserver.
				ressources: materiel
					.filter((r) => r.comiteId === c.id)
					.map((r) => ({ id: r.id, nom: r.nom, icone: r.icone as NomIcone, lien: acteur.type === 'super' || membre || accorde(droits, 'RESERVER', { type: 'ressource', id: r.id }) }))
			};
		}),
		commandement: roles.filter((r) => r.systeme === 'chef_centre' || r.systeme === 'chef_centre_adjoint').map(roleTenu),
		equipes: roles
			.filter((r) => r.portee === 'equipe')
			.map((r) => ({
				id: r.id,
				nom: r.nom,
				systeme: r.systeme,
				parEquipe: equipes.map((e) => ({ equipe: e.nom, titulaires: titulaires((t) => t.responsabiliteId === r.id && t.perimetreId === e.id) }))
			})),
		referents: roles.filter((r) => r.portee === 'centre' && r.systeme === null).map(roleTenu)
	};
}
