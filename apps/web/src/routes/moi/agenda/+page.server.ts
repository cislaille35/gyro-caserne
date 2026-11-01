import { redirect } from '@sveltejs/kit';
import { aLeDroit, changerLienAgenda, monLienAgenda } from '@gyro-caserne/socle';
import { aujourdhuiParis, maintenantParis } from '#lib/aujourdhui.ts';
import type { Actions, PageServerLoad } from './$types';

// Le téléphone de l'agent, reconnu simplement, pour ouvrir d'office son mode d'emploi.
const appareilDe = (ua: string) => (/iPhone|iPad|iPod/.test(ua) ? ('iphone' as const) : /Android/.test(ua) ? ('android' as const) : null);

// Le lien d'abonnement de l'agent (créé à la première visite), en https et en webcal (iPhone).
export const load: PageServerLoad = async ({ locals, url, request }) => {
	const { acteur, base } = locals;
	if (!acteur) redirect(303, '/connexion');
	if (acteur.type !== 'personne') return { lien: null };
	if (!(await aLeDroit(base, acteur, 'VOIR_PLANNING', { type: 'centre' }, aujourdhuiParis()))) return { lien: null, sansPlanning: true };
	const lien = `${url.origin}/agenda/${await monLienAgenda(base, acteur, maintenantParis())}.ics`;
	return { lien, webcal: lien.replace(/^https?:\/\//, 'webcal://'), appareil: appareilDe(request.headers.get('user-agent') ?? '') };
};

export const actions: Actions = {
	changer: async ({ locals }) => {
		const { acteur, base } = locals;
		if (!acteur) redirect(303, '/connexion');
		if (acteur.type !== 'personne') return { change: false };
		await changerLienAgenda(base, acteur, maintenantParis());
		return { change: true };
	}
};
