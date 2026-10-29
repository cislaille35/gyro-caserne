import { and, eq, inArray } from 'drizzle-orm';
import { attribuer, terminerAttribution } from './actions/attributions.ts';
import { affecterEquipe, ajouterPersonne, changerStatut, modifierFiche, retirerEquipe } from './actions/personnes.ts';
import type { Operation, RefPersonne } from './apercu-import.ts';
import type { Base, BasePhotos } from './base.ts';
import { enCours, exigerDateHeure } from './dates.ts';
import type { Acteur, Perimetre } from './droits.ts';
import { estGestionnaire } from './effectif.ts';
import { DonneeInvalide, RefusDroit } from './erreurs.ts';
import { STATUTS_OPERATIONNELS, TYPES_PERIMETRE, type StatutOperationnel } from './listes.ts';
import { attribution, responsabilite } from './schema.ts';

const PROTEGES = ['chef_centre', 'chef_centre_adjoint'] as const;

// L'opération vient du navigateur : sa forme est vérifiée avant toute lecture.
const malFormee = () => new DonneeInvalide('Opération mal formée');
const estObjet = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && [Object.prototype, null].includes(Object.getPrototypeOf(v));
const objet = (v: unknown): Record<string, unknown> => {
	if (!estObjet(v)) throw malFormee();
	return v;
};
const entier = (v: unknown, min: number): number => {
	if (!Number.isSafeInteger(v) || (v as number) < min) throw malFormee();
	return v as number;
};
const identifiant = (v: unknown) => entier(v, 1);

function personneDe(v: unknown): RefPersonne {
	const ref = objet(v);
	const cles = Object.keys(ref);
	if (cles.length === 1 && cles[0] === 'id') return { id: identifiant(ref.id) };
	if (cles.length === 1 && cles[0] === 'ligne') return { ligne: entier(ref.ligne, 0) };
	throw malFormee();
}

function perimetreDe(v: unknown): Perimetre {
	const { type, id } = objet(v);
	if (type === 'centre') return { type };
	if (!TYPES_PERIMETRE.includes(type as never)) throw malFormee();
	return { type: type as Exclude<Perimetre['type'], 'centre'>, id: identifiant(id) };
}

type Donnees = Extract<Operation, { type: 'ajouter' }>['donnees'];
const TEXTES = ['email', 'prenom', 'nom'];
const FACULTATIFS = ['telephone', 'dateGrade', 'naissance', 'entreeCentre', 'engagementSpv'];

function donneesDe(v: unknown): Donnees {
	const d = objet(v);
	for (const [cle, valeur] of Object.entries(d)) {
		if (valeur === undefined) continue;
		const bon = TEXTES.includes(cle)
			? typeof valeur === 'string'
			: FACULTATIFS.includes(cle)
				? valeur === null || typeof valeur === 'string'
				: cle === 'profilId' || cle === 'equipeId' || cle === 'gradeId'
					? (cle === 'gradeId' && valeur === null) || identifiant(valeur) > 0
					: cle === 'statut' && STATUTS_OPERATIONNELS.includes(valeur as never);
		if (!bon) throw malFormee();
	}
	if ([...TEXTES, 'profilId'].some((cle) => d[cle] === undefined)) throw malFormee();
	return d as Donnees;
}

function lire(brute: unknown): Operation {
	const op = objet(brute);
	const ligne = entier(op.ligne, 0);
	switch (op.type) {
		case 'ajouter':
			return { ligne, type: op.type, donnees: donneesDe(op.donnees) };
		case 'modifier':
			return { ligne, type: op.type, personneId: identifiant(op.personneId), champs: objet(op.champs) };
		case 'equipe':
			return { ligne, type: op.type, personneId: identifiant(op.personneId), equipeId: op.equipeId === null ? null : identifiant(op.equipeId) };
		case 'statut':
			if (!STATUTS_OPERATIONNELS.includes(op.statut as never)) throw malFormee();
			return { ligne, type: op.type, personneId: identifiant(op.personneId), statut: op.statut as StatutOperationnel };
		case 'attribuer':
			return { ligne, type: op.type, personne: personneDe(op.personne), responsabiliteId: identifiant(op.responsabiliteId), perimetre: perimetreDe(op.perimetre) };
		case 'terminer':
			return { ligne, type: op.type, attributionId: identifiant(op.attributionId) };
		default:
			throw new DonneeInvalide('Opération inconnue');
	}
}

