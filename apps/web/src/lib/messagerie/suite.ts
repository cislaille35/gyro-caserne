import type { VueMessage } from '@gyro-caserne/socle';

type Repere = { dernierId: number; majLe: string };
type Rappels = {
	// Les messages arrivés, et ceux d'avant qui ont changé (modifiés, supprimés, réactions, coches).
	recu: (nouveaux: VueMessage[], modifies: VueMessage[]) => void;
	// La personne ne fait plus partie de la conversation : la phrase à afficher.
	exclu: (message: string) => void;
	// Chaque tour réussi, même sans rien de neuf.
	tour?: () => void;
};

// Suit une conversation ouverte : toutes les 4 s tant que la page est visible, tout de suite au retour sur l'onglet et après un
// envoi (`relancer`). Une panne passe sans bruit : le tour suivant réessaie avec le même repère. Un 403 arrête le suivi.
export function suivreConversation(id: number, depart: Repere, rappels: Rappels, intervalle = 4000) {
	const repere = { ...depart };
	let arrete = false;
	let enCours: Promise<void> | null = null;
	let encore = false;

	async function tour() {
		try {
			const reponse = await fetch(`/echanges/messages/${id}/suite?dernier=${repere.dernierId}&maj=${encodeURIComponent(repere.majLe)}`);
			if (reponse.status === 403) {
				arreter();
				rappels.exclu(((await reponse.json()) as { message: string }).message);
				return;
			}
			if (!reponse.ok) return;
			const { nouveaux, modifies, majLe } = (await reponse.json()) as { nouveaux: VueMessage[]; modifies: VueMessage[]; majLe: string };
			repere.majLe = majLe;
			repere.dernierId = Math.max(repere.dernierId, ...nouveaux.map((m) => m.id));
			rappels.tour?.();
			if (nouveaux.length > 0 || modifies.length > 0) rappels.recu(nouveaux, modifies);
		} catch {
			// Hors ligne : on réessaiera.
		}
	}

	// Un seul appel à la fois ; une relance pendant un appel en refait un juste après.
	function lire(): Promise<void> {
		if (arrete) return Promise.resolve();
		if (enCours) {
			encore = true;
			return enCours;
		}
		enCours = tour().finally(() => {
			enCours = null;
			if (encore) {
				encore = false;
				void lire();
			}
		});
		return enCours;
	}

	const visible = () => document.visibilityState === 'visible';
	const minuteur = setInterval(() => visible() && lire(), intervalle);
	const auRetour = () => visible() && lire();
	document.addEventListener('visibilitychange', auRetour);

	function arreter() {
		arrete = true;
		clearInterval(minuteur);
		document.removeEventListener('visibilitychange', auRetour);
	}
	return { arreter, relancer: lire };
}
