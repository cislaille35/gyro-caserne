import { fail, redirect } from '@sveltejs/kit';
import centre from '$centre';
import { manoeuvresEchangeables, proposerEchangeManoeuvre } from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { ouRefus } from '#lib/server/planning.ts';
import { exigerConnecte, refus } from '#lib/server/remplacements.ts';
import type { Actions, PageServerLoad } from './$types';

const entier = (brut: string | null) => (brut !== null && /^\d{1,9}$/.test(brut) ? Number(brut) : null);

// « Échanger ma place à une manœuvre », parcours court : ma manœuvre (sautée si elle est donnée, depuis le planning, ou seule),
// celle d'un collègue, vérifier. ?mienne · sienne=<collègue>:<manœuvre> · etape · depuis=planning.
export const load: PageServerLoad = async ({ locals, url }) => {
	const acteur = exigerConnecte(locals);
	if (acteur.type !== 'personne') redirect(303, '/remplacements');
	const q = url.searchParams;
	const lu = await ouRefus(manoeuvresEchangeables(locals.base, acteur, maintenantParis(), centre.astreinte), 'Réservé aux agents du centre.');
	const demandee = q.has('mienne') ? (lu.miennes.find((m) => m.id === entier(q.get('mienne'))) ?? null) : null;
	// Venue du planning, une manœuvre qui ne s'échange pas (tout le centre, déjà passée) : on le dit, et l'agent choisit.
	const introuvable = q.has('mienne') && demandee === null;
	const mienne = demandee ?? (lu.miennes.length === 1 && !introuvable ? lu.miennes[0]! : null);
	// Les collègues qui peuvent prendre ma place : pas ceux déjà convoqués à ma manœuvre.
	const collegues = mienne ? lu.collegues.filter((x) => !x.aussiA.includes(mienne.id)) : lu.collegues;
	const [c, m] = (q.get('sienne') ?? '').split(':').map((x) => entier(x));
	const collegue = collegues.find((x) => x.id === c) ?? null;
	const sienne = collegue?.manoeuvres.find((x) => x.id === m) ? { collegue, manoeuvre: collegue.manoeuvres.find((x) => x.id === m)! } : null;
	const court = mienne !== null && (lu.miennes.length === 1 || q.get('depuis') === 'planning');
	const ordre = court ? (['sienne', 'verifier'] as const) : (['mienne', 'sienne', 'verifier'] as const);
	const faite = { mienne: mienne !== null, sienne: sienne !== null, verifier: false };
	const etapeDemandee = ordre.find((e) => e === q.get('etape')) ?? ordre[0];
	const manquante = ordre.slice(0, ordre.indexOf(etapeDemandee as never)).find((e) => !faite[e]);
	const message = introuvable ? 'Cette manœuvre ne s’échange pas (elle convoque tout le centre, ou elle est passée) : choisissez-en une autre.' : manquante && q.has('etape') ? (manquante === 'mienne' ? 'Choisissez votre manœuvre.' : 'Choisissez la manœuvre d’un collègue.') : null;
	return { miennes: lu.miennes, collegues, mienne, sienne, court, etape: manquante ?? etapeDemandee, message };
};

export const actions: Actions = {
	default: async ({ locals, request }) => {
		const acteur = exigerConnecte(locals);
		const f = await request.formData();
		const mienne = Number(f.get('mienne'));
		const [cible, sienne] = String(f.get('sienne') ?? '').split(':').map(Number);
		if (!mienne || !cible || !sienne) return fail(400, { message: 'Choisissez votre manœuvre et celle du collègue.' });
		let id: number;
		try {
			id = await proposerEchangeManoeuvre(locals.base, acteur, { manoeuvreId: mienne, cibleId: cible, manoeuvreCibleId: sienne, mot: typeof f.get('mot') === 'string' ? (f.get('mot') as string) : null }, maintenantParis(), centre.astreinte);
		} catch (erreur) {
			return refus(erreur);
		}
		redirect(303, `/remplacements/${id}?envoyee`);
	}
};
