import { inArray } from 'drizzle-orm';
import type { Base } from './base.ts';
import { ajouterJours } from './dates.ts';
import { STATUTS_AVEC_ACCES } from './listes.ts';
import { mettreEnFile } from './notifications.ts';
import { personne, releve } from './schema.ts';

// La météo du centre (Open-Meteo) et la vigilance de son département (Météo-France). Une information pour l'ambiance, jamais une décision.

export const AMBIANCES = ['clair', 'nuageux', 'pluie', 'orage', 'neige', 'vent', 'brouillard', 'chaleur', 'gel'] as const;
export type Ambiance = (typeof AMBIANCES)[number];

// `nuit` : le soleil est couché au centre (absent des relevés écrits avant : compté comme de jour).
export type Meteo = { temperature: number; code: number; rafales: number | null; nuit?: boolean };
export type JourVigilance = { date: string; niveau: number; phenomenes: string[] };
// vigilance : null = aucun relevé (pas de clé, rien à montrer) ; 'indisponible' = relevé trop vieux ou lecture jamais réussie.
export type Releves = { meteo: Meteo | null; vigilance: JourVigilance[] | 'indisponible' | null };
export type VueVigilance = { etat: 'ok'; niveau: number; lignes: string[]; lieu: string } | { etat: 'indisponible' };
export type VueMeteo = { meteo: { ambiance: Ambiance; texte: string; nuit: boolean } | null; vigilance: VueVigilance | null };

export const URL_VIGILANCE = 'https://public-api.meteofrance.fr/public/DPVigilance/v1/cartevigilance/encours';
const UNE_HEURE = 60;
const SIX_HEURES = 6 * 60;
// La vigilance est relue à chaque réveil, toutes les 10 minutes (144 appels par jour), et n'est plus montrée au-delà de 2 heures.
const DIX_MINUTES = 10;
const DEUX_HEURES = 2 * 60;

// Codes WMO d'Open-Meteo. Priorité : orage, neige, vent fort, pluie, brouillard, chaleur, gel, nuages.
export function classer(code: number, temperature: number | null, rafales: number | null): Ambiance {
	if ([95, 96, 99].includes(code)) return 'orage';
	if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'neige';
	if ((rafales ?? 0) >= 60) return 'vent';
	if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'pluie';
	if (code === 45 || code === 48) return 'brouillard';
	if ((temperature ?? 0) >= 30) return 'chaleur';
	if (temperature !== null && temperature <= 0) return 'gel';
	if (code === 2 || code === 3) return 'nuageux';
	return 'clair';
}

function temps(code: number): string | null {
	if (code === 0) return 'ciel dégagé';
	if (code === 1 || code === 2) return 'éclaircies';
	if (code === 3) return 'couvert';
	if (code === 45 || code === 48) return 'brouillard';
	if (code >= 51 && code <= 55) return 'bruine';
	if (code === 56 || code === 57 || code === 66 || code === 67) return 'pluie verglaçante';
	if (code >= 61 && code <= 65) return 'pluie';
	if (code >= 71 && code <= 77) return 'neige';
	if (code >= 80 && code <= 82) return 'averses';
	if (code === 85 || code === 86) return 'averses de neige';
	if (code === 95) return 'orage';
	if (code === 96 || code === 99) return 'orage et grêle';
	return null;
}

// « 12 °C, averses, rafales 45 km/h » ; les rafales dès 40 km/h.
export function texteMeteo(m: Meteo): string {
	const rafales = m.rafales !== null && m.rafales >= 40 ? `rafales ${Math.round(m.rafales)} km/h` : null;
	return [`${Math.round(m.temperature) || 0} °C`, temps(m.code), rafales].filter(Boolean).join(', ');
}

const nombre = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export const urlOpenMeteo = (p: { latitude: number; longitude: number }) =>
	`https://api.open-meteo.com/v1/forecast?latitude=${p.latitude}&longitude=${p.longitude}&current=temperature_2m,weather_code,wind_gusts_10m,is_day&wind_speed_unit=kmh`;

// La réponse d'Open-Meteo ; null si elle n'a pas la forme attendue.
export function lireOpenMeteo(json: unknown): Meteo | null {
	const c = (json as { current?: Record<string, unknown> } | null)?.current;
	if (!c || !nombre(c.temperature_2m) || !nombre(c.weather_code)) return null;
	return { temperature: c.temperature_2m, code: c.weather_code, rafales: nombre(c.wind_gusts_10m) ? c.wind_gusts_10m : null, nuit: c.is_day === 0 };
}

