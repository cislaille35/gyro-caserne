import { error, redirect } from '@sveltejs/kit';
import { annuaire, conversationAvec, RefusDroit } from '@gyro-caserne/socle';
import { aujourdhuiParis } from '#lib/aujourdhui.ts';
import { actionEnvoyer } from '#lib/server/formulaire-messagerie.ts';
import { exigerActeur } from '#lib/server/formulaire-mur.ts';
import type { Actions, PageServerLoad } from './$types';

const identifiant = (brut: string) => (/^\d+$/.test(brut) && Number(brut) > 0 ? Number(brut) : null);

// Écrire à quelqu'un : sa conversation si elle existe, sinon une conversation vide, créée au premier message.
export const load: PageServerLoad = async ({ locals, params }) => {
	const acteur = exigerActeur(locals);
	const id = identifiant(params.personne);
	if (id === null) error(404, 'Personne introuvable');
	const aujourdhui = aujourdhuiParis();
	let existante: number | null;
	let agents: Awaited<ReturnType<typeof annuaire>>;
	try {
		[existante, agents] = await Promise.all([conversationAvec(locals.base, acteur, id, aujourdhui), annuaire(locals.base, acteur, aujourdhui)]);
	} catch (erreur) {
		if (erreur instanceof RefusDroit) redirect(303, '/echanges?refus=messagerie');
		throw erreur;
	}
	if (existante !== null) redirect(303, `/echanges/messages/${existante}`);
	const p = agents.find((a) => a.id === id);
	if (!p) error(404, 'Cette personne n’est pas dans l’annuaire');
	return {
		personne: { id: p.id, prenom: p.prenom, nom: p.nom, couleur: p.equipe?.couleur ?? null },
		sousTitre: p.role ?? (p.equipe ? `Équipe ${p.equipe.numero}` : '')
	};
};

export const actions: Actions = {
	envoyer: ({ locals, params, request }) => {
		const id = identifiant(params.personne);
		if (id === null) error(404, 'Personne introuvable');
		return actionEnvoyer(locals, request, { personne: id });
	}
};
