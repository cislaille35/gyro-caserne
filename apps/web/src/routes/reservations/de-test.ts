import { eq } from 'drizzle-orm';
import { ajouterRessource, attribution, comite, personne, profil, responsabilite, ressource } from '@gyro-caserne/socle';
import { aujourdhuiParis, maintenantParis } from '#lib/aujourdhui.ts';
import { locaux, preparer as preparerEchanges } from '../echanges/de-test.ts';

export { locaux };

// Le jour, à Paris, dans `jours` jours.
export const dans = (jours: number) => aujourdhuiParis(new Date(Date.now() + jours * 864e5));

// Alice et Bruno, agents ; Bruno est membre de l'Amicale, le chef de centre référent engins ; Estelle, compte de la réserve citoyenne.
export async function preparer() {
	const p = await preparerEchanges();
	const { base, chef, bruno } = p;
	const [amicale] = await base.select().from(comite).where(eq(comite.nom, 'Amicale'));
	const [membre] = await base.select().from(responsabilite).where(eq(responsabilite.nom, 'Membre de comité'));
	const [engins] = await base.select().from(responsabilite).where(eq(responsabilite.nom, 'Référent engins'));
	const saisie = { debut: '2026-01-01', saisiePar: 'super:a@b.fr', saisieLe: '2026-01-01' };
	await base.insert(attribution).values([
		{ personneId: bruno.id, responsabiliteId: membre!.id, perimetreType: 'comite', perimetreId: amicale!.id, ...saisie },
		{ personneId: chef.id, responsabiliteId: engins!.id, perimetreType: 'centre', perimetreId: null, ...saisie }
	]);
	const [reserve] = await base.select().from(profil).where(eq(profil.nom, 'Réserve citoyenne'));
	const [e] = await base.insert(personne).values({ email: 'reserve@exemple.fr', prenom: 'Estelle', nom: 'Réserve', profilId: reserve!.id }).returning();
	const bancs = await ajouterRessource(base, bruno, { nom: 'Bancs', stock: 12, icone: 'groupe', comiteId: amicale!.id }, maintenantParis());
	const [vl] = await base.select().from(ressource).where(eq(ressource.forme, 'creneau'));
	return { ...p, estelle: { type: 'personne', id: e!.id } as const, amicale: amicale!.id, bancs, vl: vl!.id };
}
