import { redirect } from '@sveltejs/kit';
import { asc, eq } from 'drizzle-orm';
import { equipe, estGestionnaire, listeGestion, STATUTS_OPERATIONNELS, vueEffectif, type StatutOperationnel } from '@gyro-caserne/socle';
import { aujourdhuiParis } from '#lib/aujourdhui.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	const { acteur, base } = locals;
	if (!acteur) redirect(303, '/connexion');
	const aujourdhui = aujourdhuiParis();

	if (!(await estGestionnaire(base, acteur, aujourdhui))) {
		return { gestion: false as const, groupes: await vueEffectif(base, aujourdhui) };
	}

	const equipes = await base.select({ id: equipe.id, nom: equipe.nom }).from(equipe).where(eq(equipe.active, 1)).orderBy(asc(equipe.ordreRotation));
	const texte = url.searchParams.get('texte')?.trim() ?? '';
	const brutEquipe = url.searchParams.get('equipe') ?? '';
	const brutStatut = url.searchParams.get('statut') ?? '';
	const equipeId = brutEquipe === 'aucune' ? 'aucune' : equipes.find((e) => String(e.id) === brutEquipe)?.id;
	const statut = STATUTS_OPERATIONNELS.find((s) => s === brutStatut);

	const lignes = await listeGestion(base, acteur, { texte, equipeId, statut }, aujourdhui);
	return {
		gestion: true as const,
		lignes,
		equipes,
		statuts: [...STATUTS_OPERATIONNELS] as StatutOperationnel[],
		filtres: { texte, equipe: equipeId === undefined ? '' : String(equipeId), statut: statut ?? '' }
	};
};
