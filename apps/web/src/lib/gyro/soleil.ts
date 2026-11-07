// Le soleil est-il couché au centre ? Hauteur du soleil d'après la date et la position (formules astronomiques usuelles,
// précises à une ou deux minutes) ; couché sous -0,833° (bord du disque et réfraction, comme les heures publiées).
const rad = Math.PI / 180;

export function soleilCouche(date: Date, position: { latitude: number; longitude: number }): boolean {
	const jours = date.getTime() / 864e5 - 10957.5; // depuis le 1er janvier 2000 à midi (UTC)
	const anomalie = (357.529 + 0.98560028 * jours) * rad;
	const longitude = (280.459 + 0.98564736 * jours + 1.915 * Math.sin(anomalie) + 0.02 * Math.sin(2 * anomalie)) * rad;
	const inclinaison = (23.439 - 0.00000036 * jours) * rad;
	const ascension = Math.atan2(Math.cos(inclinaison) * Math.sin(longitude), Math.cos(longitude));
	const declinaison = Math.asin(Math.sin(inclinaison) * Math.sin(longitude));
	const sideral = (18.697374558 + 24.06570982441908 * jours) * 15 * rad;
	const angle = sideral + position.longitude * rad - ascension;
	const lat = position.latitude * rad;
	const hauteur = Math.asin(Math.sin(lat) * Math.sin(declinaison) + Math.cos(lat) * Math.cos(declinaison) * Math.cos(angle));
	return hauteur < -0.833 * rad;
}
