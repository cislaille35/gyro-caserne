import { aujourdhuiParis } from '../aujourdhui.ts';

const jour = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`);
const format = (options: Intl.DateTimeFormatOptions, iso: string) => new Intl.DateTimeFormat('fr-FR', { ...options, timeZone: 'UTC' }).format(jour(iso));

// « 9 h », « 14 h 05 »
export function heure(iso: string): string {
	const [h, m] = iso.slice(11, 16).split(':');
	return m === '00' ? `${Number(h)} h` : `${Number(h)} h ${m}`;
}

// « jeudi 5 nov., 19 h », l'heure jamais coupée en fin de ligne (espaces insécables).
export function jourEtHeure(iso: string): string {
	return `${format({ weekday: 'long', day: 'numeric', month: 'short' }, iso)}, ${heure(iso).replaceAll(' ', '\u00a0')}`;
}

// « Du 29 oct. au lundi 2 nov., 20 h »
export function periodeSondage(ouverture: string, cloture: string): string {
	return `Du ${format({ day: 'numeric', month: 'short' }, ouverture)} au ${jourEtHeure(cloture)}`;
}

// Quand une publication est parue, en bref : « 9 h », « hier », « lun. », « 22 oct. ». Les dates sont à l'heure de Paris.
export function quand(creeLe: string, aujourdhui = aujourdhuiParis()): string {
	const ecart = Math.round((jour(aujourdhui).getTime() - jour(creeLe).getTime()) / 864e5);
	if (ecart <= 0) return heure(creeLe);
	if (ecart === 1) return 'hier';
	if (ecart < 7) return format({ weekday: 'short' }, creeLe);
	return format({ day: 'numeric', month: 'short' }, creeLe);
}
