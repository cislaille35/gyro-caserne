import { redirect } from '@sveltejs/kit';
import centre from '$centre';
import { accueilDe, astreinteDe, apercusDesMurs, monAnniversaire, prenomDe } from '@gyro-caserne/socle';
import { aujourdhuiParis, maintenantParis } from '#lib/aujourdhui.ts';
import { aNePasManquerDe } from '#lib/server/a-faire.ts';
import { gestes } from '#lib/server/gestes-mur.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const { acteur, base } = locals;
	if (!acteur) redirect(303, '/connexion');
	const aujourdhui = aujourdhuiParis();
	const maintenant = maintenantParis().slice(0, 16);
	const [accueil, prenom, aNePasManquer, anniversaire, astreinte] = await Promise.all([
		accueilDe(base, acteur, url.searchParams.get('casquette'), aujourdhui, maintenant),
		prenomDe(base, acteur),
		aNePasManquerDe(base, acteur),
		monAnniversaire(base, acteur, aujourdhui),
		acteur.type === 'personne' ? astreinteDe(base, acteur, maintenant, centre.astreinte) : null
	]);
	// Les nouveautés montrent la pastille de leur mur : lue seulement s'il y en a.
	const apercus = aNePasManquer.nouveautes.length > 0 ? await apercusDesMurs(base, acteur, aujourdhuiParis()) : [];
	const nouveautes = aNePasManquer.nouveautes.map((n) => {
		const m = apercus.find((x) => x.cle === n.cle);
		return { ...n, icone: m?.icone ?? null, couleur: m?.couleur ?? null, numero: m?.numero ?? null };
	});
	return { prenom, ...accueil, aNePasManquer: { ...aNePasManquer, nouveautes }, anniversaire, aujourdhui, astreinte, maintenant };
};

// « À ne pas manquer » : prise de connaissance et réponse à un événement sur place. Le socle vérifie les droits.
export const actions: Actions = {
	prendreConnaissance: ({ locals, request }) => gestes.prendreConnaissance({ locals, params: {}, request }),
	repondre: ({ locals, request }) => gestes.repondre({ locals, params: {}, request })
};
