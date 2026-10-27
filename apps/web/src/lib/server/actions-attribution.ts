import { fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { attribuer, DonneeInvalide, responsabilite, terminerAttribution, type Acteur, type Perimetre } from '@gyro-caserne/socle';
import { echecAttribution } from './erreurs-attribution.ts';
import { dateValide, type Reponse } from './formulaire-agent.ts';

type Contexte = { base: App.Locals['base']; acteur: Acteur; aujourdhui: string; formulaire: FormData; cible: string };

// « Attribuer » : lit et vérifie le formulaire (responsabilité, périmètre, dates), puis laisse le socle trancher.
// Partagé par la fiche de l'agent et la page « Nominations ». `personneId` est null si l'agent n'est pas choisi.
export async function nommer({ base, acteur, aujourdhui, formulaire, cible }: Contexte, personneId: number | null) {
	const texte = (cle: string) => String(formulaire.get(cle) ?? '').trim();
	const valeurs = { responsabiliteId: texte('responsabiliteId'), perimetre: texte('perimetre'), debut: texte('debut'), fin: texte('fin'), personneId: texte('personneId') };
	const erreurs: Record<string, string> = {};
	if (personneId === null) erreurs.personneId = 'Choisissez un agent.';
	if (!/^\d+$/.test(valeurs.responsabiliteId)) erreurs.responsabiliteId = 'Choix inconnu';
	if (!valeurs.debut) erreurs.debut = 'Indiquez la date de début.';
	else if (!dateValide(valeurs.debut)) erreurs.debut = 'Date invalide';
	if (valeurs.fin && !dateValide(valeurs.fin)) erreurs.fin = 'Date invalide';
	const [laResponsabilite] = erreurs.responsabiliteId
		? []
		: await base.select({ typePerimetre: responsabilite.typePerimetre }).from(responsabilite).where(eq(responsabilite.id, Number(valeurs.responsabiliteId)));
	if (!erreurs.responsabiliteId && !laResponsabilite) erreurs.responsabiliteId = 'Choix inconnu';
	let perimetre: Perimetre | null = null;
	if (laResponsabilite?.typePerimetre === 'centre') perimetre = { type: 'centre' };
	else if (laResponsabilite && /^\d+$/.test(valeurs.perimetre) && (laResponsabilite.typePerimetre === 'equipe' || laResponsabilite.typePerimetre === 'comite'))
		perimetre = { type: laResponsabilite.typePerimetre, id: Number(valeurs.perimetre) };
	else if (laResponsabilite) erreurs.perimetreId = 'Choix inconnu';
	if (Object.keys(erreurs).length > 0 || !perimetre || personneId === null) return fail<Reponse>(400, { cible, erreurs, valeurs });
	try {
		await attribuer(base, acteur, { personneId, responsabiliteId: Number(valeurs.responsabiliteId), perimetre, debut: valeurs.debut, ...(valeurs.fin && { fin: valeurs.fin }) }, aujourdhui);
	} catch (erreur) {
		return echecAttribution(erreur, { cible, valeurs });
	}
	return { cible, succes: true, message: 'Rôle attribué' };
}

// « Terminer » : confirmation obligatoire, puis le socle retire le rôle dès aujourd'hui.
// `estVisible` limite les rôles qu'on peut viser depuis la page (un identifiant fabriqué est refusé).
export async function terminer({ base, acteur, aujourdhui, formulaire }: Omit<Contexte, 'cible'>, estVisible: (attributionId: number) => Promise<boolean>) {
	const brut = String(formulaire.get('attributionId') ?? '');
	const attributionId = /^\d+$/.test(brut) ? Number(brut) : NaN;
	const cible = `terminer-${brut}`;
	if (formulaire.get('confirmation') !== 'oui') return fail<Reponse>(400, { cible, erreurs: { confirmation: 'Cochez « Je confirme » pour terminer ce rôle.' } });
	try {
		if (!(await estVisible(attributionId))) throw new DonneeInvalide('Attribution inconnue');
		await terminerAttribution(base, acteur, attributionId, aujourdhui);
	} catch (erreur) {
		return echecAttribution(erreur, { cible });
	}
	return { cible, succes: true, message: 'Rôle terminé' };
}
