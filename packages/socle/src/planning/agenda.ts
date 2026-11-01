import { eq } from 'drizzle-orm';
import type { Base } from '../base.ts';
import { ajouterJours, exigerDateHeure } from '../dates.ts';
import { aLeDroit, type Acteur } from '../droits.ts';
import { DonneeInvalide } from '../erreurs.ts';
import { affectationEquipe, cleAgenda } from '../schema.ts';
import { fetes, type Reglage } from './calendrier.ts';
import { anneesPubliees, convoque, equipeLe, lectures, vueManoeuvre } from './annee.ts';

// L'abonnement d'agenda : un fichier iCalendar (RFC 5545) propre à chaque agent, au bout d'un lien qui porte une clé secrète.
// La clé n'est jamais écrite au journal ; elle est comparée en temps constant.

const FORME = /^([1-9]\d{0,9})-([A-Za-z0-9_-]{43})$/;
// Durée affichée d'une manœuvre (seule l'heure de début est saisie).
const DUREE_MANOEUVRE_H = 3;

export function egaux(a: string, b: string): boolean {
	const x = new TextEncoder().encode(a);
	const y = new TextEncoder().encode(b);
	let difference = x.length ^ y.length;
	for (let i = 0; i < Math.max(x.length, y.length); i++) difference |= (x[i] ?? 0) ^ (y[i] ?? 0);
	return difference === 0;
}

