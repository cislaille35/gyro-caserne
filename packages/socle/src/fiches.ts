import { and, asc, eq, inArray, max, sql } from 'drizzle-orm';
import type { Base } from './base.ts';
import { exigerDateHeure } from './dates.ts';
import { droitsDe, occupe, type Acteur } from './droits.ts';
import { DonneeInvalide, RefusDroit } from './erreurs.ts';
import { ligneJournal } from './journal.ts';
import { nomActeur } from './actions/personnes.ts';
import { ficheElement, ficheVersion, ficheZone, personne, typeEngin } from './schema.ts';

// Les fiches de prise de garde : une par type d'engin, rangée par zone. `ref` suit une zone ou un élément d'une version à l'autre.

export type ElementFiche = { ref: number; libelle: string; quantite: number | null };
export type ZoneFiche = { ref: number; nom: string; elements: ElementFiche[] };
// `marque` change à chaque réécriture de la version (les lignes reçoivent de nouveaux identifiants) : elle repère une écriture concurrente.
export type VersionFiche = { id: number; numero: number; auteur: string; creeLe: string; utilisee: boolean; marque: string };
export type Fiche = { typeId: number; type: string; version: VersionFiche; zones: ZoneFiche[] };

export const LIMITES_FICHE = { nomType: 20, nomZone: 40, libelle: 120, quantite: 999, zones: 30, elements: 300 } as const;

// Gérer les engins et leurs fiches : GERER_FICHES sur le centre, ou être chef de garde (il tient ce droit sur son équipe).
// Un droit donné sur un comité ou une seule équipe ne suffit pas : il ne doit pas ouvrir toute la flotte.
export async function gereLesEngins(base: Base, acteur: Acteur, aujourdhui: string): Promise<boolean> {
	const droits = (await droitsDe(base, acteur, aujourdhui)).filter((d) => d.droit === 'GERER_FICHES');
	if (droits.some((d) => d.perimetre.type === 'centre')) return true;
	return acteur.type === 'personne' && droits.some((d) => d.perimetre.type === 'equipe') && occupe(base, acteur.id, 'chef_equipe', aujourdhui);
}

export async function exigerGestionEngins(base: Base, acteur: Acteur, maintenant: string): Promise<string> {
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	if (!(await gereLesEngins(base, acteur, aujourdhui))) throw new RefusDroit('GERER_FICHES', { type: 'centre' });
	return aujourdhui;
}

// « personne:12 » → « Prénom Nom » ; un super administrateur → « Administrateur » ; « Fiche de départ » tel quel.
async function nomsAuteurs(base: Base, auteurs: string[]): Promise<Map<string, string>> {
	const ids = [...new Set(auteurs.filter((a) => /^personne:\d+$/.test(a)).map((a) => Number(a.slice(9))))];
	const personnes = ids.length ? await base.select({ id: personne.id, prenom: personne.prenom, nom: personne.nom }).from(personne).where(inArray(personne.id, ids)) : [];
	const nom = (a: string) => {
		if (a.startsWith('super:')) return 'Administrateur';
		if (!a.startsWith('personne:')) return a;
		const p = personnes.find((x) => `personne:${x.id}` === a);
		return p ? `${p.prenom} ${p.nom}` : 'Un ancien agent';
	};
	return new Map(auteurs.map((a) => [a, nom(a)]));
}

// Toutes les fiches (dernière version de chaque type), dans l'ordre des types. Une seule requête comptée.
export async function lireFiches(base: Base): Promise<Fiche[]> {
	const [types, versions, zones, elements] = await base.batch([
		base.select().from(typeEngin).orderBy(asc(typeEngin.ordre), asc(typeEngin.id)),
		// Les seules dernières versions, leurs zones et leurs éléments.
		base.select().from(ficheVersion).where(sql`${ficheVersion.id} IN (SELECT max(${ficheVersion.id}) FROM ${ficheVersion} GROUP BY ${ficheVersion.typeId})`),
		base
			.select({ versionId: ficheZone.versionId, ref: ficheZone.ref, nom: ficheZone.nom, id: ficheZone.id })
			.from(ficheZone)
			.where(sql`${ficheZone.versionId} IN (SELECT max(${ficheVersion.id}) FROM ${ficheVersion} GROUP BY ${ficheVersion.typeId})`)
			.orderBy(asc(ficheZone.ordre)),
		base
			.select({ id: ficheElement.id, zoneId: ficheElement.zoneId, ref: ficheElement.ref, libelle: ficheElement.libelle, quantite: ficheElement.quantite })
			.from(ficheElement)
			.where(sql`${ficheElement.versionId} IN (SELECT max(${ficheVersion.id}) FROM ${ficheVersion} GROUP BY ${ficheVersion.typeId})`)
			.orderBy(asc(ficheElement.ordre))
	]);
	const noms = await nomsAuteurs(base, versions.map((v) => v.auteur));
	return types.flatMap((t) => {
		const v = versions.find((x) => x.typeId === t.id);
		if (!v) return [];
		const siennes = zones.filter((z) => z.versionId === v.id);
		const ids = new Set(siennes.map((z) => z.id));
		const marque = `${Math.max(0, ...siennes.map((z) => z.id))}-${Math.max(0, ...elements.filter((e) => ids.has(e.zoneId)).map((e) => e.id))}`;
		return [
			{
				typeId: t.id,
				type: t.nom,
				version: { id: v.id, numero: v.numero, auteur: noms.get(v.auteur) ?? v.auteur, creeLe: v.creeLe, utilisee: v.utilisee === 1, marque },
				zones: siennes.map((z) => ({ ref: z.ref, nom: z.nom, elements: elements.filter((e) => e.zoneId === z.id).map(({ ref, libelle, quantite }) => ({ ref, libelle, quantite })) }))
			}
		];
	});
}

