import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import centreExemple from '../../../centres/exemple/centre.ts';
import { chargerJeuDeDepart } from '../src/jeu-de-depart.ts';
import { classer, lireOpenMeteo, lireVigilance, mettreAJourReleves, relevesDe, texteMeteo, URL_VIGILANCE, vueMeteo } from '../src/meteo.ts';
import { abonner } from '../src/notifications.ts';
import { envoiPush, personne, profil, releve } from '../src/schema.ts';
import { baseDeTest } from './base-de-test.ts';

const lieu = { position: { latitude: 48.1, longitude: -1.7 }, departement: '35' };

// Réponse d'Open-Meteo (champ `current`), valeurs fictives.
const openMeteo = (current: Record<string, number>) => ({ latitude: 48.1, longitude: -1.7, current: { time: '2026-11-02T10:00', interval: 900, ...current } });
const averses = openMeteo({ temperature_2m: 11.6, weather_code: 80, wind_gusts_10m: 45.2 });

// Réponse de l'API Vigilance (cartevigilance/encours), réduite à ce qui sert ; d'après le descriptif technique de Météo-France.
const phenomenes = (couleurs: Record<number, number>) => Object.entries(couleurs).map(([id, c]) => ({ phenomenon_id: id, phenomenon_max_color_id: c }));
const vigilance = (j: Record<number, number>, j1: Record<number, number> = {}) => ({
	product: {
		update_time: '2026-11-02T06:00:00Z',
		periods: [
			{ echeance: 'J', timelaps: { domain_ids: [{ domain_id: '29', max_color_id: 4, phenomenon_items: phenomenes({ 1: 4 }) }, { domain_id: '35', max_color_id: Math.max(1, ...Object.values(j)), phenomenon_items: phenomenes(j) }] } },
			{ echeance: 'J1', timelaps: { domain_ids: [{ domain_id: '35', max_color_id: Math.max(1, ...Object.values(j1)), phenomenon_items: phenomenes(j1) }] } }
		]
	}
});

describe('classer', () => {
	it.each([
		[95, 15, 10, 'orage'],
		[73, -1, 10, 'neige'],
		[3, 12, 70, 'vent'],
		[61, 12, 20, 'pluie'],
		[81, 12, 20, 'pluie'],
		[45, 8, 5, 'brouillard'],
		[0, 32, 10, 'chaleur'],
		[1, -2, 10, 'gel'],
		[3, 12, 10, 'nuageux'],
		[0, 12, 10, 'clair']
	] as const)('code %i, %i °C, rafales %i km/h : %s', (code, t, r, attendu) => {
		expect(classer(code, t, r)).toBe(attendu);
	});
});

describe('texteMeteo', () => {
	it('température arrondie, temps, rafales dès 40 km/h', () => {
		expect(texteMeteo({ temperature: 11.6, code: 80, rafales: 45.2 })).toBe('12 °C, averses, rafales 45 km/h');
		expect(texteMeteo({ temperature: -0.4, code: 0, rafales: 12 })).toBe('0 °C, ciel dégagé');
		expect(texteMeteo({ temperature: 9, code: 999, rafales: null })).toBe('9 °C');
	});
});

describe('lireOpenMeteo', () => {
	it('is_day à 0 : la nuit', () => {
		expect(lireOpenMeteo({ current: { temperature_2m: 10, weather_code: 0, is_day: 0 } })?.nuit).toBe(true);
		expect(lireOpenMeteo({ current: { temperature_2m: 10, weather_code: 0, is_day: 1 } })?.nuit).toBe(false);
	});

	it('lit le temps du moment', () => {
		expect(lireOpenMeteo(averses)).toEqual({ temperature: 11.6, code: 80, rafales: 45.2, nuit: false });
	});
	it('rend null sur une réponse inattendue', () => {
		expect(lireOpenMeteo(null)).toBeNull();
		expect(lireOpenMeteo({ current: { temperature_2m: 'chaud' } })).toBeNull();
		expect(lireOpenMeteo({ error: true, reason: 'Latitude must be in range' })).toBeNull();
	});
});