// Phénomènes de la vigilance Météo-France, par numéro.
const PHENOMENES: Record<string, string> = {
	'1': 'vent violent',
	'2': 'pluie-inondation',
	'3': 'orages',
	'4': 'crues',
	'5': 'neige-verglas',
	'6': 'canicule',
	'7': 'grand froid',
	'8': 'avalanches',
	'9': 'vagues-submersion'
};
const niveauValide = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 4;

// La réponse de cartevigilance/encours pour un département : J (aujourd'hui) et J1 (demain). Au moindre doute, null.
export function lireVigilance(json: unknown, departement: string, aujourdhui: string): JourVigilance[] | null {
	const periodes = (json as { product?: { periods?: unknown } } | null)?.product?.periods;
	if (!Array.isArray(periodes)) return null;
	const jours: JourVigilance[] = [];
	for (const p of periodes) {
		const echeance = p?.echeance;
		if (echeance !== 'J' && echeance !== 'J1') continue;
		const domaines = p?.timelaps?.domain_ids;
		if (!Array.isArray(domaines)) return null;
		const d = domaines.find((x) => String(x?.domain_id) === departement);
		if (!d || !niveauValide(d.max_color_id) || !Array.isArray(d.phenomenon_items)) return null;
		const items: { phenomenon_id?: unknown; phenomenon_max_color_id?: unknown }[] = d.phenomenon_items;
		if (!items.every((x) => niveauValide(x?.phenomenon_max_color_id))) return null;
		const niveau: number = d.max_color_id;
		const phenomenes = items
			.filter((x) => niveau > 1 && x.phenomenon_max_color_id === niveau)
			.map((x) => Number(x.phenomenon_id))
			.sort((a, b) => a - b)
			.map((n) => PHENOMENES[String(n)])
			.filter((x): x is string => x !== undefined);
		jours.push({ date: echeance === 'J' ? aujourdhui : ajouterJours(aujourdhui, 1), niveau, phenomenes: [...new Set(phenomenes)] });
	}
	return jours.length > 0 ? jours : null;
}

const COULEURS: Record<number, string> = { 2: 'jaune', 3: 'orange', 4: 'rouge' };
const quand = (date: string, aujourdhui: string) => (date === aujourdhui ? 'aujourd’hui' : 'demain');
const ligneVigilance = (j: JourVigilance, aujourdhui: string) =>
	`Vigilance ${COULEURS[j.niveau]}${j.phenomenes.length ? ` ${j.phenomenes.join(', ').replace(/, ([^,]+)$/, ' et $1')}` : ''}, ${quand(j.date, aujourdhui)}`;

// Ce que montre l'Accueil : la ligne météo et l'ambiance ; la vigilance toujours (verte, jaune, orange, rouge), aujourd'hui et demain.
// Les lignes parlent des jours au niveau le plus élevé, sauf le vert qui n'en a pas. `lieu` : le nom (ou le numéro) du département.
export function vueMeteo(r: Releves, aujourdhui: string, lieu = ''): VueMeteo {
	const meteo = r.meteo ? { ambiance: classer(r.meteo.code, r.meteo.temperature, r.meteo.rafales), texte: texteMeteo(r.meteo), nuit: r.meteo.nuit === true } : null;
	if (r.vigilance === null) return { meteo, vigilance: null };
	const jours = r.vigilance === 'indisponible' ? [] : r.vigilance.filter((j) => j.date >= aujourdhui && j.date <= ajouterJours(aujourdhui, 1));
	if (jours.length === 0) return { meteo, vigilance: { etat: 'indisponible' } };
	const niveau = Math.max(...jours.map((j) => j.niveau));
	// Dès l'orange : tous les jours en orange ou plus ; en jaune : les jours jaunes.
	const concernes = jours.filter((j) => (niveau >= 3 ? j.niveau >= 3 : niveau === 2 && j.niveau === 2));
	return { meteo, vigilance: { etat: 'ok', niveau, lignes: concernes.map((j) => ligneVigilance(j, aujourdhui)), lieu } };
}

// Minutes entre deux moments « AAAA-MM-JJTHH:MM » (heure de Paris ; une heure d'écart au changement d'heure, sans conséquence).
const minutes = (de: string, a: string) => (Date.parse(`${a}:00Z`) - Date.parse(`${de}:00Z`)) / 60_000;

