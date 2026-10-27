import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import centre from '$centre';
import { chargerJeuDeDepart, ENTETES, personne, profil } from '@gyro-caserne/socle';
import { baseDeTest } from '@gyro-caserne/socle/base-de-test';
import { aujourdhuiParis } from '#lib/aujourdhui.ts';
import { load } from './+page.server';
import { GET } from './donnees/+server';
import { POST as apercu } from './apercu/+server';
import { POST as operation } from './operation/+server';

const super_ = { type: 'super', email: 'admin@exemple.fr' } as const;
const superAdmins = ['admin@exemple.fr'];

async function preparer() {
	const base = await baseDeTest();
	await chargerJeuDeDepart(base, centre);
	const [profilAgent] = await base.select().from(profil).where(eq(profil.nom, 'Agent'));
	const [alice] = await base.insert(personne).values({ email: 'alice@exemple.fr', prenom: 'Alice', nom: 'Martin', profilId: profilAgent!.id }).returning();
	return { base, alice: alice!, profilAgent: profilAgent! };
}

const locaux = (base: unknown, acteur: unknown) => ({ base, acteur, superAdmins });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const lire = (locals: unknown, requete = '') => (GET as any)({ locals, url: new URL(`http://x/agents/fichier/donnees${requete}`) });
const envoyer = (route: unknown, locals: unknown, corps: string, type = 'application/json') =>
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	(route as any)({ locals, request: new Request('http://x', { method: 'POST', body: corps, headers: { 'content-type': type } }) });

