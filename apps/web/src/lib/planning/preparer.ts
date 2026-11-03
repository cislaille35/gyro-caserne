import type { EquipePlanning, Fete, PropositionAnnee, SemaineCalculee } from '@gyro-caserne/socle';
import { pluriel } from '../pluriel.ts';
import { manquants } from './ete.ts';

// Préparer l'année : cinq étapes, chacune enregistrée seule.
export const ETAPES = [
	{ id: 'roulement', libelle: 'Roulement' },
	{ id: 'fetes', libelle: 'Fêtes' },
	{ id: 'manoeuvres', libelle: 'Manœuvres' },
	{ id: 'reperes', libelle: 'Repères' },
	{ id: 'publier', libelle: 'Vérifier et publier' }
] as const;
export type Etape = (typeof ETAPES)[number]['id'];

export const etapeDe = (url: URL): Etape => ETAPES.find((e) => e.id === url.searchParams.get('etape'))?.id ?? 'roulement';

// L'équipe du rang `i` monte (-1) ou descend (+1) dans le roulement.
export function deplacer(ordre: number[], i: number, sens: -1 | 1): number[] {
	const j = i + sens;
	if (i < 0 || i >= ordre.length || j < 0 || j >= ordre.length) return [...ordre];
	const nouvel = [...ordre];
	[nouvel[i], nouvel[j]] = [nouvel[j]!, nouvel[i]!];
	return nouvel;
}

const MOMENTS: Record<Fete, string> = { noel: '12-25T12:00', nouvel_an: '12-31T23:00' };
const semaineDe = (semaines: SemaineCalculee[], moment: string) => semaines.findIndex((s) => s.periodes.some((p) => p.debut <= moment && moment < p.fin));

// Hors de son tour : la semaine d'une équipe attendue la plus proche de celle de la fête (hors semaine de l'autre fête), à échanger.
export function echangePropose(semaines: SemaineCalculee[], fete: Fete, attendues: number[], annee: number): { fete: SemaineCalculee; autre: SemaineCalculee } | null {
	const i = semaineDe(semaines, `${annee}-${MOMENTS[fete]}`);
	if (i < 0 || attendues.length === 0 || attendues.includes(semaines[i]!.equipeId)) return null;
	const autreFete = semaineDe(semaines, `${annee}-${MOMENTS[fete === 'noel' ? 'nouvel_an' : 'noel']}`);
	let meilleure = -1;
	semaines.forEach((s, j) => {
		if (j === i || j === autreFete || !attendues.includes(s.equipeId)) return;
		if (meilleure < 0 || Math.abs(j - i) < Math.abs(meilleure - i)) meilleure = j;
	});
	return meilleure < 0 ? null : { fete: semaines[i]!, autre: semaines[meilleure]! };
}

// Le récapitulatif avant de publier.
export function recapitulatif(p: { semaines: SemaineCalculee[]; manoeuvres: { annulee: boolean }[]; vacances: unknown[]; fetes: { noel: number | null; nouvelAn: number | null }; equipes: EquipePlanning[] }): string[] {
	const nom = (id: number | null) => (id === null ? 'personne' : (p.equipes.find((e) => e.id === id)?.nom ?? 'équipe archivée'));
	const changees = p.semaines.filter((s) => s.changee).length;
	const manoeuvres = p.manoeuvres.filter((m) => !m.annulee).length;
	return [
		`${pluriel(p.semaines.length, 'semaine')}, ${changees ? pluriel(changees, 'changée') : 'aucune changée'}`,
		manoeuvres ? pluriel(manoeuvres, 'manœuvre') : 'Aucune manœuvre',
		`Noël : ${nom(p.fetes.noel)} · Nouvel An : ${nom(p.fetes.nouvelAn)}`,
		p.vacances.length ? pluriel(p.vacances.length, 'période de vacances', 'périodes de vacances') : 'Aucune vacances scolaires'
	];
}

const nomEquipe = (equipes: EquipePlanning[], id: number | null) => (id === null ? 'personne' : (equipes.find((e) => e.id === id)?.nom ?? 'Équipe archivée'));

// « 52 semaines · Noël : Équipe 2 · Nouvel An : Équipe 4 · 11 manœuvres reprises · Équipe 3 incomplète »
export function resumeProposition(p: Pick<PropositionAnnee, 'semaines' | 'fetes' | 'manoeuvres' | 'vacances' | 'equipes'>, equipes: EquipePlanning[]): string {
	return [
		pluriel(p.semaines, 'semaine'),
		`Noël : ${nomEquipe(equipes, p.fetes.noel.equipeId)}`,
		`Nouvel An : ${nomEquipe(equipes, p.fetes.nouvelAn.equipeId)}`,
		p.manoeuvres.length ? pluriel(p.manoeuvres.length, 'manœuvre reprise', 'manœuvres reprises') : 'Aucune manœuvre reprise',
		...p.equipes.filter((e) => !e.arme).map((e) => `${e.nom} incomplète`),
		...(p.vacances ? [] : ['Aucune période de vacances saisie'])
	].join(' · ');
}

// « Équipe 3 : 6 agents, il manque 1 CE »
export function etatEquipe(e: Pick<PropositionAnnee['equipes'][number], 'nom' | 'effectif' | 'arme' | 'manque'>): string {
	return `${e.nom} : ${pluriel(e.effectif, 'agent')}, ${e.arme ? 'peut armer le FPT seule' : `il manque ${manquants(e.manque).join(', ')}`}`;
}

// Le tour des deux fêtes n'a pas pu être respecté : le dire, avec le compromis gardé. Null sinon.
export function texteCompromis(f: PropositionAnnee['fetes'], equipes: EquipePlanning[]): string | null {
	if (!f.compromis) return null;
	const noms = (ids: number[]) => ids.map((id) => nomEquipe(equipes, id)).join(' ou ');
	const nN = noms(f.noel.attendues);
	const nA = noms(f.nouvelAn.attendues);
	const tenue = (id: number | null) => nomEquipe(equipes, id);
	const debut = 'Impossible de respecter le tour des deux fêtes';
	if (f.memeSemaine) return `${debut} : elles tombent dans la même semaine, et c’est à ${nN} de tenir Noël, à ${nA} de tenir le Nouvel An. Compromis : ${tenue(f.noel.equipeId)} tient les deux.`;
	const qui = nN === nA ? `c’est à ${nN} de tenir Noël et le Nouvel An, et une équipe ne tient pas les deux` : `c’est à ${nN} de tenir Noël, à ${nA} de tenir le Nouvel An`;
	return `${debut} : ${qui}. Compromis : Noël pour ${tenue(f.noel.equipeId)}, Nouvel An pour ${tenue(f.nouvelAn.equipeId)}.`;
}
