const format = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' });

// Date du jour à Paris, au format AAAA-MM-JJ.
export function aujourdhuiParis(date = new Date()): string {
	return format.format(date);
}