export async function lireFiche(base: Base, typeId: number): Promise<Fiche> {
	const fiche = (await lireFiches(base)).find((f) => f.typeId === typeId);
	if (!fiche) throw new DonneeInvalide('Type inconnu');
	return fiche;
}

export type Geste =
	| { quoi: 'ajouter_zone'; nom: string }
	| { quoi: 'renommer_zone'; zone: number; nom: string }
	| { quoi: 'deplacer_zone'; zone: number; sens: -1 | 1 }
	| { quoi: 'retirer_zone'; zone: number }
	| { quoi: 'ajouter_element'; zone: number; libelle: string; quantite: number | null }
	| { quoi: 'modifier_element'; element: number; zone: number; libelle: string; quantite: number | null }
	| { quoi: 'deplacer_element'; element: number; sens: -1 | 1 }
	| { quoi: 'retirer_element'; element: number };

const memeNom = (a: string, b: string) => a.trim().toLocaleLowerCase('fr') === b.trim().toLocaleLowerCase('fr');

function nomZone(nom: string): string {
	const propre = nom.trim().replace(/\s+/g, ' ');
	if (!propre) throw new DonneeInvalide('Nom de zone vide');
	if (propre.length > LIMITES_FICHE.nomZone) throw new DonneeInvalide('Nom de zone trop long');
	return propre;
}

function element(libelle: string, quantite: number | null): Omit<ElementFiche, 'ref'> {
	const propre = libelle.trim().replace(/\s+/g, ' ');
	if (!propre) throw new DonneeInvalide('Élément vide');
	if (propre.length > LIMITES_FICHE.libelle) throw new DonneeInvalide('Élément trop long');
	if (quantite !== null && !(Number.isInteger(quantite) && quantite >= 1 && quantite <= LIMITES_FICHE.quantite)) throw new DonneeInvalide('Quantité invalide');
	return { libelle: propre, quantite };
}

function deplacer<T>(liste: T[], i: number, sens: -1 | 1): T[] {
	const j = i + sens;
	if (j < 0 || j >= liste.length) return liste;
	const copie = [...liste];
	[copie[i], copie[j]] = [copie[j]!, copie[i]!];
	return copie;
}

// Vérifie une fiche entière : noms de zone distincts, au plus 30 zones et 300 éléments.
export function verifierZones(zones: ZoneFiche[]): void {
	if (zones.length > LIMITES_FICHE.zones) throw new DonneeInvalide('Trop de zones');
	if (zones.reduce((n, z) => n + z.elements.length, 0) > LIMITES_FICHE.elements) throw new DonneeInvalide('Trop d’éléments');
	zones.forEach((z, i) => {
		if (zones.some((y, j) => j < i && memeNom(y.nom, z.nom))) throw new DonneeInvalide('Zone déjà présente');
	});
}

