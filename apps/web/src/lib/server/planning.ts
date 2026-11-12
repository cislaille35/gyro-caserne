import centre from '$centre';
import { error, redirect } from '@sveltejs/kit';
import { planningDuMatin, RefusDroit, type Acteur } from '@gyro-caserne/socle';
import { aujourdhuiParis, maintenantParis } from '#lib/aujourdhui.ts';
import { enArrierePlan } from '#lib/server/notifier.ts';

// L'année demandée (?annee=), sinon l'année en cours à Paris.
export function anneeDe(url: URL): number {
	const brut = url.searchParams.get('annee') ?? '';
	const courante = Number(aujourdhuiParis().slice(0, 4));
	const n = /^\d{4}$/.test(brut) ? Number(brut) : courante;
	return n >= courante - 5 && n <= courante + 5 ? n : courante;
}

export function connecte(locals: App.Locals): { acteur: Acteur; base: App.Locals['base'] } {
	if (!locals.acteur) redirect(303, '/connexion');
	return { acteur: locals.acteur, base: locals.base };
}

// Un refus du socle devient une page 403 claire.
export async function ouRefus<T>(promesse: Promise<T>, message: string): Promise<T> {
	try {
		return await promesse;
	} catch (erreur) {
		if (erreur instanceof RefusDroit) error(403, message);
		throw erreur;
	}
}

// Une manœuvre enregistrée ou une année publiée en journée est annoncée tout de suite (si elle tombe dans les deux semaines) ;
// le soir et la nuit, elle attend le passage de 8 h, pour ne pas faire sonner les téléphones.
export const heureDAnnoncer = (maintenant: string) => maintenant.slice(11, 16) >= '08:00' && maintenant.slice(11, 16) < '21:00';

export function annoncerSiJournee(locals: App.Locals) {
	const maintenant = maintenantParis();
	if (heureDAnnoncer(maintenant)) enArrierePlan(locals, () => planningDuMatin(locals.base, maintenant, centre.manoeuvres.petitDejeuner));
}
