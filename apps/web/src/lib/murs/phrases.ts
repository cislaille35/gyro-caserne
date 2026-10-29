import type { Mur } from '@gyro-caserne/socle';

// « l’équipe 1 », « l’Amicale », « du comité du centre », « du comité Sport »
function groupe(type: 'equipe' | 'comite', nom: string): string {
	const minuscule = nom.charAt(0).toLowerCase() + nom.slice(1);
	if (type === 'equipe') return /^équipe(\s|$)/i.test(nom) ? `de l’${minuscule}` : `de l’équipe ${nom}`;
	if (/^comité(\s|$)/i.test(nom)) return `du ${minuscule}`;
	return /^[aeiouyhàâéèêëîïôûœ]/i.test(nom) ? `de l’${nom}` : `du comité ${nom}`;
}

// Qui voit un mur ; `audience` compte ses membres naturels.
export function phraseAudience(type: Mur['type'], nom: string, audience: number): string {
	if (type === 'centre' || type === 'vie') return `Visible par tous les agents du centre (${audience})`;
	const membres = audience === 1 ? 'le membre' : `les ${audience} membres`;
	return `Visible par ${membres} ${groupe(type, nom)}, le chef et l’adjoint`;
}

// À quoi sert un mur.
export function phraseDuMur(type: Mur['type'], nom: string): string {
	if (type === 'centre') return 'Les infos officielles du chef et de l’adjoint';
	if (type === 'vie') return 'Pour tout le monde : sorties, sport, photos';
	if (type === 'equipe') return 'Votre équipe d’astreinte';
	return /^comité(\s|$)/i.test(nom) ? nom : `Le comité ${nom}`;
}
