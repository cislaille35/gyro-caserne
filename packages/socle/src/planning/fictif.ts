import type { Centre } from '@gyro-caserne/centre';
import { asc, eq, isNull } from 'drizzle-orm';
import type { Base } from '../base.ts';
import { ajouterJours } from '../dates.ts';
import { affectationEquipe, anneePlanning, aptitude, aptitudeAgent, equipe, ete, personne, profil, reponseEte, vacancesAgent } from '../schema.ts';
import { ajouterVacances, enregistrerManoeuvre, ordrePropose, publierAnnee, reglerRoulement } from './annee.ts';
import { rangDuJour, type Reglage } from './calendrier.ts';
import { periodeParDefaut, reglerEte } from './ete.ts';
import { proposerEte } from './repartition.ts';

// Données fictives seulement (développement local, préprod) : l'année en cours et la suivante publiées, d'après la référence du centre,
// quatre manœuvres thématiques des dimanches à venir et les vacances de Noël. Ne fait rien si l'année en cours est déjà préparée.
export async function chargerPlanningFictif(base: Base, centre: Centre, maintenant: string): Promise<void> {
	const annee = Number(maintenant.slice(0, 4));
	const [deja] = await base.select().from(anneePlanning).where(eq(anneePlanning.annee, annee));
	if (deja) return;
	const qui = { type: 'super', email: 'planning-fictif@exemple.fr' } as const;
	const equipes = await base.select({ id: equipe.id, active: equipe.active }).from(equipe).orderBy(asc(equipe.ordreRotation));
	const ids = equipes.filter((e) => e.active === 1).map((e) => e.id);
	for (const a of [annee, annee + 1]) {
		await reglerRoulement(base, qui, a, ordrePropose(a, centre.astreinte, equipes), maintenant);
		await publierAnnee(base, qui, a, maintenant);
	}
	const themes: [string, number[] | 'tous', boolean][] = [
		['Sport + SAP', ids.slice(0, 2), true],
		['Feux de forêt', ids.slice(2, 4), true],
		['Sainte Barbe', 'tous', false],
		['Désincarcération', ids.slice(0, 1), true]
	];
	let dimanche = ajouterJours(maintenant.slice(0, 10), 7 - rangDuJour(maintenant.slice(0, 10)) + 6);
	for (const [theme, convoques, petitDejeuner] of themes) {
		await enregistrerManoeuvre(base, qui, { debut: `${dimanche}T08:30`, theme, lieu: 'Caserne', convoques, petitDejeuner }, maintenant);
		dimanche = ajouterJours(dimanche, 21);
	}
	await ajouterVacances(base, qui, { nom: 'Vacances de Noël', debut: `${annee}-12-19`, fin: `${annee + 1}-01-04` }, maintenant);
}