describe('lireVigilance', () => {
	it('le département du centre, aujourd’hui et demain, phénomènes du niveau le plus haut', () => {
		expect(lireVigilance(vigilance({ 1: 2, 3: 3, 2: 3 }, { 3: 2 }), '35', '2026-11-02')).toEqual([
			{ date: '2026-11-02', niveau: 3, phenomenes: ['pluie-inondation', 'orages'] },
			{ date: '2026-11-03', niveau: 2, phenomenes: ['orages'] }
		]);
	});
	it('rend null en cas de doute : département absent, niveau inconnu, format changé', () => {
		expect(lireVigilance(vigilance({ 3: 3 }), '22', '2026-11-02')).toBeNull();
		expect(lireVigilance(vigilance({ 3: 7 }), '35', '2026-11-02')).toBeNull();
		expect(lireVigilance({ product: { periods: 'non' } }, '35', '2026-11-02')).toBeNull();
		expect(lireVigilance('<html>', '35', '2026-11-02')).toBeNull();
		// Sans échéance J ou J1, on ne devine pas le jour.
		const sansEcheance = vigilance({ 3: 3 });
		for (const p of sansEcheance.product.periods) delete (p as { echeance?: string }).echeance;
		expect(lireVigilance(sansEcheance, '35', '2026-11-02')).toBeNull();
	});
	it('vert partout : aucun phénomène', () => {
		expect(lireVigilance(vigilance({}), '35', '2026-11-02')?.[0]).toEqual({ date: '2026-11-02', niveau: 1, phenomenes: [] });
	});
});

describe('vueMeteo', () => {
	const meteo = { temperature: 11.6, code: 80, rafales: 45.2 };
	it('la nuit vient d’Open-Meteo ; un relevé plus ancien compte comme de jour', () => {
		expect(vueMeteo({ meteo: { temperature: 12, code: 0, rafales: null, nuit: true }, vigilance: null }, '2026-11-04').meteo?.nuit).toBe(true);
		expect(vueMeteo({ meteo: { temperature: 12, code: 0, rafales: null }, vigilance: null }, '2026-11-04').meteo?.nuit).toBe(false);
	});

	it('la ligne, l’ambiance et la vigilance dès l’orange, jour par jour', () => {
		const jours = [
			{ date: '2026-11-01', niveau: 4, phenomenes: ['vent violent'] },
			{ date: '2026-11-02', niveau: 3, phenomenes: ['pluie-inondation', 'orages'] },
			{ date: '2026-11-03', niveau: 4, phenomenes: ['orages'] }
		];
		expect(vueMeteo({ meteo, vigilance: jours }, '2026-11-02', 'Ille-et-Vilaine')).toEqual({
			meteo: { ambiance: 'pluie', texte: '12 °C, averses, rafales 45 km/h', nuit: false },
			vigilance: { etat: 'ok', niveau: 4, lignes: ['Vigilance orange pluie-inondation et orages, aujourd’hui', 'Vigilance rouge orages, demain'], lieu: 'Ille-et-Vilaine' }
		});
	});
	it('vert : le niveau seul ; jaune : le phénomène et le jour ; le plus élevé des deux jours décide', () => {
		const vue = (jours: { date: string; niveau: number; phenomenes: string[] }[]) => vueMeteo({ meteo: null, vigilance: jours }, '2026-11-02', '35').vigilance;
		expect(vue([{ date: '2026-11-02', niveau: 1, phenomenes: [] }, { date: '2026-11-03', niveau: 1, phenomenes: [] }])).toEqual({ etat: 'ok', niveau: 1, lignes: [], lieu: '35' });
		expect(vue([{ date: '2026-11-02', niveau: 1, phenomenes: [] }, { date: '2026-11-03', niveau: 2, phenomenes: ['orages', 'vent violent'] }])).toEqual({
			etat: 'ok',
			niveau: 2,
			lignes: ['Vigilance jaune orages et vent violent, demain'],
			lieu: '35'
		});
		expect(vue([{ date: '2026-11-02', niveau: 2, phenomenes: ['orages'] }])).toMatchObject({ lignes: ['Vigilance jaune orages, aujourd’hui'] });
		// Orange aujourd'hui, jaune demain : le bandeau ne parle que de l'orange.
		expect(vue([{ date: '2026-11-02', niveau: 3, phenomenes: ['orages'] }, { date: '2026-11-03', niveau: 2, phenomenes: ['vent violent'] }])).toMatchObject({ niveau: 3, lignes: ['Vigilance orange orages, aujourd’hui'] });
	});
	it('passé minuit, le jour d’hier disparaît et « demain » devient « aujourd’hui »', () => {
		const jours = [{ date: '2026-11-02', niveau: 3, phenomenes: ['orages'] }, { date: '2026-11-03', niveau: 2, phenomenes: ['vent violent'] }];
		expect(vueMeteo({ meteo: null, vigilance: jours }, '2026-11-03', '35').vigilance).toEqual({ etat: 'ok', niveau: 2, lignes: ['Vigilance jaune vent violent, aujourd’hui'], lieu: '35' });
	});
	it('relevé indisponible : signalé ; sans relevé ou jours sans rapport : rien ou indisponible', () => {
		expect(vueMeteo({ meteo: null, vigilance: 'indisponible' }, '2026-11-02').vigilance).toEqual({ etat: 'indisponible' });
		expect(vueMeteo({ meteo: null, vigilance: [{ date: '2026-10-30', niveau: 1, phenomenes: [] }] }, '2026-11-02').vigilance).toEqual({ etat: 'indisponible' });
		expect(vueMeteo({ meteo: null, vigilance: null }, '2026-11-02').vigilance).toBeNull();
	});
});

