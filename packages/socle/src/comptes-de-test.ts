// Comptes de test de la préprod : un par profil, à l'adresse « boîte+rôle » (ex. caserne+chef@exemple.fr).
// Tous les liens de connexion arrivent donc dans une seule boîte. Personnes et publications fictives.
import { and, eq, isNull } from 'drizzle-orm';
import { attribuer } from './actions/attributions.ts';
import { aimer, commenter, prendreConnaissance, repondreEvenement, voter } from './actions/interactions.ts';
import { ajouterPersonne, nomActeur } from './actions/personnes.ts';
import { epingler, publier, type DonneesPublication } from './actions/publications.ts';
import type { Base } from './base.ts';
import { ajouterJours, exigerDateHeure } from './dates.ts';
import type { Acteur, Perimetre } from './droits.ts';
import { DonneeInvalide } from './erreurs.ts';
import { attribution, comite, equipe, personne, profil, publication, responsabilite } from './schema.ts';

type Compte = { role: string; prenom: string; nom: string; profil: 'Agent' | 'Réserve citoyenne'; equipe?: number; responsabilite?: string; comite?: string };

// `equipe` : numéro dans la rotation ; `comite` : nom du comité, pour un rôle de comité.
export const COMPTES_DE_TEST: Compte[] = [
	{ role: 'chef', prenom: 'Claire', nom: 'Chef', profil: 'Agent', responsabilite: 'Chef de centre' },
	{ role: 'adjoint', prenom: 'Antoine', nom: 'Adjoint', profil: 'Agent', responsabilite: 'Chef de centre adjoint' },
	{ role: 'chef-equipe', prenom: 'Élodie', nom: 'Chef-Équipe', profil: 'Agent', equipe: 1, responsabilite: 'Chef d’équipe' },
	{ role: 'agent', prenom: 'Thomas', nom: 'Agent', profil: 'Agent', equipe: 1 },
	{ role: 'rapporteur', prenom: 'Romain', nom: 'Rapporteur', profil: 'Agent', equipe: 2, responsabilite: 'Rapporteur de comité', comite: 'Amicale' },
	{ role: 'membre', prenom: 'Manon', nom: 'Membre', profil: 'Agent', equipe: 3, responsabilite: 'Membre de comité', comite: 'Amicale' },
	{ role: 'referent', prenom: 'Rémi', nom: 'Référent', profil: 'Agent', equipe: 2, responsabilite: 'Référent technique' },
	{ role: 'exterieur', prenom: 'Estelle', nom: 'Extérieure', profil: 'Réserve citoyenne' }
];

// Nom neutre dans le journal : l'adresse de la boîte n'y est pas inscrite.
const INSTALLATEUR: Acteur = { type: 'super', email: 'comptes-de-test' };

