import { LIBELLES_POSTE, POSTES, type Poste, type Postes } from '@gyro-caserne/socle';
import { pluriel } from '../pluriel.ts';

const jourCourt = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const jourMois = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' });
const date = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`);
const heures = (p: { debut: string; fin: string }) => (Date.parse(`${p.fin}:00Z`) - Date.parse(`${p.debut}:00Z`)) / 3_600_000;

// L'écran de l'été : quatre étapes.
export const ETAPES_ETE = [
	{ id: 'periode', libelle: 'Période' },
	{ id: 'vacances', libelle: 'Vacances' },
	{ id: 'repartition', libelle: 'Répartition' },
	{ id: 'publier', libelle: 'Publier' }
] as const;
export type EtapeEte = (typeof ETAPES_ETE)[number]['id'];

// L'étape demandée, sinon celle où en est l'été.
export function etapeEteDe(url: URL, e: { ete: unknown; proposee: boolean }): EtapeEte {
	const voulue = ETAPES_ETE.find((x) => x.id === url.searchParams.get('etape'));
	if (voulue) return voulue.id;
	return !e.ete ? 'periode' : e.proposee ? 'repartition' : 'vacances';
}

// « Ven. 25 juin · nuit », « Sam. 26 juin · 24 h ».
export function libellePlage(p: { debut: string; fin: string }): string {
	const jour = jourCourt.format(date(p.debut));
	const duree = heures(p);
	const quoi = duree === 24 ? '24 h' : p.debut.slice(11, 16) >= '17:00' && duree <= 14 ? 'nuit' : `${Number(p.debut.slice(11, 13))} h – ${Number(p.fin.slice(11, 13))} h`;
	return `${jour.charAt(0).toUpperCase()}${jour.slice(1)} · ${quoi}`;
}

// « 2 agents », « 2 CE », « CA tout engins » (un seul).
const compte = (n: number, p: Poste) => (n === 1 ? LIBELLES_POSTE[p] : `${n} ${LIBELLES_POSTE[p]}${p === 'agent' || p === 'cod1' ? 's' : ''}`);
const comptes = (manque: Poste[]) => [...new Set(manque)].map((x) => compte(manque.filter((y) => y === x).length, x));

// « FPT armé : oui » ; « FPT armé : non, manque CA tout engins, 2 agents ».
export function texteArme(arme: boolean, manque: Poste[]): string {
	return arme ? 'FPT armé : oui' : `FPT armé : non, manque ${comptes(manque).join(', ')}`;
}

// « Il manque : 1 CE » ; « Il manque : 1 CA tout engins, 2 agents ».
export function texteIlManque(manque: Poste[]): string {
	return `Il manque : ${[...new Set(manque)].map((x) => {
		const n = manque.filter((y) => y === x).length;
		return n === 1 ? `1 ${LIBELLES_POSTE[x]}` : compte(n, x);
	}).join(', ')}`;
}

// « Du ven. 25 juin au jeu. 2 sept. · vacances avant le 15 mai » ; `fin` : la relève qui suit la dernière semaine.
export function phrasePeriode(debut: string, fin: string, dateLimite: string): string {
	const veille = new Date(date(fin).getTime() - 864e5).toISOString();
	return `Du ${jourCourt.format(date(debut))} au ${jourCourt.format(date(veille))} · vacances avant le ${jourMois.format(date(dateLimite)).replace(/^1 /, '1er ')}`;
}

// « Proposé · 10 semaines · FPT armé partout · 4 agents en vacances · 3 sans réponse ».
export function resumeEte(e: { ete: { publiee: boolean } | null; proposee: boolean; semaines: { plages: { arme: boolean }[] }[]; reponses: { reponse: string | null; periodes: unknown[] }[] }): string {
	if (!e.ete) return 'Pas encore ouvert';
	const nonArmees = e.semaines.flatMap((s) => s.plages).filter((p) => !p.arme).length;
	return [
		e.ete.publiee ? 'Publié' : e.proposee ? 'Proposé' : 'Vacances en cours',
		pluriel(e.semaines.length, 'semaine'),
		...(e.proposee ? [nonArmees === 0 ? 'FPT armé partout' : `FPT non armé sur ${pluriel(nonArmees, 'plage')}`] : []),
		pluriel(e.reponses.filter((r) => r.reponse === 'vacances' && r.periodes.length > 0).length, 'agent en vacances', 'agents en vacances'),
		`${e.reponses.filter((r) => r.reponse === null).length} sans réponse`
	].join(' · ');
}

// « 3 postes : CA 1 agrès, CE, agent » : les postes à zéro ne sont pas dits.
export function texteEngin(postes: Postes): string {
	const total = POSTES.reduce((n, p) => n + postes[p], 0);
	return `${pluriel(total, 'poste')} : ${POSTES.filter((p) => postes[p] > 0).map((p) => compte(postes[p], p)).join(', ')}`;
}
