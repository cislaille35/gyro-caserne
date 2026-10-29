import { aujourdhuiParis } from '../aujourdhui.ts';

const jour = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`);
const format = (options: Intl.DateTimeFormatOptions, iso: string) => new Intl.DateTimeFormat('fr-FR', { ...options, timeZone: 'UTC' }).format(jour(iso));

// Quand une publication est parue, en bref : « 9 h », « hier », « lun. », « 22 oct. ». Les dates sont à l'heure de Paris.
export function quand(creeLe: string, aujourdhui = aujourdhuiParis()): string {
	const ecart = Math.round((jour(aujourdhui).getTime() - jour(creeLe).getTime()) / 864e5);
	if (ecart <= 0) {
		const [h, m] = creeLe.slice(11, 16).split(':');
		return m === '00' ? `${Number(h)} h` : `${Number(h)} h ${m}`;
	}
	if (ecart === 1) return 'hier';
	if (ecart < 7) return format({ weekday: 'short' }, creeLe);
	return format({ day: 'numeric', month: 'short' }, creeLe);
}