// L'équipage d'été : par équipe, de quoi armer le FPT seule (CA tout engins, 2 CE, un conducteur, 2 agents).
// `vacances` : [semaine de l'été, premier jour, nombre de jours] ; `tout` : « disponible tout l'été ».
type Equipier = { prenom: string; nom: string; aptitudes: string[]; vacances?: [number, number, number]; tout?: boolean };
const EQUIPAGE: Equipier[][] = [
	[
		{ prenom: 'Hugo', nom: 'Bernard', aptitudes: ['CA2', 'CE'], vacances: [4, 0, 14] },
		{ prenom: 'Léa', nom: 'Moreau', aptitudes: ['CE'], vacances: [0, 0, 14] },
		{ prenom: 'Paul', nom: 'Girard', aptitudes: ['CE'], tout: true },
		{ prenom: 'Inès', nom: 'Roux', aptitudes: ['COD1'] },
		{ prenom: 'Jules', nom: 'Fontaine', aptitudes: ['SAP'] },
		{ prenom: 'Sarah', nom: 'Mercier', aptitudes: ['SAP'], tout: true }
	],
	[
		{ prenom: 'Lucas', nom: 'Blanc', aptitudes: ['CA2'], vacances: [5, 0, 14] },
		{ prenom: 'Emma', nom: 'Garnier', aptitudes: ['CE'], tout: true },
		{ prenom: 'Nathan', nom: 'Faure', aptitudes: ['CE'] },
		{ prenom: 'Jade', nom: 'Chevalier', aptitudes: ['COD1'], vacances: [7, 0, 7] },
		{ prenom: 'Louis', nom: 'Lambert', aptitudes: ['SAP'] },
		{ prenom: 'Zoé', nom: 'Bonnet', aptitudes: ['SAP'], vacances: [2, 2, 10] }
	],
	[
		{ prenom: 'Arthur', nom: 'Rousseau', aptitudes: ['CA2'], vacances: [5, 0, 7] },
		{ prenom: 'Camille', nom: 'Vincent', aptitudes: ['CE'] },
		{ prenom: 'Tom', nom: 'Muller', aptitudes: ['CE'], tout: true },
		{ prenom: 'Lina', nom: 'Lefèvre', aptitudes: ['COD1'] },
		{ prenom: 'Noah', nom: 'André', aptitudes: ['SAP'], vacances: [8, 0, 14] },
		{ prenom: 'Rose', nom: 'Gautier', aptitudes: ['SAP'] }
	],
	[
		{ prenom: 'Gabriel', nom: 'Perrin', aptitudes: ['CA2'], vacances: [5, 3, 7] },
		{ prenom: 'Louise', nom: 'Morel', aptitudes: ['CE'], vacances: [1, 0, 7] },
		{ prenom: 'Adam', nom: 'Fournier', aptitudes: ['CE'], tout: true },
		{ prenom: 'Mila', nom: 'Clément', aptitudes: ['COD1'] },
		{ prenom: 'Raphaël', nom: 'Henry', aptitudes: ['SAP'] },
		{ prenom: 'Anna', nom: 'Robin', aptitudes: ['SAP'], vacances: [3, 0, 7] }
	]
];
const adresse = (e: Equipier) => `${e.prenom}.${e.nom}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() + '@exemple.fr';

// Données fictives seulement (développement local, préprod) : l'été qui vient (celui de l'an prochain à partir de septembre), ouvert
// avec la période par défaut, des vacances et des réponses, et proposé s'il y a un roulement : le FPT est armé presque partout,
// sauf du lundi au jeudi de la 6e semaine, où tous les CA tout engins sont en vacances. Ne fait rien si cet été est déjà ouvert.
export async function chargerEteFictif(base: Base, maintenant: string, reglage: Reglage): Promise<void> {
	const aujourdhui = maintenant.slice(0, 10);
	const annee = Number(aujourdhui.slice(0, 4)) + (aujourdhui.slice(5, 7) >= '09' ? 1 : 0);
	const [deja] = await base.select().from(ete).where(eq(ete.annee, annee));
	if (deja) return;
	const qui = { type: 'super', email: 'ete-fictif@exemple.fr' } as const;
	const [[agent], equipes, aptitudes] = await base.batch([
		base.select({ id: profil.id }).from(profil).where(eq(profil.nom, 'Agent')),
		base.select({ id: equipe.id }).from(equipe).where(eq(equipe.active, 1)).orderBy(asc(equipe.ordreRotation)),
		base.select({ id: aptitude.id, nom: aptitude.nom }).from(aptitude).where(isNull(aptitude.retireeLe))
	]);
	if (!agent) return;
	const periode = periodeParDefaut(annee, reglage);
	const jour = ([semaine, decalage]: [number, number, number]) => ajouterJours(periode.debut, semaine * 7 + decalage);
	const ids = new Map<Equipier, number>();
	for (const [i, membres] of EQUIPAGE.entries()) {
		const equipeId = equipes[i]?.id;
		for (const e of membres) {
			const [nouvelle] = await base.insert(personne).values({ email: adresse(e), prenom: e.prenom, nom: e.nom, profilId: agent.id }).onConflictDoNothing().returning({ id: personne.id });
			const [p] = nouvelle ? [nouvelle] : await base.select({ id: personne.id }).from(personne).where(eq(personne.email, adresse(e)));
			ids.set(e, p!.id);
			if (!nouvelle) continue;
			if (equipeId) await base.insert(affectationEquipe).values({ personneId: p!.id, equipeId, debut: aujourdhui });
			const siennes = aptitudes.filter((a) => e.aptitudes.includes(a.nom)).map((a) => ({ personneId: p!.id, aptitudeId: a.id, obtenueLe: `${annee - 4}-06-01` }));
			if (siennes.length > 0) await base.insert(aptitudeAgent).values(siennes).onConflictDoNothing();
		}
	}
	await reglerEte(base, qui, annee, periode, maintenant, reglage);
	const equipiers = EQUIPAGE.flat();
	// Les autres CA tout engins du centre (agents fictifs, comptes de test) partent en même temps que Gabriel : les plages à revoir.
	const ca2 = aptitudes.find((a) => a.nom === 'CA2');
	const autresCa2 = ca2 ? (await base.select({ id: aptitudeAgent.personneId }).from(aptitudeAgent).where(eq(aptitudeAgent.aptitudeId, ca2.id))).map((x) => x.id).filter((id) => ![...ids.values()].includes(id)) : [];
	const gabriel = equipiers.find((e) => e.prenom === 'Gabriel')!.vacances!;
	// Un été compte 9 ou 10 semaines selon l'année : les vacances s'arrêtent à sa fin.
	const finEte = ajouterJours(periode.fin, 6);
	const periodeDe = (v: [number, number, number]) => ({ debut: jour(v), fin: [ajouterJours(jour(v), v[2] - 1), finEte].sort()[0]! });
	const vacances = [
		...equipiers.flatMap((e) => (e.vacances && jour(e.vacances) <= finEte ? [{ personneId: ids.get(e)!, annee, ...periodeDe(e.vacances) }] : [])),
		...autresCa2.map((personneId) => ({ personneId, annee, ...periodeDe(gabriel) }))
	];
	if (vacances.length > 0) await base.insert(vacancesAgent).values(vacances);
	const reponses = equipiers.filter((e) => e.vacances || e.tout).map((e) => ({ annee, personneId: ids.get(e)!, toutEte: e.tout ? 1 : 0, modifieeLe: maintenant }));
	await base.insert(reponseEte).values(reponses).onConflictDoNothing();
	const [roulement] = await base.select({ ordre: anneePlanning.ordre }).from(anneePlanning).where(eq(anneePlanning.annee, annee));
	if (roulement && roulement.ordre !== '[]') await proposerEte(base, qui, annee, maintenant, reglage);
}
