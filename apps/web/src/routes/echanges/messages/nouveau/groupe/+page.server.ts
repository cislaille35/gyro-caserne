import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { annuaire, comite, creerGroupe, DonneeInvalide, equipe, iconeDuComite, membresPourGroupe, NOMS_ICONES, RefusDroit } from '@gyro-caserne/socle';
import { aujourdhuiParis, maintenantParis } from '#lib/aujourdhui.ts';
import { exigerActeur } from '#lib/server/formulaire-mur.ts';
import type { Actions, PageServerLoad } from './$types';

type Valeurs = { nom: string; icone: string; membres: number[] };
export type Reponse = { erreurs: Record<string, string>; valeurs: Valeurs };

const icone = (valeur: string | null) => ((NOMS_ICONES as readonly string[]).includes(valeur ?? '') ? valeur! : 'groupe');
const ids = (valeurs: (string | File)[]) => [...new Set(valeurs.map(Number).filter((n) => Number.isInteger(n) && n > 0))];
const idDe = (valeur: string | null) => (valeur !== null && /^[1-9]\d*$/.test(valeur) ? Number(valeur) : null);

const refus = (erreur: unknown) => {
	if (erreur instanceof RefusDroit) redirect(303, '/echanges?refus=messagerie');
	throw erreur;
};

// Le raccourci « Groupe avec l'équipe N » ou « Groupe avec <comité> » : ses membres du jour, son nom et son icône.
async function raccourci(locals: App.Locals, url: URL, aujourdhui: string) {
	const acteur = exigerActeur(locals);
	const idEquipe = idDe(url.searchParams.get('equipe'));
	const idComite = idDe(url.searchParams.get('comite'));
	if (idEquipe !== null) {
		const [membres, [e]] = await Promise.all([membresPourGroupe(locals.base, acteur, { equipe: idEquipe }, aujourdhui), locals.base.select({ nom: equipe.nom }).from(equipe).where(eq(equipe.id, idEquipe))]);
		return e ? { membres, nom: e.nom, icone: 'groupe' } : null;
	}
	if (idComite !== null) {
		const [membres, [c]] = await Promise.all([membresPourGroupe(locals.base, acteur, { comite: idComite }, aujourdhui), locals.base.select({ nom: comite.nom, theme: comite.theme, icone: comite.icone }).from(comite).where(eq(comite.id, idComite))]);
		return c ? { membres, nom: c.nom, icone: iconeDuComite(c) } : null;
	}
	return null;
}

// Deux étapes, qui marchent aussi sans JavaScript : les membres (formulaire GET), puis le nom et l'icône.
export const load: PageServerLoad = async ({ locals, url }) => {
	const acteur = exigerActeur(locals);
	const aujourdhui = aujourdhuiParis();
	const p = url.searchParams;
	try {
		const [agents, prerempli] = await Promise.all([annuaire(locals.base, acteur, aujourdhui), raccourci(locals, url, aujourdhui)]);
		const personnes = agents.map((a) => ({ id: a.id, prenom: a.prenom, nom: a.nom, surnom: a.surnom, couleur: a.equipe?.couleur ?? null, sous: a.role ?? (a.equipe ? `Équipe ${a.equipe.numero}` : '') }));
		const connus = new Set(personnes.map((x) => x.id));
		const coches = prerempli?.membres ?? ids(p.getAll('membres')).filter((id) => connus.has(id));
		const vers = p.get('etape') === 'nom';
		const erreur = vers && coches.length === 0 ? 'Choisissez au moins une personne.' : null;
		return {
			etape: vers && !erreur ? ('nom' as const) : ('membres' as const),
			personnes,
			coches,
			nom: prerempli?.nom ?? (p.get('nom') ?? '').slice(0, 60),
			icone: prerempli?.icone ?? icone(p.get('icone')),
			erreur
		};
	} catch (erreur) {
		return refus(erreur);
	}
};

// Les refus du socle, reliés à leur champ et dits simplement.
const ERREURS: Record<string, [champ: string, texte: string]> = {
	'Nom du groupe vide': ['nom', 'Donnez un nom au groupe.'],
	'Nom du groupe trop long': ['nom', 'Nom trop long : 60 caractères au plus.'],
	'Icône inconnue': ['icone', 'Choisissez une icône de la liste.'],
	'Choisissez au moins une personne': ['membres', 'Choisissez au moins une personne.'],
	'60 membres au plus': ['membres', '60 membres au plus, vous compris.'],
	'Une personne n’est pas dans l’annuaire': ['membres', 'Une personne choisie n’est plus dans l’annuaire.']
};

export const actions: Actions = {
	creer: async ({ locals, request }) => {
		const acteur = exigerActeur(locals);
		const f = await request.formData();
		const valeurs: Valeurs = { nom: String(f.get('nom') ?? ''), icone: String(f.get('icone') ?? 'groupe'), membres: ids(f.getAll('membres')) };
		let id: number;
		try {
			id = await creerGroupe(locals.base, acteur, valeurs, maintenantParis());
		} catch (erreur) {
			const connue = erreur instanceof DonneeInvalide ? ERREURS[erreur.message] : undefined;
			if (connue) return fail<Reponse>(400, { erreurs: { [connue[0]]: connue[1] }, valeurs });
			return refus(erreur);
		}
		redirect(303, `/echanges/messages/${id}`);
	}
};
