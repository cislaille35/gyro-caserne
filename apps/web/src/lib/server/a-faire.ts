import { aNePasManquer, RefusDroit, signalements, type Acteur } from '@gyro-caserne/socle';
import { aujourdhuiParis, maintenantParis } from '#lib/aujourdhui.ts';

export const aNePasManquerDe = (base: App.Locals['base'], acteur: Acteur) => aNePasManquer(base, acteur, aujourdhuiParis(), maintenantParis());

// Les messages signalés, pour qui modère la messagerie ; aucun pour les autres.
export async function signalementsDe(base: App.Locals['base'], acteur: Acteur) {
	try {
		return await signalements(base, acteur, aujourdhuiParis());
	} catch (erreur) {
		if (erreur instanceof RefusDroit) return [];
		throw erreur;
	}
}
