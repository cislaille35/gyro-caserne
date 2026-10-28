const format = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' });
const heure = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });

// Date du jour à Paris, au format AAAA-MM-JJ.
export function aujourdhuiParis(date = new Date()): string {
	return format.format(date);
}

// Date et heure de Paris, au format AAAA-MM-JJTHH:MM:SS.
export function maintenantParis(date = new Date()): string {
	return `${aujourdhuiParis(date)}T${heure.format(date)}`;
}
