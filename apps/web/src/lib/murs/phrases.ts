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
	if (audience === 0) return 'Aucun membre pour l’instant : visible par le chef et l’adjoint';
	const membres = audience === 1 ? 'le membre' : `les ${audience} membres`;
	return `Visible par ${membres} ${groupe(type, nom)}, le chef et l’adjoint`;
}

// À quoi sert un mur ; rien pour un comité, la phrase répéterait son nom. `sienne` : le mur de l'équipe de l'acteur.
export function phraseDuMur(type: Mur['type'], sienne = false): string | null {
	if (type === 'centre') return 'Les infos officielles du chef et de l’adjoint';
	if (type === 'vie') return 'Pour tout le monde : sorties, sport, photos';
	if (type === 'equipe') return sienne ? 'Votre équipe d’astreinte' : 'Une équipe d’astreinte du centre';
	return null;
}

// « Le mur de l’Amicale », « Le mur du comité du centre » : le lien vers le mur d'un comité.
export const murDuComite = (nom: string) => `Le mur ${groupe('comite', nom)}`;
