import { LIBELLES_POSTE, type Poste } from '@gyro-caserne/socle';
import { pluriel } from '../pluriel.ts';

const jourCourt = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const heures = (p: { debut: string; fin: string }) => (Date.parse(`${p.fin}:00Z`) - Date.parse(`${p.debut}:00Z`)) / 3_600_000;

// « Ven. 25 juin · nuit », « Sam. 26 juin · 24 h ».
export function libellePlage(p: { debut: string; fin: string }): string {
	const jour = jourCourt.format(new Date(`${p.debut.slice(0, 10)}T00:00:00Z`));
	const duree = heures(p);
	const quoi = duree === 24 ? '24 h' : p.debut.slice(11, 16) >= '17:00' && duree <= 14 ? 'nuit' : `${Number(p.debut.slice(11, 13))} h – ${Number(p.fin.slice(11, 13))} h`;
	return `${jour.charAt(0).toUpperCase()}${jour.slice(1)} · ${quoi}`;
}

// « FPT armé : oui » ; « FPT armé : non, manque CA tout engins, 2 agents ».
export function texteArme(arme: boolean, manque: Poste[]): string {
	if (arme) return 'FPT armé : oui';
	const parties = [...new Set(manque)].map((x) => {
		const n = manque.filter((y) => y === x).length;
		return n > 1 ? pluriel(n, LIBELLES_POSTE[x], `${LIBELLES_POSTE[x]}s`) : LIBELLES_POSTE[x];
	});
	return `FPT armé : non, manque ${parties.join(', ')}`;
}
