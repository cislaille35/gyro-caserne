import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { photoPublication, publication } from '@gyro-caserne/socle';
import { jpeg, locaux, preparer, requeteFormulaire } from '../de-test.ts';
import { actions, load } from './+page.server';

const septJoursPlusTard = (m: string) => new Date(Date.parse(`${m.slice(0, 16)}:00Z`) + 7 * 864e5).toISOString().slice(0, 16);
const champsDates = (): [string, string][] => {
	const m = maintenantParis();
	return [
		['ouverture', m.slice(0, 16)],
		['cloture', septJoursPlusTard(m)]
	];
};
const demain = () => `${new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)}T19:30`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const charger = (locals: unknown, recherche = '') => (load as any)({ locals, url: new URL(`http://x/echanges/publier${recherche}`) });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const envoyer = async (locals: unknown, request: Request) => (actions.publier as any)({ locals, params: {}, url: new URL('http://x/echanges/publier'), request });
const agir = async (locals: unknown, corps: [string, string | File][]) => envoyer(locals, await requeteFormulaire(corps));
// Une action qui réussit redirige : on rend la redirection pour la vérifier.
const reussir = async (locals: unknown, corps: [string, string | File][]) => {
	try {
		await agir(locals, corps);
	} catch (r) {
		return r as { status: number; location: string };
	}
	throw new Error('pas de redirection');
};

describe('page Publier', () => {
	it('demande la connexion', async () => {
		await expect(charger({ acteur: null })).rejects.toMatchObject({ status: 303, location: '/connexion' });
		const { base } = await preparer();
		await expect(agir({ base, acteur: null }, [])).rejects.toMatchObject({ status: 303, location: '/connexion' });
	});

	it('propose seulement les murs où l’on peut publier, avec leur audience', async () => {
		const { base, alice, chef, e1 } = await preparer();
		const data = await charger(locaux(base, alice));
		expect(data.murs.map((m: { cle: string }) => m.cle)).toEqual(['vie', `equipe:${e1.id}`]);
		expect(data.murs[0]).toMatchObject({ nom: 'Vie du centre', type: 'vie', peutModerer: false, audience: 3, icone: 'ballon' });
		expect(data.murs[1]).toMatchObject({ nom: 'Équipe 1', type: 'equipe', audience: 1, numero: 1 });
		expect(data.choisi).toBeNull();
		const duChef = await charger(locaux(base, chef));
		expect(duChef.murs[0]).toMatchObject({ cle: 'centre', peutModerer: true });
		expect(duChef.equipes.map((e: { nom: string }) => e.nom)).toEqual(['Équipe 1', 'Équipe 2', 'Équipe 3']);
	});

	it('?mur= présélectionne un mur proposé ; inconnu ou interdit : aucun', async () => {
		const { base, alice, e1, e2 } = await preparer();
		expect((await charger(locaux(base, alice), `?mur=equipe:${e1.id}`)).choisi).toBe(`equipe:${e1.id}`);
		for (const mur of ['centre', `equipe:${e2.id}`, 'inconnu', '']) expect((await charger(locaux(base, alice), `?mur=${mur}`)).choisi).toBeNull();
	});

	it('?texte= préremplit le texte, coupé à 4 000 caractères', async () => {
		const { base, alice } = await preparer();
		expect((await charger(locaux(base, alice), `?mur=vie&texte=${encodeURIComponent('Joyeux anniversaire Alice !')}`)).texte).toBe('Joyeux anniversaire Alice !');
		expect((await charger(locaux(base, alice), `?texte=${'x'.repeat(5000)}`)).texte).toHaveLength(4000);
		expect((await charger(locaux(base, alice))).texte).toBe('');
	});

	it('sondage : ouverture maintenant, clôture 7 jours plus tard', async () => {
		const { base, alice } = await preparer();
		const avant = maintenantParis().slice(0, 16);
		const data = await charger(locaux(base, alice));
		expect(data.ouverture >= avant && data.ouverture <= maintenantParis().slice(0, 16)).toBe(true);
		expect(data.cloture).toBe(septJoursPlusTard(data.ouverture));
	});
});

