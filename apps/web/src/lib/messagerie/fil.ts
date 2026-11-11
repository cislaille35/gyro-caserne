import type { VueMessage } from '@gyro-caserne/socle';

// Les décisions de l'écran d'une conversation, sans le navigateur.

// Les dates sont à l'heure de Paris : on les lit telles quelles, avec ou sans secondes.
export const instant = (iso: string) => Date.parse(`${iso.slice(0, 19).padEnd(19, ':00')}Z`);

// Brouillons : un par personne connectée et par conversation, pour que deux comptes d'un même appareil ne se lisent pas.
const BROUILLON = 'gyro:brouillon:';
export const cleBrouillon = (moi: number, conversation: string) => `${BROUILLON}${moi}:${conversation}`;

// À la déconnexion : tous les brouillons de l'appareil sont effacés. Un stockage indisponible ne bloque rien.
export function purgerBrouillons(stockage: Pick<Storage, 'length' | 'key' | 'removeItem'>): void {
	try {
		const cles: string[] = [];
		for (let i = 0; i < stockage.length; i++) {
			const cle = stockage.key(i);
			if (cle?.startsWith(BROUILLON)) cles.push(cle);
		}
		cles.forEach((cle) => stockage.removeItem(cle));
	} catch {
		// Navigation privée, stockage bloqué : rien à effacer.
	}
}

// Ceux de l'appareil, au moment de se déconnecter.
export function oublierBrouillons(): void {
	try {
		purgerBrouillons(localStorage);
	} catch {
		// Stockage inaccessible.
	}
}

// Des messages arrivent : on descend si l'on était en bas ou si l'on vient d'envoyer ; sinon « ↓ » compte ceux des autres.
// La demande de descendre (après un envoi) ne vaut que pour ce tour, même s'il n'apporte rien.
export function apresArrivee(etat: { forcerBas: boolean; etaitEnBas: boolean; compteur: number }, arrives: VueMessage[]) {
	if (arrives.length === 0) return { descendre: false, compteur: etat.compteur, forcerBas: false };
	if (etat.forcerBas || etat.etaitEnBas) return { descendre: true, compteur: 0, forcerBas: false };
	return { descendre: false, compteur: etat.compteur + arrives.filter((m) => !m.moi).length, forcerBas: false };
}

// À l'ordinateur, Entrée envoie (Maj + Entrée va à la ligne) ; au téléphone, Entrée va toujours à la ligne.
export const entreeEnvoie = (e: { key: string; shiftKey: boolean; isComposing: boolean }, ordinateur: boolean) => ordinateur && e.key === 'Enter' && !e.shiftKey && !e.isComposing;

// Au doigt : appui long pour le menu, glisser vers la droite pour répondre.
export const APPUI_LONG = 500;
export const SEUIL_REPONSE = 56;
const GLISSE_MAX = 80;
export const mouvementAnnuleAppui = (x: number, y: number) => Math.abs(x) > 8 || Math.abs(y) > 8;
// « Réduire les animations » (`calme`) coupe le glissement ; le menu propose toujours « Répondre ».
export const glissementCommence = (x: number, y: number, { actif, calme }: { actif: boolean; calme: boolean }) => actif && !calme && x > 12 && Math.abs(y) < x / 2;
export const ecartGlisse = (x: number) => Math.max(0, Math.min(x, GLISSE_MAX));
// Un geste vif suffit, sans aller jusqu'au seuil ; un tout petit mouvement n'y suffit pas.
const VIF_MIN = 24;
const VITESSE_VIVE = 0.11;
export const glissementRepond = (ecart: number, duree = Infinity) => ecart >= SEUIL_REPONSE || (ecart >= VIF_MIN && ecart / duree > VITESSE_VIVE);
