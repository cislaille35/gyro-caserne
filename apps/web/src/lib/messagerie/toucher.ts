import type { VueMessage } from '@gyro-caserne/socle';
import { APPUI_LONG, ecartGlisse, glissementCommence, glissementRepond, mouvementAnnuleAppui } from './fil.ts';

export type Toucher = {
	message: VueMessage;
	// Le menu s'ouvre aussi en lecture seule (copier, supprimer, signaler) ; le glissement, seulement si l'on peut répondre.
	menu: boolean;
	repondreAutorise: boolean;
	ouvrirMenu: (m: VueMessage) => void;
	repondre: (m: VueMessage) => void;
};

const calme = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// Au doigt, en Pointer Events : un appui long ouvre le menu ; glisser la bulle vers la droite répond (jamais seul : le menu le
// propose aussi). « Réduire les animations » coupe le glissement.
export function toucher(noeud: HTMLElement, depart: Toucher) {
	let o = depart;
	let debut: { x: number; y: number; pointeur: number } | null = null;
	let minuteur: ReturnType<typeof setTimeout> | undefined;
	let glisse = false;
	let ecart = 0;
	let appuiLong = false;
	let doigt = false;
	const remettre = () => {
		noeud.style.transform = '';
		noeud.classList.remove('glisse');
	};
	const bas = (e: PointerEvent) => {
		doigt = e.pointerType === 'touch';
		if (!doigt || !o.menu) return;
		debut = { x: e.clientX, y: e.clientY, pointeur: e.pointerId };
		glisse = false;
		ecart = 0;
		minuteur = setTimeout(() => {
			debut = null;
			appuiLong = true;
			o.ouvrirMenu(o.message);
		}, APPUI_LONG);
	};
	const bouge = (e: PointerEvent) => {
		if (!debut || e.pointerId !== debut.pointeur) return;
		const x = e.clientX - debut.x;
		const y = e.clientY - debut.y;
		if (mouvementAnnuleAppui(x, y)) clearTimeout(minuteur);
		if (!glisse && glissementCommence(x, y, { actif: o.repondreAutorise, calme: calme() })) {
			glisse = true;
			noeud.classList.add('glisse');
			noeud.setPointerCapture(e.pointerId);
		}
		if (glisse) {
			ecart = ecartGlisse(x);
			noeud.style.transform = `translateX(${ecart}px)`;
		}
	};
	const haut = () => {
		clearTimeout(minuteur);
		if (glisse && glissementRepond(ecart)) o.repondre(o.message);
		debut = null;
		glisse = false;
		remettre();
	};
	const menuContextuel = (e: Event) => {
		if (doigt) e.preventDefault();
	};
	// Après un appui long, le doigt levé ne doit pas ouvrir la photo ou la citation.
	const clic = (e: Event) => {
		if (!appuiLong) return;
		appuiLong = false;
		e.preventDefault();
		e.stopPropagation();
	};
	const ecoutes: [string, EventListener, boolean?][] = [
		['pointerdown', bas as EventListener],
		['pointermove', bouge as EventListener],
		['pointerup', haut],
		['pointercancel', haut],
		['contextmenu', menuContextuel],
		['click', clic, true]
	];
	for (const [nom, f, capture] of ecoutes) noeud.addEventListener(nom, f, capture);
	return {
		update(nouveau: Toucher) {
			o = nouveau;
		},
		destroy() {
			clearTimeout(minuteur);
			for (const [nom, f, capture] of ecoutes) noeud.removeEventListener(nom, f, capture);
		}
	};
}
