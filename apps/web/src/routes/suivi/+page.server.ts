import { error, redirect } from '@sveltejs/kit';
import { RefusDroit, SUJETS_SUIVI, suiviDuCentre, type SujetSuivi } from '@gyro-caserne/socle';
import { aujourdhuiParis } from '#lib/aujourdhui.ts';
import type { PageServerLoad } from './$types';

// Le suivi du centre, pour le chef de centre, l'adjoint et le super administrateur : une page du journal à la fois (`?avant=`),
// filtrée par sujet (`?sujet=`). L'arrivée lit puis marque la visite (les nouveautés de la cloche repartent de zéro) ; les liens de la page
// redonnent la marque lue (`?vu=`), pour que le repère reste en place. Une requête.
export const load: PageServerLoad = async ({ locals, url }) => {
	const { acteur, base } = locals;
	if (!acteur) redirect(303, '/connexion');
	const brut = url.searchParams.get('avant');
	const avant = brut && /^\d{1,12}$/.test(brut) ? Number(brut) : undefined;
	// La marque de l'arrivée, redonnée par les filtres et la suite : un entier, sinon ignorée (c'est alors une arrivée).
	const marque = url.searchParams.get('vu');
	const vu = marque && /^\d{1,12}$/.test(marque) ? Number(marque) : undefined;
	const choisi = url.searchParams.get('sujet');
	const sujet = SUJETS_SUIVI.find((s) => s === choisi) ?? null;
	const aujourdhui = aujourdhuiParis();
	try {
		return { ...(await suiviDuCentre(base, acteur, aujourdhui, { avant, sujet: sujet ?? undefined, vu })), sujet: sujet as SujetSuivi | null, aujourdhui };
	} catch (erreur) {
		if (erreur instanceof RefusDroit) error(403, 'Le suivi du centre est réservé au chef de centre et à son adjoint.');
		throw erreur;
	}
};