// Applique un geste de l'éditeur, sans rien écrire. `refs` : les prochaines références libres.
export function appliquerGeste(zones: ZoneFiche[], geste: Geste, refs: { zone: number; element: number }): ZoneFiche[] {
	const iZone = (ref: number) => {
		const i = zones.findIndex((z) => z.ref === ref);
		if (i < 0) throw new DonneeInvalide('Zone inconnue');
		return i;
	};
	const ouElement = (ref: number) => {
		for (const [i, z] of zones.entries()) {
			const j = z.elements.findIndex((e) => e.ref === ref);
			if (j >= 0) return { i, j };
		}
		throw new DonneeInvalide('Élément inconnu');
	};
	const avecZone = (i: number, z: ZoneFiche) => zones.map((x, k) => (k === i ? z : x));
	let resultat: ZoneFiche[];
	switch (geste.quoi) {
		case 'ajouter_zone':
			resultat = [...zones, { ref: refs.zone, nom: nomZone(geste.nom), elements: [] }];
			break;
		case 'renommer_zone': {
			const i = iZone(geste.zone);
			resultat = avecZone(i, { ...zones[i]!, nom: nomZone(geste.nom) });
			break;
		}
		case 'deplacer_zone':
			resultat = deplacer(zones, iZone(geste.zone), geste.sens);
			break;
		case 'retirer_zone': {
			const i = iZone(geste.zone);
			resultat = zones.filter((_, k) => k !== i);
			break;
		}
		case 'ajouter_element': {
			const i = iZone(geste.zone);
			resultat = avecZone(i, { ...zones[i]!, elements: [...zones[i]!.elements, { ref: refs.element, ...element(geste.libelle, geste.quantite) }] });
			break;
		}
		case 'modifier_element': {
			const { i, j } = ouElement(geste.element);
			const nouveau = { ref: geste.element, ...element(geste.libelle, geste.quantite) };
			const cible = iZone(geste.zone);
			if (cible === i) resultat = avecZone(i, { ...zones[i]!, elements: zones[i]!.elements.map((e, k) => (k === j ? nouveau : e)) });
			// Changé de zone : il passe à la fin de sa nouvelle zone.
			else resultat = zones.map((z, k) => (k === i ? { ...z, elements: z.elements.filter((_, l) => l !== j) } : k === cible ? { ...z, elements: [...z.elements, nouveau] } : z));
			break;
		}
		case 'deplacer_element': {
			const { i, j } = ouElement(geste.element);
			resultat = avecZone(i, { ...zones[i]!, elements: deplacer(zones[i]!.elements, j, geste.sens) });
			break;
		}
		case 'retirer_element': {
			const { i, j } = ouElement(geste.element);
			resultat = avecZone(i, { ...zones[i]!, elements: zones[i]!.elements.filter((_, k) => k !== j) });
			break;
		}
		default:
			throw new DonneeInvalide('Geste inconnu');
	}
	verifierZones(resultat);
	return resultat;
}

// Les prochaines références libres, toutes fiches confondues.
export async function refsLibres(base: Base): Promise<{ zone: number; element: number }> {
	const [[z], [e]] = await base.batch([base.select({ n: max(ficheZone.ref) }).from(ficheZone), base.select({ n: max(ficheElement.ref) }).from(ficheElement)]);
	return { zone: (z?.n ?? 0) + 1, element: (e?.n ?? 0) + 1 };
}

// Les écritures (sans les exécuter) qui font de `zones` la fiche du type : sur place si la version n'a pas servi, sinon une nouvelle version.
// En tête, une garde : si la version a servi ou a été réécrite depuis la lecture, elle insère un doublon (type, numéro) et tout le batch échoue.
// Zones et éléments en une instruction chacun (lignes passées en JSON) : le nombre d'instructions ne dépend pas de la taille de la fiche.
export function ecrituresFiche(base: Base, fiche: Fiche, zones: ZoneFiche[], auteur: string, maintenant: string) {
	const v = fiche.version;
	const numero = v.utilisee ? v.numero + 1 : v.numero;
	const idVersion = sql`(SELECT ${ficheVersion.id} FROM ${ficheVersion} WHERE ${ficheVersion.typeId} = ${fiche.typeId} AND ${ficheVersion.numero} = ${numero})`;
	const marque = sql`(coalesce((SELECT max(id) FROM ${ficheZone} WHERE version_id = ${v.id}), 0) || '-' || coalesce((SELECT max(id) FROM ${ficheElement} WHERE version_id = ${v.id}), 0))`;
	const garde = base.run(
		sql`INSERT INTO ${ficheVersion} (type_id, numero, auteur, cree_le) SELECT type_id, numero, '', '' FROM ${ficheVersion} WHERE id = ${v.id} AND (utilisee <> ${v.utilisee ? 1 : 0} OR ${marque} <> ${v.marque})`
	);
	const preparation = v.utilisee
		? [base.insert(ficheVersion).values({ typeId: fiche.typeId, numero, auteur, creeLe: maintenant })]
		: [
				base.delete(ficheElement).where(eq(ficheElement.versionId, v.id)),
				base.delete(ficheZone).where(eq(ficheZone.versionId, v.id)),
				base.update(ficheVersion).set({ auteur, creeLe: maintenant }).where(eq(ficheVersion.id, v.id))
			];
	const lignesZones = JSON.stringify(zones.map((z) => ({ ref: z.ref, nom: z.nom })));
	const lignesElements = JSON.stringify(zones.flatMap((z) => z.elements.map((e, j) => ({ zone: z.ref, ref: e.ref, libelle: e.libelle, quantite: e.quantite, ordre: j + 1 }))));
	return [
		garde,
		...preparation,
		base.run(sql`INSERT INTO ${ficheZone} (version_id, ref, nom, ordre) SELECT ${idVersion}, json_extract(value, '$.ref'), json_extract(value, '$.nom'), key + 1 FROM json_each(${lignesZones})`),
		base.run(
			sql`INSERT INTO ${ficheElement} (version_id, zone_id, ref, libelle, quantite, ordre)
				SELECT ${idVersion}, (SELECT z.id FROM ${ficheZone} z WHERE z.version_id = ${idVersion} AND z.ref = json_extract(value, '$.zone')), json_extract(value, '$.ref'), json_extract(value, '$.libelle'), json_extract(value, '$.quantite'), json_extract(value, '$.ordre')
				FROM json_each(${lignesElements})`
		)
	];
}

