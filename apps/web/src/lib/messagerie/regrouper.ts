import type { VueMessage } from '@gyro-caserne/socle';

export type Bandeau = { premier: number; nombre: number };

// Ce que le fil affiche, dans l'ordre. `cle` : stable d'un rafraîchissement à l'autre.
export type ElementDuFil =
	| { type: 'jour'; cle: string; libelle: string }
	| { type: 'non-lus'; cle: string; nombre: number }
	| { type: 'systeme'; cle: string; message: VueMessage }
	| { type: 'bloc'; cle: string; moi: boolean; auteur: VueMessage['auteur']; messages: VueMessage[] };

const CINQ_MINUTES = 5 * 60_000;

// Les dates sont à l'heure de Paris : on les lit telles quelles.
const instant = (iso: string) => Date.parse(`${iso.slice(0, 19).padEnd(19, ':00')}Z`);
const jour = (iso: string) => iso.slice(0, 10);

// « Aujourd’hui », « Hier », sinon « Lundi 26 octobre » (avec l'année si ce n'est pas celle d'aujourd'hui).
export function jourDuFil(creeLe: string, aujourdhui: string): string {
	const ecart = Math.round((Date.parse(`${aujourdhui}T00:00:00Z`) - Date.parse(`${jour(creeLe)}T00:00:00Z`)) / 864e5);
	if (ecart === 0) return 'Aujourd’hui';
	if (ecart === 1) return 'Hier';
	const options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' };
	if (creeLe.slice(0, 4) !== aujourdhui.slice(0, 4)) options.year = 'numeric';
	const date = new Intl.DateTimeFormat('fr-FR', options).format(new Date(`${jour(creeLe)}T00:00:00Z`));
	return date.charAt(0).toUpperCase() + date.slice(1);
}

const compteNonLu = (m: VueMessage) => !m.moi && m.systeme === null && m.supprime === null;

// Le bandeau « N messages non lus » à l'ouverture : les messages des autres à partir du premier non lu.
export function bandeauNonLus(messages: VueMessage[], premierNonLu: number | null): Bandeau | null {
	if (premierNonLu === null) return null;
	const nombre = messages.filter((m) => m.id >= premierNonLu && compteNonLu(m)).length;
	return nombre > 0 ? { premier: premierNonLu, nombre } : null;
}

// Range les messages (du plus ancien au plus récent) : un séparateur par jour, le bandeau devant le premier non lu,
// les messages système à part, et des blocs par auteur tant que ses messages se suivent à moins de 5 minutes.
export function regrouper(messages: VueMessage[], { aujourdhui, bandeau }: { aujourdhui: string; bandeau: Bandeau | null }): ElementDuFil[] {
	const elements: ElementDuFil[] = [];
	let bloc: Extract<ElementDuFil, { type: 'bloc' }> | null = null;
	let jourCourant = '';
	let bandeauPlace = false;
	for (const m of messages) {
		if (jour(m.cree_le) !== jourCourant) {
			jourCourant = jour(m.cree_le);
			elements.push({ type: 'jour', cle: `jour-${jourCourant}`, libelle: jourDuFil(m.cree_le, aujourdhui) });
			bloc = null;
		}
		if (bandeau && !bandeauPlace && m.id >= bandeau.premier) {
			elements.push({ type: 'non-lus', cle: 'non-lus', nombre: bandeau.nombre });
			bandeauPlace = true;
			bloc = null;
		}
		if (m.systeme !== null) {
			elements.push({ type: 'systeme', cle: `message-${m.id}`, message: m });
			bloc = null;
			continue;
		}
		const precedent = bloc?.messages.at(-1);
		if (bloc && precedent && bloc.auteur?.id === m.auteur?.id && instant(m.cree_le) - instant(precedent.cree_le) < CINQ_MINUTES) {
			bloc.messages.push(m);
			continue;
		}
		bloc = { type: 'bloc', cle: `bloc-${m.id}`, moi: m.moi, auteur: m.auteur, messages: [m] };
		elements.push(bloc);
	}
	return elements;
}

// Les messages reçus au rafraîchissement (ou une page plus ancienne) : chacun remplace celui de même identifiant ou s'ajoute,
// dans l'ordre des identifiants.
export function fusionner(messages: VueMessage[], recus: VueMessage[]): VueMessage[] {
	const parId = new Map(messages.map((m) => [m.id, m]));
	for (const m of recus) parId.set(m.id, m);
	return [...parId.values()].sort((a, b) => a.id - b.id);
}
