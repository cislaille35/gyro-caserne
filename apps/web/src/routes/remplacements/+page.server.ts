import centre from '$centre';
import { marquerAvisRemplacementLus, remplacementsDe } from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { exigerConnecte, gestesRemplacement, RESULTATS } from '#lib/server/remplacements.ts';
import { ouRefus } from '#lib/server/planning.ts';
import type { Actions, PageServerLoad } from './$types';

const ONGLETS = ['pour-moi', 'miennes', 'a-valider', 'historique'] as const;
type Onglet = (typeof ONGLETS)[number];

// Pour moi, Mes demandes, À valider (chefs), Historique. Ouvrir la page marque lus les avis de remplacement.
export const load: PageServerLoad = async ({ locals, url }) => {
	const acteur = exigerConnecte(locals);
	if (acteur.type !== 'personne') return { personne: false as const };
	const maintenant = maintenantParis();
	const [listes] = await Promise.all([ouRefus(remplacementsDe(locals.base, acteur, maintenant, centre.astreinte), 'Les remplacements sont réservés aux agents du centre.'), locals.base.batch([marquerAvisRemplacementLus(locals.base, acteur.id, maintenant)])]);
	const demande = ONGLETS.find((o) => o === url.searchParams.get('onglet'));
	const avecValider = listes.valideur || listes.aValider.length > 0;
	const parDefaut: Onglet = listes.pourMoi.length > 0 ? 'pour-moi' : listes.aValider.length > 0 ? 'a-valider' : 'miennes';
	const onglet: Onglet = demande === 'a-valider' && !avecValider ? parDefaut : (demande ?? parDefaut);
	// `?fait=` : le résultat d'un geste fait sur la page d'une demande qui n'est plus visible.
	const fait = url.searchParams.get('fait');
	return { personne: true as const, ...listes, avecValider, onglet, fait: fait !== null && Object.hasOwn(RESULTATS, fait) ? RESULTATS[fait as keyof typeof RESULTATS] : null };
};

export const actions: Actions = gestesRemplacement;
