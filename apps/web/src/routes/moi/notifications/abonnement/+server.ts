import { error, json } from '@sveltejs/kit';
import { abonner, DonneeInvalide, desabonner } from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';
import type { RequestHandler } from './$types';

// L'appareil où la personne active (POST) ou coupe (DELETE) les notifications.
function personne(locals: App.Locals) {
	if (locals.acteur?.type !== 'personne') error(401, 'Connexion requise');
	return locals.acteur;
}

async function corps(request: Request): Promise<Record<string, unknown>> {
	const valeur = await request.json().catch(() => null);
	if (!valeur || typeof valeur !== 'object') error(400, 'Abonnement invalide');
	return valeur as Record<string, unknown>;
}

export const POST: RequestHandler = async ({ locals, request }) => {
	const acteur = personne(locals);
	const c = await corps(request);
	const cles = (c.keys ?? {}) as Record<string, unknown>;
	try {
		await abonner(locals.base, acteur, { endpoint: c.endpoint as string, p256dh: cles.p256dh as string, auth: cles.auth as string, appareil: c.appareil as string }, maintenantParis());
	} catch (erreur) {
		if (erreur instanceof DonneeInvalide) error(400, 'Abonnement invalide');
		throw erreur;
	}
	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ locals, request }) => {
	const acteur = personne(locals);
	const c = await corps(request);
	if (typeof c.endpoint === 'string') await desabonner(locals.base, acteur, c.endpoint);
	return json({ ok: true });
};
