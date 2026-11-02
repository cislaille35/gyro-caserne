import { eq } from 'drizzle-orm';
import centreExemple from '../../../centres/exemple/centre.ts';
import type { Acteur } from '../src/droits.ts';
import { chargerJeuDeDepart } from '../src/jeu-de-depart.ts';
import { attribution, equipe, personne, profil, responsabilite, typeEngin } from '../src/schema.ts';
import { baseDeTest } from './base-de-test.ts';

export const maintenant = '2026-11-02T10:00';
export const aujourdhui = '2026-11-02';

// Le jeu de départ, un agent, un chef de garde (sur son équipe), un référent engins et une personne sans profil.
export async function jeuEngins() {
	const base = await baseDeTest();
	await chargerJeuDeDepart(base, centreExemple);
	const [agent] = await base.select().from(profil).where(eq(profil.nom, 'Agent'));
	const [premiere] = await base.select().from(equipe).limit(1);
	const nouvelle = async (email: string, prenom: string, profilId: number | null) =>
		(await base.insert(personne).values({ email, prenom, nom: 'Fictif', profilId }).returning())[0]!.id;
	const nommer = async (personneId: number, nom: string, perimetreType: 'centre' | 'equipe', perimetreId: number | null) => {
		const [r] = await base.select().from(responsabilite).where(eq(responsabilite.nom, nom));
		await base.insert(attribution).values({ personneId, responsabiliteId: r!.id, perimetreType, perimetreId, debut: '2026-01-01', saisiePar: 'super:a@b.fr', saisieLe: '2026-01-01' });
	};
	const alice = await nouvelle('alice@exemple.fr', 'Alice', agent!.id);
	const chefDeGarde = await nouvelle('cdg@exemple.fr', 'Chloé', agent!.id);
	await nommer(chefDeGarde, 'Chef de garde', 'equipe', premiere!.id);
	const referent = await nouvelle('ref@exemple.fr', 'Rémi', agent!.id);
	await nommer(referent, 'Référent engins', 'centre', null);
	const sansProfil = await nouvelle('sans@exemple.fr', 'Sam', null);
	const types = Object.fromEntries((await base.select().from(typeEngin)).map((t) => [t.nom, t.id])) as Record<'VSAV' | 'FPT' | 'VTU', number>;
	const qui = (id: number): Acteur => ({ type: 'personne', id });
	return { base, types, alice: qui(alice), chefDeGarde: qui(chefDeGarde), referent: qui(referent), sansProfil: qui(sansProfil), superAdmin: { type: 'super', email: 'admin@exemple.fr' } as Acteur };
}
