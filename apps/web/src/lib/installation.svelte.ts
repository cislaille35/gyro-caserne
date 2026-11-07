// L'invitation à installer, gardée dès le chargement de l'appli (Chrome et Edge l'envoient une fois, tôt), et l'état de cet appareil.
import { estInstallee, estIOS, type Plateforme } from './installation.ts';

type Invite = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

const etat = $state<{ invite: Invite | null; installee: boolean }>({ invite: null, installee: false });

if (typeof window !== 'undefined') {
	window.addEventListener('beforeinstallprompt', (e) => {
		// Pas de bandeau du navigateur : notre bouton l'ouvre, au bon endroit.
		e.preventDefault();
		etat.invite = e as Invite;
	});
	window.addEventListener('appinstalled', () => {
		etat.invite = null;
		etat.installee = true;
	});
}

// Dans le navigateur seulement (après le montage) : réactif à l'arrivée de l'invitation et à l'installation.
export function appareil(): Plateforme {
	const nav = navigator as Navigator & { standalone?: boolean };
	return { installee: etat.installee || estInstallee(window.matchMedia('(display-mode: standalone)').matches, nav), ios: estIOS(nav), invite: etat.invite !== null };
}

// Ouvre la fenêtre d'installation du navigateur. Une invitation ne sert qu'une fois : le navigateur en renverra une s'il le juge bon.
export async function installer(): Promise<void> {
	const invite = etat.invite;
	if (!invite) return;
	etat.invite = null;
	try {
		await invite.prompt();
		if ((await invite.userChoice).outcome === 'accepted') etat.installee = true;
	} catch {
		// Invitation déjà servie : le menu du navigateur reste possible (Moi → Installer l'appli le dit).
	}
}