describe('publier', () => {
	const derniere = async (base: Awaited<ReturnType<typeof preparer>>['base']) => (await base.select().from(publication).orderBy(publication.id)).at(-1)!;

	it('un message, avec un sondage et des photos : redirige vers la publication sur son mur', async () => {
		const { base, alice, e1 } = await preparer();
		const r = await reussir(locaux(base, alice), [
			['mur', `equipe:${e1.id}`],
			['type', 'message'],
			['texte', 'Petit déjeuner samedi ?'],
			['question', 'Vous venez ?'],
			['reponse', 'Oui'],
			['reponse', 'Non'],
			['reponse', ''],
			...champsDates(),
			['photos', jpeg()],
			['photos', jpeg(2000, 'deux.jpg')],
			['photos', new File([], '')]
		]);
		const p = await derniere(base);
		expect(r).toMatchObject({ status: 303, location: `/echanges/equipe:${e1.id}#publication-${p.id}` });
		expect(p).toMatchObject({ mur: `equipe:${e1.id}`, type: 'message', texte: 'Petit déjeuner samedi ?', sondageQuestion: 'Vous venez ?', sondageReponses: '["Oui","Non"]', sondageCloture: champsDates()[1]![1] });
		expect(await base.select({ id: photoPublication.id }).from(photoPublication).where(eq(photoPublication.publicationId, p.id))).toHaveLength(2);
	});

	it('une annonce avec prise de connaissance (modérateur)', async () => {
		const { base, chef } = await preparer();
		await reussir(locaux(base, chef), [['mur', 'centre'], ['type', 'annonce'], ['texte', 'Exercice'], ['priseDeConnaissance', 'oui']]);
		expect(await derniere(base)).toMatchObject({ mur: 'centre', type: 'annonce', priseDeConnaissance: 1 });
	});

	it('un événement qui convoque des équipes, ou tout le mur', async () => {
		const { base, alice, e1, e2 } = await preparer();
		const debut = demain();
		await reussir(locaux(base, alice), [['mur', 'vie'], ['type', 'evenement'], ['texte', 'Manœuvre'], ['debut', debut], ['lieu', 'Caserne'], ['equipe', String(e1.id)], ['equipe', String(e2.id)]]);
		expect(await derniere(base)).toMatchObject({ type: 'evenement', debut, lieu: 'Caserne', convoques: JSON.stringify([e1.id, e2.id]) });
		await reussir(locaux(base, alice), [['mur', 'vie'], ['type', 'evenement'], ['texte', 'Repas'], ['debut', debut], ['lieu', 'Salle']]);
		expect(await derniere(base)).toMatchObject({ texte: 'Repas', convoques: '"tous"' });
	});

	it('un bravo ; les champs d’événement et la prise de connaissance restés remplis sont ignorés', async () => {
		const { base, alice } = await preparer();
		await reussir(locaux(base, alice), [['mur', 'vie'], ['type', 'bravo'], ['texte', 'Bravo Chloé pour le FDF1 !'], ['debut', demain()], ['lieu', 'X'], ['priseDeConnaissance', 'oui']]);
		expect(await derniere(base)).toMatchObject({ type: 'bravo', debut: null, lieu: null, priseDeConnaissance: 0 });
	});

	it('refus affichés sur le formulaire, saisie et mur gardés', async () => {
		const { base, alice } = await preparer();
		const vie = (corps: [string, string | File][]) => agir(locaux(base, alice), [['mur', 'vie'], ...corps]);
		expect(await vie([['type', 'message'], ['texte', '  ']])).toMatchObject({ status: 400, data: { cible: 'publier', erreurs: { texte: 'Écrivez le texte de la publication.' }, valeurs: { mur: 'vie', type: 'message' } } });
		expect(await vie([['type', 'message'], ['texte', 'x'], ['photos', jpeg(401 * 1024)]])).toMatchObject({
			status: 400,
			data: { erreurs: { photos: expect.stringContaining('400 Ko') }, valeurs: { texte: 'x', mur: 'vie' } }
		});
		expect(await vie([['type', 'message'], ['texte', 'x'], ['photos', new File([new Uint8Array([0x89, 0x50])], 'a.png', { type: 'image/png' })]])).toMatchObject({
			status: 400,
			data: { erreurs: { photos: 'Les photos doivent être en JPEG ou WebP.' } }
		});
		const cinq = Array.from({ length: 5 }, (): [string, File] => ['photos', jpeg()]);
		expect(await vie([['type', 'message'], ['texte', 'x'], ...cinq])).toMatchObject({ status: 400, data: { erreurs: { photos: '4 photos au plus.' } } });
		expect(await vie([['type', 'evenement'], ['texte', 'x'], ['debut', demain()], ['lieu', '']])).toMatchObject({ status: 400, data: { erreurs: { lieu: 'Indiquez le lieu.' } } });
		expect(await vie([['type', 'evenement'], ['texte', 'x'], ['debut', ''], ['lieu', 'Ici']])).toMatchObject({ status: 400, data: { erreurs: { debut: 'Indiquez la date et l’heure.' } } });
		expect(await vie([['type', 'evenement'], ['texte', 'x'], ['debut', '2020-01-01T10:00'], ['lieu', 'Ici']])).toMatchObject({ status: 400, data: { erreurs: { debut: 'Cet événement est déjà passé.' } } });
		expect(await agir(locaux(base, alice), [['type', 'message'], ['texte', 'x']])).toMatchObject({ status: 400, data: { erreurs: { mur: 'Choisissez où publier.' } } });
		expect(await agir(locaux(base, alice), [['mur', 'centre'], ['type', 'message'], ['texte', 'x']])).toMatchObject({ status: 403, data: { cible: 'publier', message: 'Vous ne pouvez pas publier sur ce mur.', valeurs: { mur: 'centre' } } });
		expect(await base.select().from(publication)).toHaveLength(0);
	});

	it('une annonce pour tout publieur ; la prise de connaissance, refusée hors modération avec un message clair', async () => {
		const { base, alice } = await preparer();
		expect(await agir(locaux(base, alice), [['mur', 'vie'], ['type', 'annonce'], ['texte', 'x'], ['priseDeConnaissance', 'oui']])).toMatchObject({
			status: 403,
			data: { message: 'Seuls les modérateurs du mur demandent une prise de connaissance.', valeurs: { type: 'annonce', priseDeConnaissance: true } }
		});
		expect(await base.select().from(publication)).toHaveLength(0);
		await reussir(locaux(base, alice), [['mur', 'vie'], ['type', 'annonce'], ['texte', 'À lire']]);
		expect(await derniere(base)).toMatchObject({ type: 'annonce', priseDeConnaissance: 0 });
	});

	it('chaque refus du sondage a son message, sur le champ « sondage »', async () => {
		const { base, alice } = await preparer();
		const m = maintenantParis().slice(0, 16);
		const sondage = (dates: [string, string][], autre: [string, string][] = [['type', 'message']]) =>
			agir(locaux(base, alice), [['mur', 'vie'], ...autre, ['texte', 'x'], ['question', 'Q'], ['reponse', 'Oui'], ['reponse', 'Non'], ...dates]);
		const cas: [[string, string][], string, [string, string][]?][] = [
			[[], 'Indiquez les dates d’ouverture et de clôture du sondage.'],
			[[['ouverture', m], ['cloture', '']], 'Indiquez les dates d’ouverture et de clôture du sondage.'],
			[[['ouverture', 'demain'], ['cloture', septJoursPlusTard(m)]], 'Indiquez une date et une heure d’ouverture valides.'],
			[[['ouverture', m], ['cloture', '2026-11-01T25:00']], 'Indiquez une date et une heure de clôture valides.'],
			[[['ouverture', m], ['cloture', m]], 'Le sondage doit se clore après son ouverture.'],
			[[['ouverture', m], ['cloture', `${Number(m.slice(0, 4)) + 2}${m.slice(4)}`]], 'Le sondage ne peut pas durer plus d’un an.'],
			[[['ouverture', m], ['cloture', septJoursPlusTard(demain())]], 'Le sondage doit se clore au plus tard au début de l’événement.', [['type', 'evenement'], ['debut', demain()], ['lieu', 'Ici']]]
		];
		for (const [dates, message, autre] of cas) expect(await sondage(dates, autre), message).toMatchObject({ status: 400, data: { erreurs: { sondage: message } } });
		const vie = (corps: [string, string][]) => agir(locaux(base, alice), [['mur', 'vie'], ['type', 'message'], ['texte', 'x'], ...champsDates(), ...corps]);
		expect(await vie([['question', 'Q'], ['reponse', 'Oui']])).toMatchObject({ status: 400, data: { erreurs: { sondage: 'Proposez de 2 à 6 réponses.' } } });
		expect(await vie([['reponse', 'Oui'], ['reponse', 'Non']])).toMatchObject({ status: 400, data: { erreurs: { sondage: 'Indiquez la question du sondage.' } } });
		expect(await vie([['question', 'q'.repeat(201)], ['reponse', 'Oui'], ['reponse', 'Non']])).toMatchObject({ status: 400, data: { erreurs: { sondage: 'La question ne peut pas dépasser 200 caractères.' } } });
		expect(await vie([['question', 'Q'], ['reponse', 'r'.repeat(101)], ['reponse', 'Non']])).toMatchObject({ status: 400, data: { erreurs: { sondage: 'Une réponse ne peut pas dépasser 100 caractères.' } } });
		expect(await base.select().from(publication)).toHaveLength(0);
	});

	it('sans sondage, les dates préremplies sont ignorées', async () => {
		const { base, alice } = await preparer();
		await reussir(locaux(base, alice), [['mur', 'vie'], ['type', 'message'], ['texte', 'x'], ...champsDates(), ['reponse', ''], ['question', ' ']]);
		expect(await derniere(base)).toMatchObject({ sondageQuestion: null, sondageOuverture: null });
	});
});

