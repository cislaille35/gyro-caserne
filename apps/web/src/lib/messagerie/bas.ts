type Fenetre = {
	scrollY: number;
	addEventListener(type: 'scroll', f: () => void, options?: AddEventListenerOptions): void;
	removeEventListener(type: 'scroll', f: () => void): void;
};

// Après « ↓ » (ou à l'ouverture), la page redescend chaque fois qu'elle grandit (une photo qui se charge, même pendant
// la descente), tant que la personne ne remonte pas elle-même. `observer` prévient quand la page grandit, et rend de quoi arrêter.
export function suivreLeBas(fenetre: Fenetre, observer: (rappel: () => void) => () => void, descendre: () => void) {
	let actif = false;
	let y = fenetre.scrollY;
	// La descente et la page qui grandit ne font jamais remonter : remonter, c'est la personne.
	const defile = () => {
		if (fenetre.scrollY < y - 1) actif = false;
		y = fenetre.scrollY;
	};
	fenetre.addEventListener('scroll', defile, { passive: true });
	const couper = observer(() => {
		if (actif) descendre();
	});
	return {
		suivre() {
			actif = true;
			y = fenetre.scrollY;
		},
		// Un geste qui mène ailleurs que le bas (plus anciens, message cité), même sans défilement.
		lacher() {
			actif = false;
		},
		arreter() {
			fenetre.removeEventListener('scroll', defile);
			couper();
		}
	};
}