// Un faux réseau : chaque adresse appelée est notée ; la réponse dépend de l'adresse.
function reseau(reponses: { meteo?: unknown; vigilance?: unknown }) {
	const appels: { url: string; cle: string | null }[] = [];
	const recuperer = async (url: string | URL | Request, init?: RequestInit) => {
		const u = String(url);
		appels.push({ url: u, cle: new Headers(init?.headers).get('apikey') });
		const corps = u.startsWith(URL_VIGILANCE) ? reponses.vigilance : reponses.meteo;
		if (corps === undefined) return new Response('indisponible', { status: 503 });
		return Response.json(corps);
	};
	return { appels, recuperer: recuperer as typeof fetch };
}

describe('mettreAJourReleves et relevesDe', () => {
	it('interroge Open-Meteo à la position du centre, range le relevé, le relit en une requête', async () => {
		const base = await baseDeTest();
		const { appels, recuperer } = reseau({ meteo: averses });
		await mettreAJourReleves(base, lieu, '2026-11-02T10:00', recuperer, undefined);
		expect(appels).toHaveLength(1);
		expect(appels[0]!.url).toContain('latitude=48.1&longitude=-1.7');
		const avant = base.requetes;
		expect(await relevesDe(base, '2026-11-02T10:30')).toEqual({ meteo: { temperature: 11.6, code: 80, rafales: 45.2, nuit: false }, vigilance: null });
		expect(base.requetes - avant).toBe(1);
	});

	it('deux délais : la vigilance à chaque réveil (toutes les 10 minutes), la météo toutes les heures', async () => {
		const base = await baseDeTest();
		const r = reseau({ meteo: averses, vigilance: vigilance({ 1: 1 }) });
		const vig = () => r.appels.filter((a) => a.url.startsWith(URL_VIGILANCE)).length;
		for (const h of ['10:00', '10:05', '10:09']) await mettreAJourReleves(base, lieu, `2026-11-02T${h}`, r.recuperer, 'cle');
		expect(vig()).toBe(1);
		await mettreAJourReleves(base, lieu, '2026-11-02T10:10', r.recuperer, 'cle');
		expect(vig()).toBe(2);
		expect(r.appels).toHaveLength(3);
		await mettreAJourReleves(base, lieu, '2026-11-02T11:00', r.recuperer, 'cle');
		expect(r.appels).toHaveLength(5);
	});

	it('vigilance : valable moins de 2 heures, ensuite « indisponible » ; sans lecture réussie avec une clé : « indisponible » aussi', async () => {
		const base = await baseDeTest();
		await mettreAJourReleves(base, lieu, '2026-11-02T10:00', reseau({ meteo: averses, vigilance: vigilance({ 1: 1 }) }).recuperer, 'cle');
		expect((await relevesDe(base, '2026-11-02T11:59')).vigilance).toEqual([{ date: '2026-11-02', niveau: 1, phenomenes: [] }, { date: '2026-11-03', niveau: 1, phenomenes: [] }]);
		expect((await relevesDe(base, '2026-11-02T12:00')).vigilance).toBe('indisponible');
		// La météo garde sa règle des 6 heures.
		expect((await relevesDe(base, '2026-11-02T12:00')).meteo).not.toBeNull();
		const neuve = await baseDeTest();
		await mettreAJourReleves(neuve, lieu, '2026-11-02T10:00', reseau({ meteo: averses }).recuperer, 'cle');
		expect((await relevesDe(neuve, '2026-11-02T10:05')).vigilance).toBe('indisponible');
		// Une lecture ratée ne remplace pas un bon relevé.
		await mettreAJourReleves(base, lieu, '2026-11-02T10:15', reseau({ meteo: averses }).recuperer, 'cle');
		expect((await relevesDe(base, '2026-11-02T10:20')).vigilance).toHaveLength(2);
	});

	it('une fois par heure : un relevé récent n’est pas redemandé', async () => {
		const base = await baseDeTest();
		const { appels, recuperer } = reseau({ meteo: averses });
		await mettreAJourReleves(base, lieu, '2026-11-02T10:00', recuperer, undefined);
		await mettreAJourReleves(base, lieu, '2026-11-02T10:50', recuperer, undefined);
		expect(appels).toHaveLength(1);
		await mettreAJourReleves(base, lieu, '2026-11-02T11:00', recuperer, undefined);
		expect(appels).toHaveLength(2);
	});

	it('API muette : l’ancien relevé est gardé, puis oublié après 6 h', async () => {
		const base = await baseDeTest();
		await mettreAJourReleves(base, lieu, '2026-11-02T10:00', reseau({ meteo: averses }).recuperer, undefined);
		await mettreAJourReleves(base, lieu, '2026-11-02T12:00', reseau({}).recuperer, undefined);
		await mettreAJourReleves(base, lieu, '2026-11-02T13:00', reseau({ meteo: { reason: 'erreur' } }).recuperer, undefined);
		expect((await relevesDe(base, '2026-11-02T15:59')).meteo).not.toBeNull();
		expect((await relevesDe(base, '2026-11-02T16:01')).meteo).toBeNull();
	});

	it('réseau en panne (exception) : rien ne casse', async () => {
		const base = await baseDeTest();
		const panne = (async () => {
			throw new Error('réseau');
		}) as typeof fetch;
		await expect(mettreAJourReleves(base, lieu, '2026-11-02T10:00', panne, 'cle')).resolves.toBeUndefined();
		expect(await relevesDe(base, '2026-11-02T10:00')).toEqual({ meteo: null, vigilance: 'indisponible' });
	});

	it('sans clé, ou sans département, la vigilance n’est jamais demandée', async () => {
		const base = await baseDeTest();
		const r = reseau({ meteo: averses, vigilance: vigilance({ 3: 3 }) });
		await mettreAJourReleves(base, lieu, '2026-11-02T10:00', r.recuperer, undefined);
		await mettreAJourReleves(base, { position: lieu.position }, '2026-11-02T12:00', r.recuperer, 'cle');
		expect(r.appels.some((a) => a.url.startsWith(URL_VIGILANCE))).toBe(false);
		expect((await relevesDe(base, '2026-11-02T12:00')).vigilance).toBeNull();
	});

	it('avec la clé : la vigilance est lue, la clé passe en en-tête', async () => {
		const base = await baseDeTest();
		const r = reseau({ meteo: averses, vigilance: vigilance({ 3: 3 }) });
		await mettreAJourReleves(base, lieu, '2026-11-02T10:00', r.recuperer, 'cle-fictive');
		expect(r.appels.find((a) => a.url.startsWith(URL_VIGILANCE))?.cle).toBe('cle-fictive');
		expect((await relevesDe(base, '2026-11-02T10:00')).vigilance?.[0]).toEqual({ date: '2026-11-02', niveau: 3, phenomenes: ['orages'] });
	});
});

