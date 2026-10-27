import { fail, redirect } from '@sveltejs/kit';
import { asc, eq } from 'drizzle-orm';
import { ajouterPersonne, equipe, grade, profil, STATUTS_OPERATIONNELS } from '@gyro-caserne/socle';
import { echec, exigerGestion, lireFormulaire, type Reponse } from '#lib/server/formulaire-agent.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	await exigerGestion(locals);
	const { base } = locals;
	const profils = await base.select({ id: profil.id, nom: profil.nom }).from(profil).orderBy(asc(profil.id));
	return {
		profils,
		statuts: STATUTS_OPERATIONNELS.filter((s) => s !== 'parti'),
		profilParDefaut: String(profils.find((p) => p.nom === 'Agent')?.id ?? ''),
		grades: await base.select({ id: grade.id, libelle: grade.libelle }).from(grade).orderBy(asc(grade.ordre)),
		equipes: await base.select({ id: equipe.id, nom: equipe.nom }).from(equipe).where(eq(equipe.active, 1)).orderBy(asc(equipe.ordreRotation))
	};
};

export const actions: Actions = {
	default: async ({ locals, request }) => {
		const { acteur, aujourdhui } = await exigerGestion(locals);
		const { champs, erreurs, valeurs } = lireFormulaire(await request.formData(), true);
		if (Object.keys(erreurs).length > 0) return fail<Reponse>(400, { erreurs, valeurs });

		const { email, prenom, nom, profilId, equipeId, ...complements } = champs;
		let id: number;
		try {
			id = await ajouterPersonne(locals.base, acteur, { email: email!, prenom: prenom!, nom: nom!, profilId: profilId!, ...(equipeId != null && { equipeId }), ...complements }, aujourdhui, locals.superAdmins);
		} catch (erreur) {
			return echec(erreur, { valeurs });
		}
		redirect(303, `/agents/${id}`);
	}
};
