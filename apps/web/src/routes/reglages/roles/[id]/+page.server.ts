import { error } from '@sveltejs/kit';
import {
	archiverResponsabilite,
	DonneeInvalide,
	DROITS,
	estDroitPouvoir,
	iconeDuRole,
	listerResponsabilites,
	MODELES,
	modifierResponsabilite,
	type Droit
} from '@gyro-caserne/socle';
import { aujourdhuiParis } from '#lib/aujourdhui.ts';
import { appliquerNiveaux, DOMAINES, niveauxDe, type DomaineId } from '#lib/paquets.ts';
import { accesReglages, attributeurDe, comitesChoix, echec, manque, niveauxChoisis, numero, texte, type Reponse, type Valeurs } from '#lib/server/formulaire-reglages.ts';
import type { Actions, PageServerLoad } from './$types';

type Nature = 'fonction' | 'mission';
type Portee = 'centre' | 'equipe' | 'comite';
const SYSTEME = 'Ce rôle fait partie du système : ses droits sont fixés, il ne se modifie pas.';

// Le rôle demandé, pour qui gère les responsabilités ; 404 s'il n'existe pas.
async function lireRole(locals: App.Locals, brut: string) {
	const aujourdhui = aujourdhuiParis();
	const acces = await accesReglages(locals, aujourdhui);
	if (!acces.listes) error(403, 'Accès réservé à qui gère les responsabilités du centre');
	const id = numero(brut);
	const role = id === null ? undefined : (await listerResponsabilites(acces.base, acces.acteur, aujourdhui)).find((r) => r.id === id);
	if (!role) error(404, 'Rôle introuvable');
	return { ...acces, aujourdhui, role };
}

// Pourquoi la page est en lecture seule, ou null.
function raison(role: Awaited<ReturnType<typeof lireRole>>['role']): string | null {
	if (role.systeme !== null) return SYSTEME;
	if (role.archiveeLe !== null) return 'Ce rôle est archivé : il ne se modifie plus.';
	if (role.protegee) return 'Ce rôle donne un droit d’administration : seuls le chef de centre, son adjoint et le super administrateur le modifient.';
	return null;
}

export const load: PageServerLoad = async ({ locals, params }) => {
	const { base, pouvoir, role } = await lireRole(locals, params.id);
	const modele = MODELES.find((m) => m.id === role.modele) ?? null;
	return {
		role,
		modele: modele && { id: modele.id, nom: modele.nom, droits: modele.droits },
		comitesChoix: await comitesChoix(base),
		raison: raison(role),
		droitsMetier: DROITS.filter((d) => !estDroitPouvoir(d)),
		droitsPouvoir: DROITS.filter(estDroitPouvoir)
	};
};

function valeursDe(formulaire: FormData): Valeurs {
	return {
		nom: texte(formulaire, 'nom') ?? '',
		nature: texte(formulaire, 'nature'),
		portee: texte(formulaire, 'portee'),
		attributeur: texte(formulaire, 'attributeur'),
		icone: texte(formulaire, 'icone')
	};
}

const pouvoirDe = (droits: Droit[]) => droits.filter(estDroitPouvoir);
const sansPouvoir = (droits: Droit[]) => droits.filter((d) => !estDroitPouvoir(d));