describe('passage au rouge', () => {
	// Deux agents abonnés, dont un parti (sans accès) : seul le premier est prévenu.
	async function jeu() {
		const base = await baseDeTest();
		await chargerJeuDeDepart(base, centreExemple);
		const [p] = await base.select().from(profil).where(eq(profil.nom, 'Agent'));
		const [alice, bruno] = await base
			.insert(personne)
			.values([
				{ email: 'alice@exemple.fr', prenom: 'Alice', nom: 'Fictive', profilId: p!.id },
				{ email: 'bruno@exemple.fr', prenom: 'Bruno', nom: 'Fictif', profilId: p!.id }
			])
			.returning();
		for (const [q, nom] of [[alice!, 'Alice'], [bruno!, 'Bruno']] as const) {
			await abonner(base, { type: 'personne', id: q.id }, { endpoint: `https://fcm.googleapis.com/fcm/send/${nom}`, p256dh: 'BCle', auth: 'secret', appareil: 'Téléphone' }, '2026-11-01T10:00');
		}
		await base.update(personne).set({ statut: 'parti' }).where(eq(personne.id, bruno!.id));
		return base;
	}
	const envois = async (base: Awaited<ReturnType<typeof baseDeTest>>) => (await base.select().from(envoiPush)).map((e) => JSON.parse(e.donnees));

	it('prévient tous les agents une fois par épisode', async () => {
		const base = await jeu();
		const rouge = reseau({ meteo: averses, vigilance: vigilance({ 3: 3 }, { 3: 4 }) }).recuperer;
		await mettreAJourReleves(base, lieu, '2026-11-02T10:00', rouge, 'cle');
		expect(await envois(base)).toEqual([{ titre: 'Vigilance rouge', texte: 'Vigilance rouge orages, demain. Suivez les consignes de Météo-France.', url: '/', tag: 'vigilance:rouge' }]);
		await mettreAJourReleves(base, lieu, '2026-11-02T11:00', rouge, 'cle');
		await mettreAJourReleves(base, lieu, '2026-11-02T12:00', reseau({ meteo: averses }).recuperer, 'cle');
		expect(await envois(base)).toHaveLength(1);
		// Fin de l'épisode, puis un nouveau.
		await mettreAJourReleves(base, lieu, '2026-11-02T13:00', reseau({ meteo: averses, vigilance: vigilance({ 3: 2 }) }).recuperer, 'cle');
		await mettreAJourReleves(base, lieu, '2026-11-02T14:00', rouge, 'cle');
		expect(await envois(base)).toHaveLength(2);
	});

	it('lue toutes les 10 minutes, l’alerte ne repart pas ; une lecture ratée au milieu non plus', async () => {
		const base = await jeu();
		const rouge = reseau({ meteo: averses, vigilance: vigilance({ 3: 4 }) }).recuperer;
		const panne = reseau({ meteo: averses }).recuperer;
		for (const h of ['10:00', '10:10', '10:20']) await mettreAJourReleves(base, lieu, `2026-11-02T${h}`, rouge, 'cle');
		await mettreAJourReleves(base, lieu, '2026-11-02T10:30', panne, 'cle');
		for (const h of ['10:40', '10:50', '11:00']) await mettreAJourReleves(base, lieu, `2026-11-02T${h}`, rouge, 'cle');
		expect(await envois(base)).toHaveLength(1);
	});

	it('l’orange ne prévient personne', async () => {
		const base = await jeu();
		await mettreAJourReleves(base, lieu, '2026-11-02T10:00', reseau({ meteo: averses, vigilance: vigilance({ 3: 3 }) }).recuperer, 'cle');
		expect(await envois(base)).toEqual([]);
		expect(await base.select().from(releve)).toHaveLength(2);
	});
});
