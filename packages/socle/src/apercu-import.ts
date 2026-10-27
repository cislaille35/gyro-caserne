import { and, eq, gt, inArray, isNull } from 'drizzle-orm';
import { regleDAttribution } from './actions/attributions.ts';
import { LIMITES, type ajouterPersonne, type ChampsFiche } from './actions/personnes.ts';
import type { Base } from './base.ts';
import { normaliserAdresse } from './connexion.ts';
import { enCours, exigerDate } from './dates.ts';
import type { Acteur, Perimetre } from './droits.ts';
import { estGestionnaire } from './effectif.ts';
import { RefusDroit } from './erreurs.ts';
import { dateFichier, dateIso, ENTETES, LIBELLES_STATUT, type Repere } from './fichier-effectif.ts';
import { STATUTS_OPERATIONNELS, type StatutOperationnel } from './listes.ts';
import { affectationEquipe, attribution, comite, equipe, grade, journal, personne, profil, responsabilite } from './schema.ts';

export type FichierLu = { entetes: string[]; lignes: { numero: number; cellules: string[] }[]; repere: Repere | null };

// `ligne` : l'agent créé par l'opération `ajouter` de cette ligne.
export type RefPersonne = { id: number } | { ligne: number };

export type Operation = { ligne: number } & (
	| { type: 'ajouter'; donnees: Parameters<typeof ajouterPersonne>[2] }
	| { type: 'modifier'; personneId: number; champs: Partial<ChampsFiche> }
	| { type: 'equipe'; personneId: number; equipeId: number | null }
	| { type: 'statut'; personneId: number; statut: StatutOperationnel }
	| { type: 'attribuer'; personne: RefPersonne; responsabiliteId: number; perimetre: Perimetre }
	| { type: 'terminer'; attributionId: number }
);

export type Apercu = {
	departs: { personneId: number; nom: string }[];
	arrivees: { ligne: number; nom: string }[];
	modifications: { ligne: number; nom: string; changements: { colonne: string; avant: string; apres: string }[] }[];
	erreurs: { ligne: number; colonne: string | null; message: string }[];
	perimees: { ligne: number; nom: string }[];
	colonnesIgnorees: string[];
	operations: Operation[];
};

type Responsabilite = typeof responsabilite.$inferSelect;
type Changement = Apercu['modifications'][number]['changements'][number];

const PROTEGES = ['chef_centre', 'chef_centre_adjoint'];
const DATES = [
	['Date de grade', 'dateGrade'],
	['Naissance', 'naissance'],
	['Entrée au centre', 'entreeCentre'],
	['Engagement SPV', 'engagementSpv']
] as const;

const minuscules = (texte: string) => texte.toLocaleLowerCase('fr');
const nomComplet = (p: { prenom: string; nom: string }) => `${p.prenom} ${p.nom}`;
const nExistePas = (valeur: string) => `« ${valeur} » n’existe pas`;

// Lignes du fichier qui portent la même valeur (e-mail ou N°) : numéros des autres lignes.
function doublons(lignes: { numero: number; cle: string }[]): Map<number, number[]> {
	const parCle = new Map<string, number[]>();
	for (const { numero, cle } of lignes) if (cle) parCle.set(cle, [...(parCle.get(cle) ?? []), numero]);
	const autres = new Map<number, number[]>();
	for (const numeros of parCle.values()) if (numeros.length > 1) for (const n of numeros) autres.set(n, numeros.filter((m) => m !== n));
	return autres;
}