export const actions: Actions = {
	// Nom, icône, qui attribue, et les niveaux des domaines.
	enregistrer: async ({ locals, params, request }) => {
		const { acteur, base, aujourdhui, role } = await lireRole(locals, params.id);
		const formulaire = await request.formData();
		const valeurs = valeursDe(formulaire);
		const cible = 'role';
		if (role.systeme !== null) return manque(cible, SYSTEME);
		const qui = attributeurDe(valeurs.attributeur);
		if (!qui) return echec(new DonneeInvalide('Attributeur inconnu'), cible, valeurs);
		const actuels = role.droits.map((d) => d.droit as Droit);
		let droits = appliquerNiveaux(actuels, niveauxChoisis(formulaire));
		// Les cases d'administration ne sont envoyées que si l'acteur peut les changer ; sinon, on garde l'existant.
		if (texte(formulaire, 'administration') === 'oui') {
			const cochees = formulaire.getAll('admin').filter((d): d is Droit => typeof d === 'string' && (DROITS as readonly string[]).includes(d));
			droits = [...sansPouvoir(droits), ...pouvoirDe(cochees)];
		}
		try {
			await modifierResponsabilite(
				base,
				acteur,
				role.id,
				{
					nom: valeurs.nom ?? '',
					...(valeurs.nature ? { nature: valeurs.nature as Nature } : {}),
					...(valeurs.portee ? { portee: valeurs.portee as Portee } : {}),
					// L'icône affichée par défaut n'est enregistrée que si elle est choisie (autre que celle de repli).
					...(valeurs.icone && (role.icone !== null || valeurs.icone !== iconeDuRole(role)) ? { icone: valeurs.icone } : {}),
					attributeur: qui,
					droits
				},
				aujourdhui
			);
		} catch (erreur) {
			return echec(erreur, cible, valeurs);
		}
		return { cible, succes: `Le rôle « ${(valeurs.nom ?? '').trim()} » est enregistré.` } satisfies Reponse;
	},

	// Un domaine, ou tout le rôle (« tout »), comme son modèle.
	revenir: async ({ locals, params, request }) => {
		const { acteur, base, aujourdhui, role, pouvoir } = await lireRole(locals, params.id);
		const formulaire = await request.formData();
		const cible = 'role';
		if (role.systeme !== null) return manque(cible, SYSTEME);
		const modele = MODELES.find((m) => m.id === role.modele);
		if (!modele) return manque(cible, 'Ce rôle n’a pas de modèle.');
		const actuels = role.droits.map((d) => d.droit as Droit);
		const domaine = texte(formulaire, 'domaine');
		let droits: Droit[];
		// Comme à l'écran : seuls les domaines reviennent au niveau du modèle ; salons et droits hors domaine restent.
		const duModele = niveauxDe(modele.droits);
		const numeriques = Object.fromEntries(DOMAINES.flatMap((d) => (typeof duModele[d.id] === 'number' ? [[d.id, duModele[d.id]]] : []))) as Partial<Record<DomaineId, number>>;
		if (domaine === 'tout') {
			// Sans le pouvoir, les droits d'administration restent tels quels.
			droits = [...sansPouvoir(appliquerNiveaux(actuels, numeriques)), ...pouvoirDe(pouvoir ? modele.droits : actuels)];
		} else {
			const d = DOMAINES.find((x) => x.id === domaine);
			if (!d || numeriques[d.id] === undefined) return manque(cible, 'Domaine inconnu.');
			droits = appliquerNiveaux(actuels, { [d.id]: numeriques[d.id] });
		}
		try {
			await modifierResponsabilite(base, acteur, role.id, { droits }, aujourdhui);
		} catch (erreur) {
			return echec(erreur, cible);
		}
		return { cible, succes: domaine === 'tout' ? 'Le rôle est revenu à son modèle.' : 'Le domaine est revenu à son modèle.' } satisfies Reponse;
	},

	// Le détail droit par droit, pour les cas particuliers.
	detail: async ({ locals, params, request }) => {
		const { acteur, base, aujourdhui, role, pouvoir } = await lireRole(locals, params.id);
		const formulaire = await request.formData();
		const cible = 'detail';
		if (role.systeme !== null) return manque(cible, SYSTEME);
		const envoyes = formulaire.getAll('droits').filter((d): d is string => typeof d === 'string');
		// Une case désactivée n'est pas envoyée : on garde les droits verrouillés, et ceux de pouvoir si l'acteur ne le gère pas.
		const gardes = role.droits.filter((d) => d.verrouille || (!pouvoir && estDroitPouvoir(d.droit as Droit))).map((d) => d.droit);
		try {
			await modifierResponsabilite(base, acteur, role.id, { droits: [...new Set([...envoyes, ...gardes])] as Droit[] }, aujourdhui);
		} catch (erreur) {
			return echec(erreur, cible, { droits: envoyes });
		}
		return { cible, succes: 'Les droits sont enregistrés.' } satisfies Reponse;
	},

	archiver: async ({ locals, params, request }) => {
		const { acteur, base, aujourdhui, role } = await lireRole(locals, params.id);
		const formulaire = await request.formData();
		const cible = 'archiver';
		if (texte(formulaire, 'confirmation') !== 'oui') return manque(cible, 'Cochez « Je confirme » pour continuer.');
		try {
			await archiverResponsabilite(base, acteur, role.id, aujourdhui);
		} catch (erreur) {
			return echec(erreur, cible);
		}
		return { cible, succes: 'Le rôle est archivé.' } satisfies Reponse;
	}
};