describe('/agents/fichier', () => {
	it('refuse un agent ordinaire, à la page et à chaque route', async () => {
		const { base, alice } = await preparer();
		const locals = locaux(base, { type: 'personne', id: alice.id });
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		await expect((load as any)({ locals })).rejects.toMatchObject({ status: 403 });
		await expect(lire(locals)).rejects.toMatchObject({ status: 403 });
		await expect(envoyer(apercu, locals, '{}')).rejects.toMatchObject({ status: 403 });
		await expect(envoyer(operation, locals, '{}')).rejects.toMatchObject({ status: 403 });
	});

	it('donne la date du jour à la page', async () => {
		const { base } = await preparer();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		expect(await (load as any)({ locals: locaux(base, super_) })).toEqual({ aujourdhui: aujourdhuiParis() });
	});

	it('donne l\'effectif, ou le modèle vierge sans ligne ni repère', async () => {
		const { base } = await preparer();
		const effectif = await (await lire(locaux(base, super_))).json();
		expect(effectif.entetes.slice(0, ENTETES.length)).toEqual([...ENTETES]);
		expect(effectif.lignes).toHaveLength(1);
		expect(effectif.repere).not.toBeNull();
		const modele = await (await lire(locaux(base, super_), '?modele=1')).json();
		expect(modele.lignes).toEqual([]);
		expect(modele.repere).toBeNull();
	});

	it('refuse un corps qui n\'est pas du JSON (415)', async () => {
		const { base } = await preparer();
		const locals = locaux(base, super_);
		for (const route of [apercu, operation]) {
			expect((await envoyer(route, locals, 'a=1', 'application/x-www-form-urlencoded')).status).toBe(415);
			expect((await envoyer(route, locals, '{pas du json')).status).toBe(415);
		}
	});

	it('calcule l\'aperçu d\'un fichier lu', async () => {
		const { base } = await preparer();
		const fichier = { entetes: [...ENTETES], lignes: [{ numero: 2, cellules: ['', 'bob@exemple.fr', 'Bob', 'Durand', '', '', '', '', 'Agent', '', '', '', ''] }], repere: null };
		const reponse = await envoyer(apercu, locaux(base, super_), JSON.stringify(fichier));
		expect(reponse.status).toBe(200);
		const resultat = await reponse.json();
		expect(resultat.arrivees).toEqual([{ ligne: 2, nom: 'Bob Durand' }]);
		expect(resultat.operations).toHaveLength(1);
	});

	it('refuse un fichier mal formé (400)', async () => {
		const { base } = await preparer();
		const reponse = await envoyer(apercu, locaux(base, super_), JSON.stringify({ entetes: 'N°', lignes: [] }));
		expect(reponse.status).toBe(400);
		expect(await reponse.json()).toEqual({ message: 'Fichier mal formé' });
	});

	it('refuse un repère mal formé (400)', async () => {
		const { base } = await preparer();
		const reperes = [
			{ journal: 1, personne: 1, date: '27/10/2026' },
			{ journal: 1, personne: 1, date: '' },
			{ journal: -1, personne: 1, date: '2026-10-27' },
			{ journal: 1, personne: -1, date: '2026-10-27' },
			{ journal: 1e300, personne: 1, date: '2026-10-27' },
			{ journal: 1, personne: 2 ** 60, date: '2026-10-27' }
		];
		for (const repere of reperes) {
			const reponse = await envoyer(apercu, locaux(base, super_), JSON.stringify({ entetes: [...ENTETES], lignes: [], repere }));
			expect(reponse.status, JSON.stringify(repere)).toBe(400);
			expect(await reponse.json()).toEqual({ message: 'Fichier mal formé' });
		}
	});

	it('refuse un fichier de plus de 2000 lignes (400)', async () => {
		const { base } = await preparer();
		const cellules = ['', 'x@exemple.fr', 'X', 'Y', '', '', '', '', 'Agent', '', '', '', ''];
		const fichier = { entetes: [...ENTETES], lignes: Array.from({ length: 2001 }, (_, i) => ({ numero: i + 2, cellules })), repere: null };
		const reponse = await envoyer(apercu, locaux(base, super_), JSON.stringify(fichier));
		expect(reponse.status).toBe(400);
		expect(await reponse.json()).toEqual({ message: 'Fichier trop long : 2000 lignes au plus' });
	});

	it('refuse une opération bien formée à un agent ordinaire (403), sans rien écrire', async () => {
		const { base, alice, profilAgent } = await preparer();
		const op = { ligne: 2, type: 'ajouter', donnees: { email: 'bob@exemple.fr', prenom: 'Bob', nom: 'Durand', profilId: profilAgent.id } };
		await expect(envoyer(operation, locaux(base, { type: 'personne', id: alice.id }), JSON.stringify({ operation: op, nouvelles: {} }))).rejects.toMatchObject({ status: 403 });
		expect(await base.select().from(personne)).toHaveLength(1);
	});

	it('applique une opération et rend l\'agent créé', async () => {
		const { base, profilAgent } = await preparer();
		const op = { ligne: 2, type: 'ajouter', donnees: { email: 'bob@exemple.fr', prenom: 'Bob', nom: 'Durand', profilId: profilAgent.id } };
		const reponse = await envoyer(operation, locaux(base, super_), JSON.stringify({ operation: op, nouvelles: {} }));
		expect(reponse.status).toBe(200);
		const [bob] = await base.select().from(personne).where(eq(personne.email, 'bob@exemple.fr'));
		expect(await reponse.json()).toEqual({ personneId: bob!.id });
	});

	it('rend l\'erreur du socle avec son message (400)', async () => {
		const { base, profilAgent } = await preparer();
		const locals = locaux(base, super_);
		const doublon = { ligne: 3, type: 'ajouter', donnees: { email: 'alice@exemple.fr', prenom: 'Alice', nom: 'Bis', profilId: profilAgent.id } };
		const reponse = await envoyer(operation, locals, JSON.stringify({ operation: doublon, nouvelles: {} }));
		expect(reponse.status).toBe(400);
		expect(await reponse.json()).toEqual({ message: 'Adresse déjà utilisée' });
		const malFormee = await envoyer(operation, locals, JSON.stringify({ operation: { ligne: 1, type: 'statut' }, nouvelles: {} }));
		expect(malFormee.status).toBe(400);
		expect(await malFormee.json()).toEqual({ message: 'Opération mal formée' });
	});
});
