import { error, fail, redirect } from '@sveltejs/kit';
import { ajouterMembres, annuaire, creerGroupe, DonneeInvalide, infosConversation, membresPourGroupe, NOMS_ICONES, RefusDroit } from '@gyro-caserne/socle';
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
// Inconnu, inactif ou dissous : rien n'est prérempli.
async function raccourci(locals: App.Locals, url: URL, aujourdhui: string) {
	const equipe = idDe(url.searchParams.get('equipe'));
	const comite = idDe(url.searchParams.get('comite'));
	const source = equipe !== null ? { equipe } : comite !== null ? { comite } : null;
	if (!source) return null;
	try {
		return await membresPourGroupe(locals.base, exigerActeur(locals), source, aujourdhui);
	} catch (erreur) {
		if (erreur instanceof DonneeInvalide) return null;
		throw erreur;
	}
}

// « Ajouter des membres » (?ajouter=<groupe>) : réservé aux animateurs, qui choisissent parmi ceux qui n'en sont pas.
async function groupeOuNull(locals: App.Locals, url: URL, aujourdhui: string) {
	const brut = url.searchParams.get('ajouter');
	if (brut === null) return null;
	const id = idDe(brut);
	if (id === null) error(404, 'Groupe introuvable');
	try {
		const infos = await infosConversation(locals.base, exigerActeur(locals), id, aujourdhui);
		if (infos.type !== 'groupe') error(404, 'Groupe introuvable');
		if (!infos.moiAnimateur) error(403, 'Seuls les animateurs du groupe peuvent ajouter des membres.');
		return { id, nom: infos.nom, membres: new Set(infos.membres.map((m) => m.id)) };
	} catch (erreur) {
		if (erreur instanceof RefusDroit && erreur.message === 'Conversation non accessible') error(404, 'Groupe introuvable');
		throw erreur;
	}
}

// Deux étapes, qui marchent aussi sans JavaScript : les membres (formulaire GET), puis le nom et l'icône.
// Pour ajouter des membres à un groupe, la première étape seule.
export const load: PageServerLoad = async ({ locals, url }) => {
	const acteur = exigerActeur(locals);
	const aujourdhui = aujourdhuiParis();
	const p = url.searchParams;
	try {
		const [agents, prerempli, groupe] = await Promise.all([annuaire(locals.base, acteur, aujourdhui), raccourci(locals, url, aujourdhui), groupeOuNull(locals, url, aujourdhui)]);
		const personnes = agents
			.filter((a) => !groupe?.membres.has(a.id))
			.map((a) => ({ id: a.id, prenom: a.prenom, nom: a.nom, surnom: a.surnom, couleur: a.equipe?.couleur ?? null, sous: a.role ?? (a.equipe ? `Équipe ${a.equipe.numero}` : '') }));
		const connus = new Set(personnes.map((x) => x.id));
		const coches = prerempli?.membres ?? ids(p.getAll('membres')).filter((id) => connus.has(id));
		const vers = !groupe && p.get('etape') === 'nom';
		const erreur = vers && coches.length === 0 ? 'Choisissez au moins une personne.' : null;
		return {
			etape: vers && !erreur ? ('nom' as const) : ('membres' as const),
			personnes,
			coches,
			nom: prerempli?.nom ?? (p.get('nom') ?? '').slice(0, 60),
			icone: prerempli?.icone ?? icone(p.get('icone')),
			erreur,
			ajouter: groupe && { id: groupe.id, nom: groupe.nom }
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
	'Une personne n’est pas dans l’annuaire': ['membres', 'Une personne choisie n’est plus dans l’annuaire.'],
	'Déjà membre du groupe': ['membres', 'Une personne choisie fait déjà partie du groupe.']
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
	},
	ajouter: async ({ locals, request, url }) => {
		const acteur = exigerActeur(locals);
		const id = idDe(url.searchParams.get('ajouter'));
		if (id === null) error(404, 'Groupe introuvable');
		const valeurs: Valeurs = { nom: '', icone: 'groupe', membres: ids((await request.formData()).getAll('membres')) };
		try {
			await ajouterMembres(locals.base, acteur, id, valeurs.membres, maintenantParis());
		} catch (erreur) {
			const connue = erreur instanceof DonneeInvalide ? ERREURS[erreur.message] : undefined;
			if (connue) return fail<Reponse>(400, { erreurs: { membres: connue[1] }, valeurs });
			if (erreur instanceof RefusDroit && erreur.message === 'Réservé aux animateurs du groupe') return fail<Reponse>(403, { erreurs: { membres: 'Seuls les animateurs du groupe peuvent ajouter des membres.' }, valeurs });
			if (erreur instanceof RefusDroit && erreur.message === 'Conversation non accessible') return fail<Reponse>(403, { erreurs: { membres: 'Vous ne faites plus partie de ce groupe.' }, valeurs });
			return refus(erreur);
		}
		redirect(303, `/echanges/messages/${id}/infos`);
	}
};
