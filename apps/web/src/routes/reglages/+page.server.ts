import { remplissagePhotos } from '@gyro-caserne/socle';
import type { PageServerLoad } from './$types';

// La jauge des photos, pour qui a le pouvoir sur le centre (chef de centre, adjoint, super administrateur).
export const load: PageServerLoad = async ({ locals, parent }) => {
	const { peutPouvoir } = await parent();
	return { photos: peutPouvoir ? await remplissagePhotos(locals.basePhotos) : null };
};
