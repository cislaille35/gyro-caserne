import centre from '$centre';
import { agendaDe } from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';
import type { RequestHandler } from './$types';

// Le fichier d'agenda d'un agent, lu par Google Agenda, l'iPhone ou Outlook sans connexion : la clé du lien suffit.
// Un lien faux ne dit rien de plus qu'« Introuvable ». Le lien n'est jamais écrit au journal.
export const GET: RequestHandler = async ({ locals, params }) => {
	const lien = params.fichier.endsWith('.ics') ? params.fichier.slice(0, -4) : '';
	const texte = lien ? await agendaDe(locals.base, lien, maintenantParis(), centre.astreinte) : null;
	if (texte === null) return new Response('Introuvable', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
	return new Response(texte, {
		headers: { 'content-type': 'text/calendar; charset=utf-8', 'content-disposition': 'inline; filename="planning.ics"', 'cache-control': 'private, max-age=900', 'referrer-policy': 'no-referrer' }
	});
};
