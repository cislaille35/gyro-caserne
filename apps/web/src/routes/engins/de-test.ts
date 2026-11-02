import { eq } from 'drizzle-orm';
import centre from '$centre';
import { attribution, chargerJeuDeDepart, enregistrerEngin, equipe, personne, profil, responsabilite, typeEngin, type Acteur } from '@gyro-caserne/socle';
import { baseDeTest } from '@gyro-caserne/socle/base-de-test';
import { maintenantParis } from '#lib/aujourdhui.ts';

// Jeu commun des tests des engins : un agent, un chef de garde (qui gère les engins), un sans profil ; un VSAV au centre, un VSAV prêté, un FPT parti.
export async function preparer() {
	const base = await baseDeTest();
	await chargerJeuDeDepart(base, centre);
	const [agent] = await base.select().from(profil).where(eq(profil.nom, 'Agent'));
	const [e1] = await base.select().from(equipe).limit(1);
	const nouvelle = async (prenom: string, profilId: number | null): Promise<Acteur> => {
		const [p] = await base.insert(personne).values({ email: `${prenom.toLowerCase()}@exemple.fr`, prenom, nom: 'Test', profilId }).returning();
		return { type: 'personne', id: p!.id };
	};
	const alice = await nouvelle('Alice', agent!.id);
	const chef = await nouvelle('Chloe', agent!.id);
	const [r] = await base.select().from(responsabilite).where(eq(responsabilite.systeme, 'chef_equipe'));
	await base.insert(attribution).values({ personneId: (chef as { id: number }).id, responsabiliteId: r!.id, perimetreType: 'equipe', perimetreId: e1!.id, debut: '2026-01-01', saisiePar: 'super:a@b.fr', saisieLe: '2026-01-01' });
	const sans = await nouvelle('Sam', null);
	const types = Object.fromEntries((await base.select().from(typeEngin)).map((t) => [t.nom, t.id])) as Record<'VSAV' | 'FPT' | 'VTU', number>;
	const saisie = { immatriculation: '', provenance: '', situation: 'centre' as const };
	const vsav = await enregistrerEngin(base, chef, { ...saisie, nom: 'VSAV 1', typeId: types.VSAV }, maintenantParis());
	const prete = await enregistrerEngin(base, chef, { ...saisie, nom: 'VSAV 23', typeId: types.VSAV, situation: 'prete', provenance: 'CIS Exemple-Nord' }, maintenantParis());
	const parti = await enregistrerEngin(base, chef, { ...saisie, nom: 'FPT 2', typeId: types.FPT, situation: 'parti' }, maintenantParis());
	return { base, alice, chef, sans, types, vsav, prete, parti };
}

export const locaux = (base: { photos: unknown }, acteur: unknown) => ({ base, basePhotos: base.photos, acteur });
