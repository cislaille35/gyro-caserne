import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => ({
	affichage: locals.affichage,
	connecte: locals.acteur !== null
});