// Le chef de centre et l'adjoint en fonction ne se touchent pas par le fichier.
async function exigerNonProtege(base: Base, personneId: number, aujourdhui: string) {
	const roles = await base
		.select({ debut: attribution.debut, fin: attribution.fin })
		.from(attribution)
		.innerJoin(responsabilite, eq(responsabilite.id, attribution.responsabiliteId))
		.where(and(eq(attribution.personneId, personneId), inArray(responsabilite.systeme, PROTEGES)));
	if (roles.some((r) => enCours(r.debut, r.fin, aujourdhui))) throw new DonneeInvalide('Le chef de centre et l’adjoint se modifient à l’écran');
}

// Ces deux rôles se nomment et se terminent à l'écran.
function exigerRoleOrdinaire(systeme: string | null | undefined) {
	if (systeme === 'chef_centre' || systeme === 'chef_centre_adjoint') throw new DonneeInvalide('Le chef de centre et l’adjoint se nomment à l’écran');
}

// Applique une opération de l'aperçu ; `nouvelles` : n° de ligne → id de l'agent créé par cette ligne.
export async function appliquerOperation(
	base: Base,
	basePhotos: BasePhotos,
	acteur: Acteur,
	brute: Operation,
	nouvelles: Record<number, number>,
	maintenant: string,
	adressesReservees: string[]
): Promise<{ personneId: number | null }> {
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	const op = lire(brute);
	const creees = objet(nouvelles);
	let vise: number | null = null;
	if (op.type === 'attribuer') {
		if ('id' in op.personne) vise = op.personne.id;
		else if (Object.hasOwn(creees, op.personne.ligne)) vise = identifiant(creees[op.personne.ligne]);
		else throw new DonneeInvalide('Agent de la ligne non créé');
	} else if (op.type !== 'ajouter' && op.type !== 'terminer') vise = op.personneId;

	if (!(await estGestionnaire(base, acteur, aujourdhui))) throw new RefusDroit('GERER_ACCES', { type: 'centre' });
	if (vise !== null) await exigerNonProtege(base, vise, aujourdhui);

	switch (op.type) {
		case 'ajouter':
			return { personneId: await ajouterPersonne(base, acteur, op.donnees, aujourdhui, adressesReservees) };
		case 'modifier':
			await modifierFiche(base, acteur, op.personneId, op.champs, aujourdhui, adressesReservees);
			break;
		case 'equipe':
			if (op.equipeId === null) await retirerEquipe(base, acteur, op.personneId, aujourdhui);
			else await affecterEquipe(base, acteur, op.personneId, op.equipeId, aujourdhui, aujourdhui);
			break;
		case 'statut':
			await changerStatut(base, basePhotos, acteur, op.personneId, op.statut, maintenant);
			break;
		case 'attribuer': {
			const [role] = await base.select({ systeme: responsabilite.systeme }).from(responsabilite).where(eq(responsabilite.id, op.responsabiliteId));
			exigerRoleOrdinaire(role?.systeme);
			await attribuer(base, acteur, { personneId: vise!, responsabiliteId: op.responsabiliteId, perimetre: op.perimetre, debut: aujourdhui }, aujourdhui);
			break;
		}
		case 'terminer': {
			const [ligne] = await base
				.select({ personneId: attribution.personneId, systeme: responsabilite.systeme })
				.from(attribution)
				.innerJoin(responsabilite, eq(responsabilite.id, attribution.responsabiliteId))
				.where(eq(attribution.id, op.attributionId));
			if (ligne) await exigerNonProtege(base, ligne.personneId, aujourdhui);
			exigerRoleOrdinaire(ligne?.systeme);
			await terminerAttribution(base, acteur, op.attributionId, aujourdhui);
			break;
		}
	}
	return { personneId: null };
}
