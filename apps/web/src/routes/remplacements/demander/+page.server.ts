import { fail, redirect } from '@sveltejs/kit';
import centre from '$centre';
import { demanderRemplacement, pourDemander, proposerEchange } from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { cle, lirePeriodes, type Etape } from '#lib/remplacements/guide.ts';
import { ouRefus } from '#lib/server/planning.ts';
import { exigerConnecte, refus } from '#lib/server/remplacements.ts';
import type { Actions, PageServerLoad } from './$types';

const entier = (brut: string | null) => (brut !== null && /^\d{1,9}$/.test(brut) ? Number(brut) : null);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

// Le parcours guidé, une page par étape ; tout l'état est dans l'adresse (marche sans JavaScript, retour possible).
// ?mode=echange · semaine · jour (pré-sélection) · p (mes périodes) · pour (tous ou un collègue) · avec · semaineAvec · ps (ses périodes) · q · etape.
export const load: PageServerLoad = async ({ locals, url }) => {
	const acteur = exigerConnecte(locals);
	if (acteur.type !== 'personne') redirect(303, '/remplacements');
	const maintenant = maintenantParis().slice(0, 16);
	const q = url.searchParams;
	const mode = q.get('mode') === 'echange' ? ('echange' as const) : ('remplacement' as const);
	const avecId = entier(q.get('avec'));
	const lu = await ouRefus(
		pourDemander(locals.base, acteur, maintenant, centre.astreinte, { periodes: lirePeriodes(q.getAll('p')), echange: mode === 'echange', avec: mode === 'echange' ? avecId : null, periodesAvec: lirePeriodes(q.getAll('ps')) }),
		'Réservé aux agents du centre.'
	);

	// La semaine ouverte : demandée, celle du jour pré-sélectionné, celle des périodes choisies, ou la seule.
	const jour = DATE.test(q.get('jour') ?? '') ? q.get('jour')! : null;
	const contient = (s: (typeof lu.semaines)[number], date: string) => s.tranches.some((t) => t.debut.slice(0, 10) === date);
	const semaine =
		lu.semaines.find((s) => s.semaine === q.get('semaine')) ??
		(jour ? lu.semaines.find((s) => contient(s, jour)) : undefined) ??
		lu.semaines.find((s) => lu.choisies.some((p) => contient(s, p.debut.slice(0, 10)))) ??
		(lu.semaines.length === 1 ? lu.semaines[0] : undefined) ??
		null;
	// Le jour pré-sélectionné (depuis la vue Semaine) : ses périodes libres.
	const choisies = lu.choisies.length > 0 || !jour || !semaine ? lu.choisies : semaine.tranches.filter((t) => t.etat === 'libre' && t.debut.startsWith(jour)).map(({ debut, fin }) => ({ debut, fin }));

	const siennes = lu.semainesAvec.flatMap((s) => s.tranches).filter((t) => t.etat === 'libre');
	const choisiesAvec = siennes.filter((t) => q.getAll('ps').includes(cle(t))).map(({ debut, fin }) => ({ debut, fin }));
	const semaineAvec = lu.semainesAvec.find((s) => s.semaine === q.get('semaineAvec')) ?? lu.semainesAvec.find((s) => s.tranches.some((t) => choisiesAvec.some((p) => p.debut === t.debut))) ?? (lu.semainesAvec.length === 1 ? lu.semainesAvec[0] : undefined) ?? null;

	const pourBrut = q.get('pour');
	const pour = pourBrut === 'tous' ? ('tous' as const) : (lu.candidats.find((c) => c.id === entier(pourBrut)) ?? null);

	// L'étape montrée : celle demandée, si les précédentes sont faites ; sinon la première qui manque.
	const demandee = q.get('etape') as Etape | null;
	const ordre: Etape[] = mode === 'echange' ? ['quand', 'avec', 'sienne', 'verifier'] : ['quand', 'qui', 'verifier'];
	const faite: Record<Etape, boolean> = { quand: choisies.length > 0, qui: pour !== null, avec: lu.avec !== null, sienne: choisiesAvec.length > 0, verifier: false };
	const index = Math.max(0, ordre.indexOf(demandee ?? 'quand'));
	const manquante = ordre.slice(0, index).find((e) => !faite[e]);
	const etape = manquante ?? ordre[index]!;
	// Revenu en arrière faute de choix : on le dit (seulement si l'agent avait demandé à avancer).
	const message = manquante && q.has('etape') ? MESSAGES[manquante] : null;

	return { mode, maintenant, etape, message, semaines: lu.semaines, semaine, choisies, candidats: lu.candidats, echangeables: lu.echangeables, pour, avec: lu.avec, semainesAvec: lu.semainesAvec, semaineAvec, choisiesAvec, recherche: q.get('q') ?? '', manqueMoi: lu.manqueMoi };
};

const MESSAGES: Record<Etape, string> = {
	quand: 'Choisissez au moins un jour.',
	qui: 'Choisissez « Tout le monde » ou un collègue.',
	avec: 'Choisissez le collègue avec qui échanger.',
	sienne: 'Choisissez au moins un jour de son astreinte.',
	verifier: ''
};

const textes = (f: FormData, nom: string) => f.getAll(nom).filter((v): v is string => typeof v === 'string');

export const actions: Actions = {
	default: async ({ locals, request }) => {
		const acteur = exigerConnecte(locals);
		const f = await request.formData();
		const maintenant = maintenantParis();
		const periodes = lirePeriodes(textes(f, 'periode'));
		const mot = typeof f.get('mot') === 'string' ? (f.get('mot') as string) : null;
		if (periodes.length === 0) return fail(400, { message: 'Choisissez au moins un jour.' });
		let id: number;
		try {
			if (f.get('mode') === 'echange') {
				const collegue = entier(typeof f.get('avec') === 'string' ? (f.get('avec') as string) : null);
				const periodesCible = lirePeriodes(textes(f, 'periodeCible'));
				if (collegue === null) return fail(400, { message: 'Choisissez le collègue avec qui échanger.' });
				if (periodesCible.length === 0) return fail(400, { message: 'Choisissez au moins un jour de son astreinte.' });
				id = await proposerEchange(locals.base, acteur, { periodes, cibleId: collegue, periodesCible, mot }, maintenant, centre.astreinte);
			} else {
				const pour = f.get('pour');
				const cible = pour === 'tous' ? null : entier(typeof pour === 'string' ? pour : null);
				if (pour !== 'tous' && cible === null) return fail(400, { message: 'Choisissez « Tout le monde » ou un collègue.' });
				id = await demanderRemplacement(locals.base, acteur, { periodes, cibleId: cible, mot }, maintenant, centre.astreinte);
			}
		} catch (erreur) {
			return refus(erreur);
		}
		redirect(303, `/remplacements/${id}?envoyee`);
	}
};