// La garde de `ecrituresFiche` a sauté : quelqu'un d'autre a écrit la fiche entre-temps.
export async function ecrireOuRefuser(ecrire: () => Promise<unknown>): Promise<void> {
	try {
		await ecrire();
	} catch (erreur) {
		if (/UNIQUE/i.test(String((erreur as { cause?: unknown })?.cause ?? '') + String(erreur))) throw new DonneeInvalide('Fiche changée entre-temps');
		throw erreur;
	}
}

const memes = (a: ZoneFiche[], b: ZoneFiche[]) => JSON.stringify(a) === JSON.stringify(b);

export async function modifierFicheEngin(base: Base, acteur: Acteur, typeId: number, geste: Geste, maintenant: string): Promise<void> {
	await exigerGestionEngins(base, acteur, maintenant);
	const [fiche, refs] = await Promise.all([lireFiche(base, typeId), refsLibres(base)]);
	const zones = appliquerGeste(fiche.zones, geste, refs);
	// Un geste sans effet (monter le premier, renommer à l'identique) n'écrit rien : pas de version de plus.
	if (memes(zones, fiche.zones)) return;
	await ecrireOuRefuser(() =>
		base.batch([
			...(ecrituresFiche(base, fiche, zones, nomActeur(acteur), maintenant) as unknown as [ReturnType<typeof ligneJournal>]),
			ligneJournal(base, { acteur: nomActeur(acteur), action: 'modifier_fiche', cibleType: 'type_engin', cibleId: typeId, details: { geste } }, maintenant)
		])
	);
}

// Un nouveau type d'engin, avec sa fiche vide (version 1).
export async function creerTypeEngin(base: Base, acteur: Acteur, nom: string, maintenant: string): Promise<number> {
	await exigerGestionEngins(base, acteur, maintenant);
	const propre = nom.trim().replace(/\s+/g, ' ').toUpperCase();
	if (!propre) throw new DonneeInvalide('Nom vide');
	if (propre.length > LIMITES_FICHE.nomType) throw new DonneeInvalide('Nom trop long');
	// Le nom sert de nom de feuille dans le fichier des fiches : Excel y refuse ces caractères.
	if (/[:\\/?*[\]]/.test(propre)) throw new DonneeInvalide('Caractère interdit dans le type');
	const types = await base.select({ nom: typeEngin.nom, ordre: typeEngin.ordre }).from(typeEngin);
	if (types.some((t) => memeNom(t.nom, propre))) throw new DonneeInvalide('Type déjà présent');
	const idType = sql<number>`(SELECT ${typeEngin.id} FROM ${typeEngin} WHERE ${typeEngin.nom} = ${propre})`;
	await base.batch([
		base.insert(typeEngin).values({ nom: propre, ordre: Math.max(0, ...types.map((t) => t.ordre)) + 1 }),
		base.insert(ficheVersion).values({ typeId: idType, numero: 1, auteur: nomActeur(acteur), creeLe: maintenant }),
		ligneJournal(base, { acteur: nomActeur(acteur), action: 'creer_type_engin', cibleType: 'type_engin', cibleId: idType, details: { nom: propre } }, maintenant)
	]);
	const [cree] = await base.select({ id: typeEngin.id }).from(typeEngin).where(and(eq(typeEngin.nom, propre)));
	return cree!.id;
}