describe('taille des envois', () => {
	it('refuse avant lecture un envoi sans longueur ou de plus de 1,7 Mo', async () => {
		const { base, alice } = await preparer();
		const sansLongueur = new Request('http://x', { method: 'POST', body: new URLSearchParams({ mur: 'vie', type: 'message', texte: 'x' }) });
		sansLongueur.headers.delete('content-length');
		expect(await envoyer(locaux(base, alice), sansLongueur)).toMatchObject({ status: 413, data: { cible: 'publier', message: expect.stringContaining('trop lourd') } });
		const enorme = new Request('http://x', { method: 'POST', body: 'x', headers: { 'content-type': 'multipart/form-data; boundary=a', 'content-length': String(50 * 1024 * 1024) } });
		expect(await envoyer(locaux(base, alice), enorme)).toMatchObject({ status: 413 });
		expect(await base.select().from(publication)).toHaveLength(0);
	});

	it('accepte 4 photos de 400 Ko et le texte', async () => {
		const { base, alice } = await preparer();
		const photos = Array.from({ length: 4 }, (_, i): [string, File] => ['photos', jpeg(400 * 1024, `p${i}.jpg`)]);
		const r = await reussir(locaux(base, alice), [['mur', 'vie'], ['type', 'message'], ['texte', 'x'.repeat(4000)], ['question', 'q'.repeat(200)], ['reponse', 'r'.repeat(100)], ['reponse', 'r'.repeat(100)], ...champsDates(), ...photos]);
		expect(r.status).toBe(303);
	});
});