export async function apercuImport(base: Base, acteur: Acteur, fichier: FichierLu, aujourdhui: string, adressesReservees: string[]): Promise<Apercu> {
	exigerDate(aujourdhui);
	if (!(await estGestionnaire(base, acteur, aujourdhui))) throw new RefusDroit('GERER_ACCES', { type: 'centre' });
	const apercu: Apercu = { departs: [], arrivees: [], modifications: [], erreurs: [], perimees: [], colonnesIgnorees: [], operations: [] };

	// En-têtes : chaque colonne de données une seule fois, sinon rien n'est lu.
	const entetes = fichier.entetes.map((e) => e.trim());
	const vus = new Set<string>();
	const enDouble = new Set<string>();
	for (const e of entetes) {
		if (e && vus.has(e)) enDouble.add(e);
		vus.add(e);
	}
	for (const e of enDouble) apercu.erreurs.push({ ligne: 0, colonne: e, message: `Colonne « ${e} » en double` });
	for (const e of ENTETES) if (!vus.has(e)) apercu.erreurs.push({ ligne: 0, colonne: e, message: `Colonne « ${e} » absente` });
	if (apercu.erreurs.length > 0) return apercu;

	const repere = fichier.repere;
	// Toutes les lectures d'un bloc : une seule requête comptée.
	const [grades, equipes, profils, responsabilites, comites, personnes, affectations, attributions, recentes] = await base.batch([
		base.select({ id: grade.id, libelle: grade.libelle }).from(grade),
		base.select({ id: equipe.id, nom: equipe.nom, active: equipe.active }).from(equipe),
		base.select({ id: profil.id, nom: profil.nom }).from(profil),
		base.select().from(responsabilite).where(isNull(responsabilite.archiveeLe)),
		base.select({ id: comite.id, nom: comite.nom }).from(comite).where(isNull(comite.dissousLe)),
		base.select().from(personne),
		base.select().from(affectationEquipe),
		base
			.select({ id: attribution.id, personneId: attribution.personneId, responsabiliteId: attribution.responsabiliteId, type: attribution.perimetreType, perimetreId: attribution.perimetreId, debut: attribution.debut, fin: attribution.fin, systeme: responsabilite.systeme })
			.from(attribution)
			.innerJoin(responsabilite, eq(responsabilite.id, attribution.responsabiliteId)),
		// Sans repère, rien n'est récent.
		base
			.select({ cibleType: journal.cibleType, cibleId: journal.cibleId, details: journal.details })
			.from(journal)
			.where(and(gt(journal.id, repere?.journal ?? Number.MAX_SAFE_INTEGER), inArray(journal.cibleType, ['personne', 'attribution'])))
	]);
	const peutAttribuer = await regleDAttribution(base, acteur, aujourdhui);

	const parId = new Map(personnes.map((p) => [p.id, p]));
	const parEmail = new Map(personnes.map((p) => [p.email, p.id]));
	const nomGrade = new Map(grades.map((g) => [g.id, g.libelle]));
	const nomProfil = new Map(profils.map((p) => [p.id, p.nom]));
	const equipeParId = new Map(equipes.map((e) => [e.id, e]));
	const actives = equipes.filter((e) => e.active === 1);
	const equipeCourante = new Map(affectations.filter((a) => enCours(a.debut, a.fin, aujourdhui)).map((a) => [a.personneId, a.equipeId]));
	const enCoursDe = new Map<number, typeof attributions>();
	for (const a of attributions) if (enCours(a.debut, a.fin, aujourdhui)) enCoursDe.set(a.personneId, [...(enCoursDe.get(a.personneId) ?? []), a]);
	const proteges = new Set(attributions.filter((a) => PROTEGES.includes(a.systeme ?? '') && enCours(a.debut, a.fin, aujourdhui)).map((a) => a.personneId));

	// Modifié depuis l'export : la personne elle-même ou l'une de ses attributions (même supprimée depuis).
	const titulaire = new Map(attributions.map((a) => [a.id, a.personneId]));
	const perimes = new Set<number>();
	for (const j of recentes) {
		if (j.cibleId === null) continue;
		const id = j.cibleType === 'personne' ? j.cibleId : (titulaire.get(j.cibleId) ?? (JSON.parse(j.details) as { personneId?: number }).personneId);
		if (id !== undefined) perimes.add(id);
	}

	// Colonnes de rôles et de comités ; les autres sont ignorées.
	const index = new Map(entetes.map((e, i) => [e, i]));
	const rolesComite = responsabilites.filter((r) => r.typePerimetre === 'comite');
	const colonnesRoles: { entete: string; role: Responsabilite }[] = [];
	const colonnesComites: { entete: string; comiteId: number }[] = [];
	for (const e of entetes) {
		if (!e || (ENTETES as readonly string[]).includes(e)) continue;
		const role = responsabilites.find((r) => r.nom === e && (r.typePerimetre === 'centre' || r.typePerimetre === 'equipe') && !PROTEGES.includes(r.systeme ?? ''));
		const leComite = e.startsWith('Comité : ') ? comites.find((c) => `Comité : ${c.nom}` === e) : undefined;
		if (role) colonnesRoles.push({ entete: e, role });
		else if (leComite) colonnesComites.push({ entete: e, comiteId: leComite.id });
		else apercu.colonnesIgnorees.push(e);
	}

	const lignes = fichier.lignes.filter((l) => l.cellules.some((c) => c.trim() !== ''));
	const lire = (l: FichierLu['lignes'][number], entete: string) => (l.cellules[index.get(entete)!] ?? '').trim();
	const memeEmail = doublons(lignes.map((l) => ({ numero: l.numero, cle: normaliserAdresse(lire(l, 'E-mail')) })));
	const memeNumero = doublons(lignes.map((l) => ({ numero: l.numero, cle: lire(l, 'N°') })));
	const reservees = adressesReservees.map(normaliserAdresse);
	const presents = new Set<number>();
	const departs: Operation[] = [];

	for (const l of lignes) {
		const ligne = l.numero;
		const v = (entete: string) => lire(l, entete);
		const erreurs: Apercu['erreurs'] = [];
		const erreur = (colonne: string, message: string) => erreurs.push({ ligne, colonne, message });

		// N° : l'agent à modifier, ou rien pour une arrivée.
		const numero = v('N°');
		const fiche = /^\d+$/.test(numero) ? parId.get(Number(numero)) : undefined;
		if (fiche) presents.add(fiche.id);
		if (numero) {
			if (!repere) erreur('N°', 'Partez d’un export pour modifier un agent');
			else if (!fiche) erreur('N°', `Aucun agent n° ${numero}`);
			else if (proteges.has(fiche.id)) erreur('N°', 'Le chef de centre et l’adjoint se modifient à l’écran');
			else if (memeNumero.has(ligne)) erreur('N°', `Même N° qu’à la ligne ${memeNumero.get(ligne)!.join(', ')}`);
		}
		const prenom = v('Prénom');
		const nom = v('Nom');
		if (fiche && repere && perimes.has(fiche.id) && erreurs.length === 0) {
			apercu.perimees.push({ ligne, nom: `${prenom} ${nom}` });
			continue;
		}

		const email = normaliserAdresse(v('E-mail'));
		if (!email) erreur('E-mail', 'Indiquez l’e-mail');
		else if (reservees.includes(email)) erreur('E-mail', 'Adresse réservée au super administrateur');
		else if (email.length > LIMITES.email[1]) erreur('E-mail', LIMITES.email[0]);
		else if (parEmail.has(email) && parEmail.get(email) !== fiche?.id) erreur('E-mail', `Adresse déjà utilisée par l’agent n° ${parEmail.get(email)}`);
		else if (memeEmail.has(ligne)) erreur('E-mail', `Même e-mail qu’à la ligne ${memeEmail.get(ligne)!.join(', ')}`);
		for (const [colonne, valeur, limite] of [
			['Prénom', prenom, LIMITES.prenom],
			['Nom', nom, LIMITES.nom]
		] as const) {
			if (!valeur) erreur(colonne, `Indiquez le ${minuscules(colonne)}`);
			else if (valeur.length > limite[1]) erreur(colonne, limite[0]);
		}

		const libelleGrade = v('Grade');
		const leGrade = libelleGrade ? grades.find((g) => minuscules(g.libelle) === minuscules(libelleGrade)) : undefined;
		if (libelleGrade && !leGrade) erreur('Grade', nExistePas(libelleGrade));
		const dates = {} as Record<(typeof DATES)[number][1], string | null>;
		for (const [colonne, cle] of DATES) {
			const texte = v(colonne);
			dates[cle] = texte ? dateIso(texte) : null;
			if (texte && dates[cle] === null) erreur(colonne, 'date invalide');
		}
		const nomEquipe = v('Équipe');
		const lEquipe = nomEquipe ? actives.find((e) => minuscules(e.nom) === minuscules(nomEquipe)) : undefined;
		if (nomEquipe && !lEquipe) erreur('Équipe', nExistePas(nomEquipe));
		const libelleStatut = v('Statut') || LIBELLES_STATUT.operationnel;
		const statut = STATUTS_OPERATIONNELS.find((s) => minuscules(LIBELLES_STATUT[s]) === minuscules(libelleStatut));
		if (!statut) erreur('Statut', nExistePas(libelleStatut));
		const nomDuProfil = v('Profil');
		const leProfil = profils.find((p) => minuscules(p.nom) === minuscules(nomDuProfil));
		if (!nomDuProfil) erreur('Profil', 'Indiquez le profil');
		else if (!leProfil) erreur('Profil', nExistePas(nomDuProfil));
		const telephone = v('Téléphone') || null;
		if (telephone && telephone.length > LIMITES.telephone[1]) erreur('Téléphone', LIMITES.telephone[0]);

		const roles = colonnesRoles.map((c) => ({ ...c, valeur: v(c.entete), oui: minuscules(v(c.entete)) === 'oui' }));
		for (const r of roles) if (r.valeur && !r.oui) erreur(r.entete, 'Indiquez « Oui » ou laissez vide');
		const roleComite = colonnesComites.map((c) => {
			const valeur = v(c.entete);
			const role = valeur ? rolesComite.find((r) => minuscules(r.nom) === minuscules(valeur)) : undefined;
			if (valeur.includes(',')) erreur(c.entete, 'deux rôles dans ce comité : à traiter à l’écran');
			else if (valeur && !role) erreur(c.entete, `« ${valeur} » n’est pas un rôle de comité`);
			return { ...c, valeur, role };
		});

		const ops: Operation[] = [];
		const terminer: Operation[] = [];
		const attribuer: Operation[] = [];
		const changements: Changement[] = [];
		const personneVisee: RefPersonne = fiche ? { id: fiche.id } : { ligne };
		const demander = (colonne: string, role: Responsabilite, perimetre: Perimetre) => {
			if (!peutAttribuer(role, perimetre)) erreur(colonne, 'Vous ne pouvez pas attribuer ce rôle');
			attribuer.push({ ligne, type: 'attribuer', personne: personneVisee, responsabiliteId: role.id, perimetre });
		};
		const finir = (colonne: string, role: Responsabilite, a: (typeof attributions)[number]) => {
			const perimetre: Perimetre = a.type === 'centre' || a.perimetreId === null ? { type: 'centre' } : ({ type: a.type, id: a.perimetreId } as Perimetre);
			if (!peutAttribuer(role, perimetre)) erreur(colonne, 'Vous ne pouvez pas retirer ce rôle');
			terminer.push({ ligne, type: 'terminer', attributionId: a.id });
		};

		// Équipe après import : celle du fichier, ou l'équipe inactive (non exportée) gardée telle quelle.
		const courante = fiche ? equipeCourante.get(fiche.id) : undefined;
		const couranteInactive = courante !== undefined && equipeParId.get(courante)?.active !== 1;
		const equipeFinale = lEquipe?.id ?? (couranteInactive ? courante : null);

		if (!fiche && !numero) {
			if (statut === 'parti') erreur('Statut', 'Un nouvel agent ne peut pas être « Parti »');
			ops.push({
				ligne,
				type: 'ajouter',
				donnees: { email, prenom, nom, profilId: leProfil?.id ?? 0, ...(lEquipe ? { equipeId: lEquipe.id } : {}), statut, gradeId: leGrade?.id ?? null, telephone, ...dates }
			});
		} else if (fiche) {
			const nouveaux: Partial<ChampsFiche> = { email, prenom, nom, gradeId: leGrade?.id ?? null, profilId: leProfil?.id, telephone, ...dates };
			const affichage = (cle: keyof ChampsFiche, valeur: unknown): string => {
				if (valeur === null || valeur === undefined) return '';
				if (cle === 'gradeId') return nomGrade.get(valeur as number) ?? '';
				if (cle === 'profilId') return nomProfil.get(valeur as number) ?? '';
				if (DATES.some(([, c]) => c === cle)) return dateFichier(valeur as string);
				return String(valeur);
			};
			const colonnes: (readonly [string, keyof ChampsFiche])[] = [['E-mail', 'email'], ['Prénom', 'prenom'], ['Nom', 'nom'], ['Grade', 'gradeId'], ['Profil', 'profilId'], ['Téléphone', 'telephone'], ...DATES];
			const champs: Partial<ChampsFiche> = {};
			for (const [colonne, cle] of colonnes) {
				if (nouveaux[cle] === fiche[cle]) continue;
				Object.assign(champs, { [cle]: nouveaux[cle] });
				changements.push({ colonne, avant: affichage(cle, fiche[cle]), apres: affichage(cle, nouveaux[cle]) });
			}
			if (Object.keys(champs).length > 0) ops.push({ ligne, type: 'modifier', personneId: fiche.id, champs });

			// Un départ retire l'équipe et termine les rôles : le fichier n'a rien à y faire.
			if (statut !== 'parti' && equipeFinale !== (courante ?? null)) {
				ops.push({ ligne, type: 'equipe', personneId: fiche.id, equipeId: equipeFinale });
				changements.push({ colonne: 'Équipe', avant: courante === undefined ? '' : equipeParId.get(courante)!.nom, apres: lEquipe?.nom ?? '' });
			}
			if (statut && statut !== fiche.statut) {
				ops.push({ ligne, type: 'statut', personneId: fiche.id, statut });
				changements.push({ colonne: 'Statut', avant: LIBELLES_STATUT[fiche.statut], apres: LIBELLES_STATUT[statut] });
			}
		}

		const siennes = fiche ? (enCoursDe.get(fiche.id) ?? []) : [];
		if (statut !== 'parti') {
			for (const r of roles) {
				const tenues = siennes.filter((a) => a.responsabiliteId === r.role.id);
				if (r.role.typePerimetre === 'equipe' && tenues.some((a) => a.perimetreId !== courante)) {
					erreur(r.entete, 'rôle tenu sur une autre équipe : à traiter à l’écran');
					continue;
				}
				let voulu: Perimetre | null = null;
				if (r.oui && r.role.typePerimetre === 'centre') voulu = { type: 'centre' };
				if (r.oui && r.role.typePerimetre === 'equipe') {
					if (equipeFinale === null) erreur(r.entete, 'Indiquez l’équipe');
					else voulu = { type: 'equipe', id: equipeFinale };
				}
				const garde = (a: (typeof tenues)[number]) => voulu !== null && (voulu.type === 'centre' || a.perimetreId === voulu.id);
				for (const a of tenues) if (!garde(a)) finir(r.entete, r.role, a);
				if (voulu && !tenues.some(garde)) demander(r.entete, r.role, voulu);
				const avant = tenues.length > 0 ? 'Oui' : '';
				if (avant !== (r.oui ? 'Oui' : '')) changements.push({ colonne: r.entete, avant, apres: r.oui ? 'Oui' : '' });
			}
			for (const c of roleComite) {
				const tenues = siennes.filter((a) => a.type === 'comite' && a.perimetreId === c.comiteId && rolesComite.some((r) => r.id === a.responsabiliteId));
				if (tenues.length > 1 && !c.valeur.includes(',')) erreur(c.entete, 'deux rôles dans ce comité : à traiter à l’écran');
				if (tenues.length > 1 || (c.valeur && !c.role)) continue;
				for (const a of tenues) if (a.responsabiliteId !== c.role?.id) finir(c.entete, rolesComite.find((r) => r.id === a.responsabiliteId)!, a);
				if (c.role && !tenues.some((a) => a.responsabiliteId === c.role!.id)) demander(c.entete, c.role, { type: 'comite', id: c.comiteId });
				const avant = tenues.length === 1 ? rolesComite.find((r) => r.id === tenues[0]!.responsabiliteId)!.nom : '';
				if (avant !== (c.role?.nom ?? '')) changements.push({ colonne: c.entete, avant, apres: c.role?.nom ?? '' });
			}
		}

		if (erreurs.length > 0) {
			apercu.erreurs.push(...erreurs.sort((a, b) => index.get(a.colonne!)! - index.get(b.colonne!)!));
			continue;
		}
		const toutes = [...ops, ...terminer, ...attribuer];
		if (toutes.length === 0) continue;
		apercu.operations.push(...toutes);
		if (fiche) apercu.modifications.push({ ligne, nom: `${prenom} ${nom}`, changements: changements.sort((a, b) => index.get(a.colonne)! - index.get(b.colonne)!) });
		else apercu.arrivees.push({ ligne, nom: `${prenom} ${nom}` });
	}

	// Absents du fichier : départ, sauf ceux que l'export ne pouvait pas contenir ou déjà partis.
	if (repere) {
		const absents = personnes
			.filter((p) => p.id <= repere.personne && !presents.has(p.id) && p.statut !== 'parti' && !proteges.has(p.id))
			.sort((a, b) => a.nom.localeCompare(b.nom, 'fr') || a.prenom.localeCompare(b.prenom, 'fr'));
		for (const p of absents) {
			if (perimes.has(p.id)) {
				apercu.perimees.push({ ligne: 0, nom: nomComplet(p) });
				continue;
			}
			apercu.departs.push({ personneId: p.id, nom: nomComplet(p) });
			departs.push({ ligne: 0, type: 'statut', personneId: p.id, statut: 'parti' });
		}
	}
	apercu.operations.push(...departs);
	return apercu;
}
