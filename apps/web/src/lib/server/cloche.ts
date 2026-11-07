import { enTeteDe, nombreAValider, nombreSignalements } from '@gyro-caserne/socle';
import { aujourdhuiParis, maintenantParis } from '#lib/aujourdhui.ts';

// La cloche : les notifications non lues, les messages signalés pour qui modère (super administrateur compris),
// les demandes de réservation à trancher pour qui gère et les remplacements à valider pour les chefs ; le visage de « Moi ».
// Une panne passagère de la base ne doit pas faire tomber toutes les pages : la cloche reste muette.
export async function lireEnTete(base: App.Locals['base'], acteur: NonNullable<App.Locals['acteur']>) {
	try {
		const [entete, signales, aTrancher] = await Promise.all([enTeteDe(base, acteur, aujourdhuiParis(), maintenantParis()), nombreSignalements(base, acteur, aujourdhuiParis()), nombreAValider(base, acteur, aujourdhuiParis())]);
		return { cloche: entete.nonLues + entete.remplacementsAValider + signales + aTrancher, visage: entete.visage };
	} catch (erreur) {
		console.error('Cloche illisible', erreur);
		return { cloche: 0, visage: null };
	}
}
