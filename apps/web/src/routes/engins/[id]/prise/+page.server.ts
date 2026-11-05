import { error, fail, redirect } from '@sveltejs/kit';
import centre from '$centre';
import { abandonnerPrise, commencerPrise, DonneeInvalide, gestePrise, lirePrise, premierGestePrise, RefusDroit, TAILLE_PHOTO_MAX, validerPrise, type GenreEcart, type GestePrise } from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { accesEngins, champ, idDe, phraseDe } from '#lib/server/engins.ts';
import type { Actions, PageServerLoad } from './$types';

const REFUS_PRISE = 'La prise de garde est faite par les agents du centre.';

// La prise de garde d'un engin, pour la relève en cours.
export const load: PageServerLoad = async ({ locals, params }) => {
	const { acteur, base } = await accesEngins(locals);
	try {
		return { ...(await lirePrise(base, acteur, idDe(params.id), maintenantParis(), centre.astreinte)), moi: acteur.type === 'personne' ? acteur.id : null };
	} catch (erreur) {
		if (erreur instanceof DonneeInvalide) error(404, 'Cet engin n’existe pas.');
		throw erreur;
	}
};

// Les refus dits sur la page ; `zone` : celle à garder ouverte, `cible` : le formulaire concerné.
function refusPrise(erreur: unknown, plus: Record<string, unknown> = {}) {
	if (erreur instanceof RefusDroit) return fail(403, { ...plus, message: REFUS_PRISE });
	if (erreur instanceof DonneeInvalide) return fail(400, { ...plus, message: phraseDe(erreur.message) });
	throw erreur;
}

const nombre = (brut: string) => (brut.trim() === '' ? null : /^\d{1,4}$/.test(brut.trim()) ? Number(brut) : Number.NaN);

// Le geste demandé ; la photo (facultative) déjà lue.
async function gesteDe(f: FormData): Promise<GestePrise | null> {
	switch (champ(f, 'quoi')) {
		case 'zone':
			return { quoi: 'zone', zone: idDe(champ(f, 'zone')), vue: champ(f, 'vue') === '1' };
		case 'ecart': {
			const genre = champ(f, 'genre');
			const fichier = f.get('photo');
			const photo =
				fichier instanceof File && fichier.size > 0 ? { type: fichier.type, donnees: new Uint8Array(await fichier.arrayBuffer()) } : champ(f, 'retirer_photo') === '1' ? null : undefined;
			return {
				quoi: 'ecart',
				element: idDe(champ(f, 'element')),
				// Une valeur inconnue passe telle quelle : le socle la refuse.
				genre: genre as GenreEcart,
				manque: nombre(champ(f, 'manque')),
				note: champ(f, 'note'),
				photo
			};
		}
		case 'retirer_ecart':
			return { quoi: 'retirer_ecart', element: idDe(champ(f, 'element')) };
		case 'retrouve':
			return { quoi: 'retrouve', anomalie: idDe(champ(f, 'anomalie')), oui: champ(f, 'oui') === '1' };
		case 'participants':
			return { quoi: 'participants', ids: f.getAll('participant').map(idDe) };
		default:
			return null;
	}
}

const SUCCES: Record<GestePrise['quoi'], string> = {
	zone: 'Zone enregistrée.',
	ecart: 'Écart enregistré.',
	retirer_ecart: 'Écart retiré.',
	retrouve: 'Réponse enregistrée.',
	participants: 'Participants enregistrés.'
};

export const actions: Actions = {
	commencer: async ({ locals, params }) => {
		const { acteur, base } = await accesEngins(locals);
		try {
			await commencerPrise(base, locals.basePhotos, acteur, idDe(params.id), maintenantParis(), centre.astreinte);
		} catch (erreur) {
			return refusPrise(erreur, { cible: 'commencer' });
		}
		return { cible: 'commencer', succes: 'Prise commencée.' };
	},
	geste: async ({ locals, params, request }) => {
		const { acteur, base } = await accesEngins(locals);
		const f = await request.formData();
		const cible = champ(f, 'cible');
		const zone = idDe(champ(f, 'zone')) || null;
		const fichier = f.get('photo');
		if (fichier instanceof File && fichier.size > TAILLE_PHOTO_MAX) return fail(400, { cible, zone, message: 'Photo trop lourde : 200 Ko au plus.' });
		const geste = await gesteDe(f);
		if (!geste) return refusPrise(new DonneeInvalide('Geste inconnu'), { cible, zone });
		try {
			// Sans prise en cours, le geste la commence.
			if (champ(f, 'prise') === '') await premierGestePrise(base, locals.basePhotos, acteur, idDe(params.id), geste, maintenantParis(), centre.astreinte);
			else await gestePrise(base, locals.basePhotos, acteur, idDe(champ(f, 'prise')), geste, maintenantParis(), centre.astreinte, idDe(params.id));
		} catch (erreur) {
			return refusPrise(erreur, { cible, zone });
		}
		// Zone complète : la page passe à la suivante à voir et propose d'annuler. Sinon, on reste sur la zone touchée.
		if (geste.quoi === 'zone' && geste.vue) return { cible, zone: null, zoneFaite: geste.zone, succes: 'Zone complète.' };
		return { cible, zone, succes: SUCCES[geste.quoi] };
	},
	valider: async ({ locals, params, request }) => {
		const { acteur, base } = await accesEngins(locals);
		const f = await request.formData();
		try {
			await validerPrise(base, acteur, idDe(champ(f, 'prise')), maintenantParis(), centre.astreinte, idDe(params.id));
		} catch (erreur) {
			return refusPrise(erreur, { cible: 'valider' });
		}
		redirect(303, `/engins/${params.id}/prise?validee`);
	},
	abandonner: async ({ locals, params, request }) => {
		const { acteur, base } = await accesEngins(locals);
		const f = await request.formData();
		try {
			await abandonnerPrise(base, locals.basePhotos, acteur, idDe(champ(f, 'prise')), maintenantParis(), idDe(params.id));
		} catch (erreur) {
			return refusPrise(erreur, { cible: 'abandonner' });
		}
		redirect(303, `/engins/${params.id}/prise`);
	}
};
