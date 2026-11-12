import type { ApercuPlanning } from '@gyro-caserne/socle';
import { pluriel } from '#lib/pluriel.ts';

const FETES = { noel: 'Noël', nouvel_an: 'le Nouvel An' } as const;

// « 3 semaines changées, 2 manœuvres ajoutées, 1 modifiée, 1 retirée, Noël passe à l'Équipe 2 » ; sans les parties vides.
export function resumer(a: ApercuPlanning): string {
	const m = a.manoeuvres;
	const manoeuvres = [
		[m.ajoutees.length, 'ajoutée', 'ajoutées'],
		[m.modifiees.length, 'modifiée', 'modifiées'],
		[m.retirees.length, 'retirée', 'retirées']
	]
		.filter(([n]) => (n as number) > 0)
		.map(([n, s, p], i) => (i === 0 ? `${pluriel(n as number, 'manœuvre', 'manœuvres')} ${(n as number) > 1 ? p : s}` : `${n} ${(n as number) > 1 ? p : s}`));
	const vacances = a.vacances.ajoutees.length + a.vacances.retirees.length;
	const parties = [
		...(a.semaines.length ? [`${pluriel(a.semaines.length, 'semaine changée', 'semaines changées')}`] : []),
		...manoeuvres,
		...(vacances ? [pluriel(vacances, 'changement de vacances scolaires', 'changements de vacances scolaires')] : []),
		...(a.ete.ajouts + a.ete.retraits ? [`été : ${pluriel(a.ete.ajouts + a.ete.retraits, 'présence changée', 'présences changées')}`] : []),
		...a.fetes.map((f) => `${f.fete === 'noel' ? 'Noël' : 'Le Nouvel An'} passe à ${f.apres === null ? 'personne' : `l’${f.apres}`}`)
	];
	return parties.length ? parties.join(', ') : 'Aucun changement';
}

// L'alerte du tour des fêtes.
export const alertesFetes = (a: ApercuPlanning) => a.fetes.filter((f) => f.horsTour).map((f) => `${f.apres} tiendrait ${FETES[f.fete]} hors de son tour.`);

// Après l'import : une année en brouillon reste invisible des agents jusqu'à sa publication.
export const apresImport = (publiee: boolean) =>
	publiee
		? 'Année publiée : les agents voient déjà les changements ; les convoqués des manœuvres annoncées sont prévenus.'
		: 'Année en brouillon : les agents ne voient rien avant la publication, à l’étape « Vérifier et publier ».';