type Ligne = { cle: string; donnees: string; majLe: string };
const lire = <T>(lignes: Ligne[], cle: string, maintenant: string, age: number): T | null => {
	const l = lignes.find((x) => x.cle === cle);
	if (!l || !(minutes(l.majLe, maintenant) < age)) return null;
	try {
		return JSON.parse(l.donnees) as T;
	} catch {
		return null;
	}
};

// Les deux relevés, en une requête ; la météo n'est plus montrée au-delà de 6 h, la vigilance au-delà de 2 h.
export async function relevesDe(base: Base, maintenant: string): Promise<Releves> {
	const lignes = await base.select().from(releve);
	const vigilance = lignes.some((l) => l.cle === 'vigilance') ? (lire<{ jours: JourVigilance[] | null }>(lignes, 'vigilance', maintenant, DEUX_HEURES)?.jours ?? 'indisponible') : null;
	return { meteo: lire<Meteo>(lignes, 'meteo', maintenant, SIX_HEURES), vigilance };
}

async function demander(recuperer: typeof fetch, url: string, entetes: Record<string, string> = {}): Promise<unknown> {
	try {
		const r = await recuperer(url, { headers: { accept: 'application/json', ...entetes }, signal: AbortSignal.timeout(8000) });
		if (r.ok) return await r.json();
		// Le code seul (une clé refusée donne 401), jamais la clé.
		console.warn('Météo refusée', url.split('?')[0], r.status);
		return null;
	} catch (e) {
		console.warn('Météo indisponible', url.split('?')[0], e);
		return null;
	}
}

const ecrire = (base: Base, cle: string, donnees: unknown, maintenant: string) => {
	const valeurs = { cle, donnees: JSON.stringify(donnees), majLe: maintenant };
	return base.insert(releve).values(valeurs).onConflictDoUpdate({ target: releve.cle, set: valeurs });
};

// Appelée par la tâche planifiée : la météo de plus d'une heure et la vigilance de 10 minutes ou plus (celle du réveil précédent) sont redemandées. En cas d'échec, l'ancien relevé est gardé.
// Une première lecture ratée (clé refusée…) laisse une trace « sans jours » : l'Accueil dit alors « indisponible » au lieu de se taire.
// Vigilance : seulement avec la clé et le département. Au passage au rouge, tous les agents sont prévenus au téléphone, une fois par épisode.
export async function mettreAJourReleves(
	base: Base,
	lieu: { position: { latitude: number; longitude: number }; departement?: string },
	maintenant: string,
	recuperer: typeof fetch,
	cleVigilance: string | undefined
): Promise<void> {
	const lignes = await base.select().from(releve);
	const aRefaire = (cle: string, age: number) => lire(lignes, cle, maintenant, age) === null;
	const aujourdhui = maintenant.slice(0, 10);
	const ecritures = [];

	if (aRefaire('meteo', UNE_HEURE)) {
		const meteo = lireOpenMeteo(await demander(recuperer, urlOpenMeteo(lieu.position)));
		if (meteo) ecritures.push(ecrire(base, 'meteo', meteo, maintenant));
	}
	if (cleVigilance && lieu.departement && aRefaire('vigilance', DIX_MINUTES)) {
		const jours = lireVigilance(await demander(recuperer, URL_VIGILANCE, { apikey: cleVigilance }), lieu.departement, aujourdhui);
		if (!jours) {
			if (!lignes.some((l) => l.cle === 'vigilance')) ecritures.push(ecrire(base, 'vigilance', { jours: null }, maintenant));
		} else {
			const rouges = jours.filter((j) => j.niveau === 4);
			const avant = lire<{ rouge?: boolean }>(lignes, 'vigilance', maintenant, Infinity);
			ecritures.push(ecrire(base, 'vigilance', { jours, rouge: rouges.length > 0 }, maintenant));
			if (rouges.length > 0 && !avant?.rouge) {
				const texte = `${rouges.map((j) => ligneVigilance(j, aujourdhui)).join(' ; ')}. Suivez les consignes de Météo-France.`;
				const agents = base.select({ id: personne.id }).from(personne).where(inArray(personne.statut, STATUTS_AVEC_ACCES));
				ecritures.push(mettreEnFile(base, agents, 'meteo', { titre: 'Vigilance rouge', texte, url: '/', tag: 'vigilance:rouge' }, maintenant));
			}
		}
	}
	const [premiere, ...autres] = ecritures;
	if (premiere) await base.batch([premiere, ...autres]);
}