// Relançable : ce qui existe déjà (compte, rôle, publication) est gardé, le reste est complété. Le jeu de départ doit être chargé.
export async function chargerComptesDeTest(base: Base, boite: string, maintenant: string, adressesReservees: string[] = []): Promise<void> {
	const morceaux = /^([^@+\s]+)@([^@\s]+\.[^@\s]+)$/.exec(boite.trim().toLowerCase());
	if (!morceaux) throw new DonneeInvalide('Boîte invalide : une adresse simple, sans « + »');
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	const adresse = (role: string) => `${morceaux[1]}+${role}@${morceaux[2]}`;

	// Tout le nécessaire est vérifié avant la première écriture.
	const profils = await base.select({ id: profil.id, nom: profil.nom }).from(profil);
	const equipes = await base.select({ id: equipe.id, numero: equipe.ordreRotation, active: equipe.active }).from(equipe);
	const responsabilites = await base.select({ id: responsabilite.id, nom: responsabilite.nom, type: responsabilite.typePerimetre, archiveeLe: responsabilite.archiveeLe }).from(responsabilite);
	const comites = await base.select({ id: comite.id, nom: comite.nom, dissousLe: comite.dissousLe }).from(comite);
	const manque = (quoi: string) => new DonneeInvalide(`Comptes de test impossibles : ${quoi}`);
	const idEquipe = (numero: number) => {
		const e = equipes.find((x) => x.numero === numero && x.active === 1);
		if (!e) throw manque(`équipe ${numero} absente ou inactive`);
		return e.id;
	};
	const idComite = (nom: string) => {
		const c = comites.find((x) => x.nom === nom && x.dissousLe === null);
		if (!c) throw manque(`comité « ${nom} » absent ou dissous`);
		return c.id;
	};
	const prevus = COMPTES_DE_TEST.map((c) => {
		const p = profils.find((x) => x.nom === c.profil);
		if (!p) throw manque(`profil « ${c.profil} » absent`);
		if (adressesReservees.map((a) => a.trim().toLowerCase()).includes(adresse(c.role))) throw manque(`${adresse(c.role)} est réservée au super administrateur`);
		let tenue: { id: number; perimetre: Perimetre } | null = null;
		if (c.responsabilite) {
			const r = responsabilites.find((x) => x.nom === c.responsabilite && x.archiveeLe === null);
			if (!r) throw manque(`responsabilité « ${c.responsabilite} » absente ou archivée`);
			const perimetre: Perimetre = r.type === 'centre' ? { type: 'centre' } : r.type === 'equipe' ? { type: 'equipe', id: idEquipe(c.equipe!) } : { type: 'comite', id: idComite(c.comite!) };
			tenue = { id: r.id, perimetre };
		}
		return { ...c, profilId: p.id, equipeId: c.equipe === undefined ? undefined : idEquipe(c.equipe), tenue };
	});
	const amicale = `comite:${idComite('Amicale')}`;
	const equipe1 = `equipe:${idEquipe(1)}`;

	const ids: Record<string, number> = {};
	for (const c of prevus) {
		const [existant] = await base.select({ id: personne.id }).from(personne).where(eq(personne.email, adresse(c.role)));
		// L'agent fête son anniversaire le jour du chargement (année bissextile, pour le 29 février) : « Vie du centre » le montre.
		const naissance = c.role === 'agent' ? `1996${aujourdhui.slice(4)}` : undefined;
		ids[c.role] = existant?.id ?? (await ajouterPersonne(base, INSTALLATEUR, { email: adresse(c.role), prenom: c.prenom, nom: c.nom, profilId: c.profilId, equipeId: c.equipeId, naissance }, aujourdhui, adressesReservees));
		if (!c.tenue) continue;
		const [tenu] = await base
			.select({ id: attribution.id })
			.from(attribution)
			.where(and(eq(attribution.personneId, ids[c.role]!), eq(attribution.responsabiliteId, c.tenue.id), isNull(attribution.fin)));
		if (!tenu) await attribuer(base, INSTALLATEUR, { personneId: ids[c.role]!, responsabiliteId: c.tenue.id, perimetre: c.tenue.perimetre, debut: aujourdhui }, aujourdhui);
	}

	const qui = (role: string): Acteur => ({ type: 'personne', id: ids[role]! });
	const dans = (jours: number, heure: string) => `${ajouterJours(aujourdhui, jours)}T${heure}`;
	// Une publication déjà là (même mur, même auteur, même texte) n'est pas refaite, ni ses réactions : un événement passé n'en accepte plus.
	const publierUneFois = async (role: string, mur: string, donnees: DonneesPublication) => {
		const [deja] = await base
			.select({ id: publication.id })
			.from(publication)
			.where(and(eq(publication.mur, mur), eq(publication.auteur, nomActeur(qui(role))), eq(publication.texte, donnees.texte)));
		return deja ? { id: deja.id, nouvelle: false } : { id: await publier(base, qui(role), mur, donnees, maintenant), nouvelle: true };
	};

	const consigne = await publierUneFois('chef', 'centre', { type: 'annonce', texte: 'Nouvelle consigne : vérification des ARI à chaque prise de garde. Merci de confirmer la lecture.', priseDeConnaissance: true });
	if (consigne.nouvelle) {
		await epingler(base, qui('chef'), consigne.id, true, maintenant);
		await prendreConnaissance(base, qui('adjoint'), consigne.id, maintenant);
	}
	const manoeuvre = await publierUneFois('adjoint', 'centre', {
		type: 'evenement',
		texte: 'Manœuvre mensuelle : désincarcération sur la plateforme.',
		evenement: { debut: dans(7, '19:00'), lieu: 'Plateforme du centre', convoques: 'tous' },
		sondage: { question: 'Petit déjeuner avant ?', reponses: ['Oui', 'Non'], ouverture: maintenant, cloture: dans(7, '19:00') }
	});
	if (manoeuvre.nouvelle) {
		await repondreEvenement(base, qui('agent'), manoeuvre.id, 'present', maintenant);
		await voter(base, qui('agent'), manoeuvre.id, 0, maintenant);
	}
	const bravo = await publierUneFois('chef', 'centre', { type: 'bravo', texte: 'Bravo à Manon pour la réussite de son module de chef d’agrès !' });
	if (bravo.nouvelle) {
		await aimer(base, qui('membre'), bravo.id, true, aujourdhui);
		await commenter(base, qui('membre'), bravo.id, 'Merci à tous pour le soutien !', maintenant);
	}

	const sortie = await publierUneFois('agent', 'vie', { type: 'message', texte: 'Qui est partant pour un footing dimanche matin ?', sondage: { question: 'Dimanche 9 h ?', reponses: ['Partant', 'Pas cette fois'], ouverture: maintenant, cloture: `${ajouterJours(aujourdhui, 7)}${maintenant.slice(10, 16)}` } });
	if (sortie.nouvelle) {
		await voter(base, qui('rapporteur'), sortie.id, 0, maintenant);
		await commenter(base, qui('rapporteur'), sortie.id, 'Je viens, rendez-vous devant le centre.', maintenant);
	}

	await publierUneFois('chef-equipe', equipe1, { type: 'message', texte: 'Semaine d’astreinte : pensez à mettre vos dispos à jour avant vendredi.' });
	await publierUneFois('rapporteur', amicale, { type: 'evenement', texte: 'Repas de Sainte-Barbe, conjoints et enfants bienvenus.', evenement: { debut: dans(30, '12:00'), lieu: 'Salle des fêtes', convoques: 'tous' } });
}
