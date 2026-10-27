import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import centreExemple from '../../../../centres/exemple/centre.ts';
import { attribution, chargerJeuDeDepart, equipe, grade, personne, responsabilite } from '@gyro-caserne/socle';
import { baseDeTest } from '@gyro-caserne/socle/base-de-test';
import { load } from './+page.server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const appeler = (locals: unknown, recherche = '') => (load as any)({ locals, url: new URL(`http://localhost/${recherche}`) });

async function jeu() {
	const base = await baseDeTest();
	await chargerJeuDeDepart(base, centreExemple);
	const [sap] = await base.select().from(grade).limit(1);
	const [p] = await base.insert(personne).values({ email: 'alice@exemple.fr', prenom: 'Alice', nom: 'N', gradeId: sap!.id, entreeCentre: '2020-01-01' }).returning();
	const nommer = async (nom: string, perimetre: { type: 'centre' | 'equipe'; id?: number }) => {
		const [r] = await base.select().from(responsabilite).where(eq(responsabilite.nom, nom));
		await base.insert(attribution).values({ personneId: p!.id, responsabiliteId: r!.id, perimetreType: perimetre.type, perimetreId: perimetre.id ?? null, debut: '2020-01-01', saisiePar: 'super:a@b.fr', saisieLe: '2020-01-01' });
		return r!.id;
	};
	return { base, alice: { type: 'personne' as const, id: p!.id }, nommer };
}

describe('load de /', () => {
	it('renvoie vers la connexion si personne n\'est connecté', async () => {
		const base = await baseDeTest();
		await expect(appeler({ acteur: null, base })).rejects.toMatchObject({ status: 303, location: '/connexion' });
	});

	it('agent sans rôle : prénom et « Mon astreinte » seule', async () => {
		const { base, alice } = await jeu();
		expect(await appeler({ acteur: alice, base })).toEqual({
			prenom: 'Alice',
			casquettes: [{ id: 'astreinte', nom: 'Mon astreinte', icone: 'casque', compte: 0 }],
			choisie: 'astreinte',
			contenu: { type: 'astreinte' }
		});
	});

	it('super administrateur : pas de prénom, « Le centre »', async () => {
		const { base } = await jeu();
		expect(await appeler({ acteur: { type: 'super', email: 'admin@exemple.fr' }, base })).toMatchObject({ prenom: null, choisie: 'centre', contenu: { type: 'centre' } });
	});

	it('par défaut : la première casquette où quelque chose attend', async () => {
		const { base, alice, nommer } = await jeu();
		await nommer('Chef de centre', { type: 'centre' });
		expect(await appeler({ acteur: alice, base })).toMatchObject({ choisie: 'centre' });
	});

	it('par défaut, rien n’attend : la principale (chef d’équipe avant astreinte)', async () => {
		const { base, alice, nommer } = await jeu();
		const [equipe1] = await base.select().from(equipe).limit(1);
		await nommer('Chef d’équipe', { type: 'equipe', id: equipe1!.id });
		await nommer('Référent pharmacie', { type: 'centre' });
		expect(await appeler({ acteur: alice, base })).toMatchObject({ choisie: `equipe:${equipe1!.id}`, contenu: { type: 'equipe' } });
	});

	it('?casquette choisit parmi les casquettes tenues, sinon le défaut', async () => {
		const { base, alice, nommer } = await jeu();
		const pharmacie = await nommer('Référent pharmacie', { type: 'centre' });
		expect(await appeler({ acteur: alice, base }, `?casquette=role:${pharmacie}`)).toMatchObject({ choisie: `role:${pharmacie}`, contenu: { type: 'role', permet: ['Gérer le stock et la pharmacie.'] } });
		expect(await appeler({ acteur: alice, base }, '?casquette=centre')).toMatchObject({ choisie: 'astreinte' });
	});
});
