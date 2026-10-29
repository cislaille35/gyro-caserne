// Comptes de test de la préprod : un par profil, à l'adresse « boîte+rôle » (ex. caserne+chef@exemple.fr).
// Tous les liens de connexion arrivent donc dans une seule boîte. Personnes et publications fictives.
import { eq } from 'drizzle-orm';
import { attribuer } from './actions/attributions.ts';
import { aimer, commenter, prendreConnaissance, repondreEvenement, voter } from './actions/interactions.ts';
import { ajouterPersonne } from './actions/personnes.ts';
import { epingler, publier } from './actions/publications.ts';
import type { Base } from './base.ts';
import { ajouterJours, exigerDateHeure } from './dates.ts';
import type { Acteur } from './droits.ts';
import { DonneeInvalide } from './erreurs.ts';
import { comite, equipe, personne, profil, responsabilite } from './schema.ts';

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

// Ne fait rien si les comptes existent déjà. Le jeu de départ doit être chargé.
export async function chargerComptesDeTest(base: Base, boite: string, maintenant: string): Promise<void> {
	const morceaux = /^([^@+\s]+)@([^@\s]+\.[^@\s]+)$/.exec(boite.trim().toLowerCase());
	if (!morceaux) throw new DonneeInvalide('Boîte invalide : une adresse simple, sans « + »');
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	const adresse = (role: string) => `${morceaux[1]}+${role}@${morceaux[2]}`;

	const [deja] = await base.select({ id: personne.id }).from(personne).where(eq(personne.email, adresse('chef')));
	if (deja) return;

	const installateur: Acteur = { type: 'super', email: boite };
	const profils = await base.select({ id: profil.id, nom: profil.nom }).from(profil);
	const equipes = await base.select({ id: equipe.id, numero: equipe.ordreRotation }).from(equipe);
	const responsabilites = await base.select({ id: responsabilite.id, nom: responsabilite.nom, type: responsabilite.typePerimetre }).from(responsabilite);
	const comites = await base.select({ id: comite.id, nom: comite.nom }).from(comite);
	const idEquipe = (numero: number) => equipes.find((e) => e.numero === numero)!.id;

	const ids: Record<string, number> = {};
	for (const c of COMPTES_DE_TEST) {
		// L'agent fête son anniversaire le jour du chargement : le mur « Vie du centre » le montre.
		const naissance = c.role === 'agent' ? `1995${aujourdhui.slice(4)}` : undefined;
		const profilId = profils.find((p) => p.nom === c.profil)!.id;
		ids[c.role] = await ajouterPersonne(base, installateur, { email: adresse(c.role), prenom: c.prenom, nom: c.nom, profilId, equipeId: c.equipe && idEquipe(c.equipe), naissance }, aujourdhui, []);
		if (!c.responsabilite) continue;
		const r = responsabilites.find((x) => x.nom === c.responsabilite)!;
		const perimetre = r.type === 'centre' ? ({ type: 'centre' } as const) : r.type === 'equipe' ? ({ type: 'equipe', id: idEquipe(c.equipe!) } as const) : ({ type: 'comite', id: comites.find((x) => x.nom === c.comite)!.id } as const);
		await attribuer(base, installateur, { personneId: ids[c.role]!, responsabiliteId: r.id, perimetre, debut: aujourdhui }, aujourdhui);
	}

	const qui = (role: string): Acteur => ({ type: 'personne', id: ids[role]! });
	const amicale = `comite:${comites.find((x) => x.nom === 'Amicale')!.id}`;
	const equipe1 = `equipe:${idEquipe(1)}`;
	const dans = (jours: number, heure: string) => `${ajouterJours(aujourdhui, jours)}T${heure}`;

	const consigne = await publier(base, qui('chef'), 'centre', { type: 'annonce', texte: 'Nouvelle consigne : vérification des ARI à chaque prise de garde. Merci de confirmer la lecture.', priseDeConnaissance: true }, maintenant);
	await epingler(base, qui('chef'), consigne, true, maintenant);
	await prendreConnaissance(base, qui('adjoint'), consigne, maintenant);
	const manoeuvre = await publier(
		base,
		qui('adjoint'),
		'centre',
		{ type: 'evenement', texte: 'Manœuvre mensuelle : désincarcération sur la plateforme.', evenement: { debut: dans(7, '19:00'), lieu: 'Plateforme du centre', convoques: 'tous' }, sondage: { question: 'Petit déjeuner avant ?', reponses: ['Oui', 'Non'] } },
		maintenant
	);
	await repondreEvenement(base, qui('agent'), manoeuvre, 'present', maintenant);
	await voter(base, qui('agent'), manoeuvre, 0, aujourdhui);
	const bravo = await publier(base, qui('chef'), 'centre', { type: 'bravo', texte: 'Bravo à Manon pour la réussite de son module de chef d’agrès !' }, maintenant);
	await aimer(base, qui('membre'), bravo, true, aujourdhui);
	await commenter(base, qui('membre'), bravo, 'Merci à tous pour le soutien !', maintenant);

	const sortie = await publier(base, qui('agent'), 'vie', { type: 'message', texte: 'Qui est partant pour un footing dimanche matin ?', sondage: { question: 'Dimanche 9 h ?', reponses: ['Partant', 'Pas cette fois'] } }, maintenant);
	await voter(base, qui('rapporteur'), sortie, 0, aujourdhui);
	await commenter(base, qui('rapporteur'), sortie, 'Je viens, rendez-vous devant le centre.', maintenant);

	await publier(base, qui('chef-equipe'), equipe1, { type: 'message', texte: 'Semaine d’astreinte : pensez à mettre vos dispos à jour avant vendredi.' }, maintenant);
	await publier(base, qui('rapporteur'), amicale, { type: 'evenement', texte: 'Repas de Sainte-Barbe, conjoints et enfants bienvenus.', evenement: { debut: dans(30, '12:00'), lieu: 'Salle des fêtes', convoques: 'tous' } }, maintenant);
}
