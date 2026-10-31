import type { Apercu } from '@gyro-caserne/socle';
import { pluriel } from '#lib/pluriel.ts';


// « 3 départs, 5 arrivées, 52 modifications, 2 erreurs », sans les catégories vides.
export function resumer(apercu: Apercu): string {
	const categories = [
		[apercu.departs.length, 'départ', 'départs'],
		[apercu.arrivees.length, 'arrivée', 'arrivées'],
		[apercu.modifications.length, 'modification', 'modifications'],
		[apercu.erreurs.length, 'erreur', 'erreurs']
	] as const;
	return categories
		.filter(([n]) => n > 0)
		.map(([n, s, p]) => pluriel(n, s, p))
		.join(', ');
}