function cleAleatoire(): string {
	const octets = crypto.getRandomValues(new Uint8Array(32));
	return btoa(String.fromCharCode(...octets)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

const moiDe = (acteur: Acteur) => {
	if (acteur.type !== 'personne') throw new DonneeInvalide('Réservé aux personnes ayant une fiche');
	return acteur.id;
};

// Le lien de la personne (« <id>-<clé> ») ; créé au premier appel.
export async function monLienAgenda(base: Base, acteur: Acteur, maintenant: string): Promise<string> {
	exigerDateHeure(maintenant, 'Date');
	const moi = moiDe(acteur);
	const [, lignes] = await base.batch([
		base.insert(cleAgenda).values({ personneId: moi, cle: cleAleatoire(), creeLe: maintenant }).onConflictDoNothing(),
		base.select({ cle: cleAgenda.cle }).from(cleAgenda).where(eq(cleAgenda.personneId, moi))
	]);
	return `${moi}-${lignes[0]!.cle}`;
}

// « Changer le lien » : l'ancien cesse de marcher.
export async function changerLienAgenda(base: Base, acteur: Acteur, maintenant: string): Promise<string> {
	exigerDateHeure(maintenant, 'Date');
	const moi = moiDe(acteur);
	const cle = cleAleatoire();
	await base.insert(cleAgenda).values({ personneId: moi, cle, creeLe: maintenant }).onConflictDoUpdate({ target: cleAgenda.personneId, set: { cle, creeLe: maintenant } });
	return `${moi}-${cle}`;
}

const parisFormat = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const horlogeParis = (ms: number) => {
	const p = Object.fromEntries(parisFormat.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
	return Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00Z`);
};

// « AAAA-MM-JJTHH:MM » de Paris → « AAAAMMJJTHHMMSSZ ».
export function versUtc(local: string): string {
	const voulu = Date.parse(`${local.slice(0, 16)}:00Z`);
	let t = voulu - 3_600_000;
	for (let i = 0; i < 3; i++) t += voulu - horlogeParis(t);
	return new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

// Un retour à la ligne devient « \n » ; les autres caractères de contrôle disparaissent : un texte n'ajoute jamais de ligne.
const echapper = (texte: string) =>
	texte
		.replaceAll('\\', '\\\\')
		.replaceAll(';', '\\;')
		.replaceAll(',', '\\,')
		.replace(/\r\n?|\n/g, '\\n')
		.replace(/[\u0000-\u001f\u007f]/g, '');

// Une ligne de 75 octets au plus ; la suite commence par une espace.
function plier(ligne: string): string {
	const morceaux: string[] = [];
	let courant = '';
	let octets = 0;
	for (const c of ligne) {
		const n = new TextEncoder().encode(c).length;
		if (octets + n > (morceaux.length ? 74 : 75)) {
			morceaux.push(courant);
			courant = '';
			octets = 0;
		}
		courant += c;
		octets += n;
	}
	morceaux.push(courant);
	return morceaux.join('\r\n ');
}

type Evenement = { uid: string; debut: string; fin: string; titre: string; lieu?: string; description?: string; journee?: boolean };

// Le fichier de l'agent, ou null si le lien ne vaut rien (clé fausse ou changée, agent sans accès au planning).
// Années publiées autour d'aujourd'hui : l'an dernier, cette année, l'an prochain.
export async function agendaDe(base: Base, fichier: string, maintenant: string, reglage: Reglage): Promise<string | null> {
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	const forme = FORME.exec(fichier);
	if (!forme) return null;
	const id = Number(forme[1]);
	const [ligne] = await base.select({ cle: cleAgenda.cle }).from(cleAgenda).where(eq(cleAgenda.personneId, id));
	if (!egaux(ligne?.cle ?? '', forme[2]!) || !ligne) return null;
	if (!(await aLeDroit(base, { type: 'personne', id }, 'VOIR_PLANNING', { type: 'centre' }, aujourdhui))) return null;

	const annee = Number(aujourdhui.slice(0, 4));
	const [[annees, changees, manoeuvres, , equipes], affectations] = await Promise.all([
		base.batch(lectures(base, `${annee - 1}-01-01`, `${annee + 1}-12-31`)),
		base.select({ equipeId: affectationEquipe.equipeId, debut: affectationEquipe.debut, fin: affectationEquipe.fin }).from(affectationEquipe).where(eq(affectationEquipe.personneId, id))
	]);
	const nom = (equipeId: number) => equipes.find((e) => e.id === equipeId)?.nom ?? 'Équipe';
	const publiees = anneesPubliees(annees.filter((a) => Math.abs(a.annee - annee) <= 1), changees, reglage);
	const evenements: Evenement[] = [];
	for (const [a, semaines] of publiees) {
		for (const s of semaines) {
			if (equipeLe(affectations, s.debut) !== s.equipeId) continue;
			s.periodes.forEach((p, i) => evenements.push({ uid: `astreinte-${s.debut}-${i}`, debut: p.debut, fin: p.fin, titre: `Astreinte · ${nom(s.equipeId)}` }));
		}
		const f = fetes(a, semaines);
		for (const [cle, libelle, date, equipeId] of [
			['noel', 'Noël', `${a}-12-25`, f.noel],
			['nouvel-an', 'Nouvel An', `${a}-12-31`, f.nouvelAn]
		] as const) {
			if (equipeId !== null && equipeLe(affectations, date) === equipeId) evenements.push({ uid: `fete-${cle}-${a}`, debut: date, fin: ajouterJours(date, 1), titre: `Garde de ${libelle} · ${nom(equipeId)}`, journee: true });
		}
	}
	for (const m of manoeuvres.map(vueManoeuvre)) {
		if (m.annulee || !publiees.has(Number(m.debut.slice(0, 4))) || !convoque(m.convoques, equipeLe(affectations, m.debut.slice(0, 10)))) continue;
		const fin = new Date(Date.parse(`${m.debut}:00Z`) + DUREE_MANOEUVRE_H * 3_600_000).toISOString().slice(0, 16);
		evenements.push({ uid: `manoeuvre-${m.id}`, debut: m.debut, fin, titre: `Manœuvre : ${m.theme}`, lieu: m.lieu, description: m.petitDejeuner ? 'Petit-déjeuner prévu.' : undefined });
	}

	const stamp = versUtc(maintenant);
	const lignes = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Gyro Caserne//Planning//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Mon planning (Gyro Caserne)', 'REFRESH-INTERVAL;VALUE=DURATION:PT6H', 'X-PUBLISHED-TTL:PT6H'];
	for (const e of evenements) {
		lignes.push('BEGIN:VEVENT', `UID:${e.uid}@gyro-caserne`, `DTSTAMP:${stamp}`);
		if (e.journee) lignes.push(`DTSTART;VALUE=DATE:${e.debut.replaceAll('-', '')}`, `DTEND;VALUE=DATE:${e.fin.replaceAll('-', '')}`);
		else lignes.push(`DTSTART:${versUtc(e.debut)}`, `DTEND:${versUtc(e.fin)}`);
		lignes.push(`SUMMARY:${echapper(e.titre)}`);
		if (e.lieu) lignes.push(`LOCATION:${echapper(e.lieu)}`);
		if (e.description) lignes.push(`DESCRIPTION:${echapper(e.description)}`);
		lignes.push('END:VEVENT');
	}
	lignes.push('END:VCALENDAR');
	return `${lignes.map(plier).join('\r\n')}\r\n`;
}
