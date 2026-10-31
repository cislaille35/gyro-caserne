import type { Acteur, Base, BasePhotos } from '@gyro-caserne/socle';
import type { Affichage } from '#lib/affichage.ts';
import type { Auth, EnvAuth } from '#lib/server/auth.ts';
import type { EnvVapid } from '#lib/server/webpush.ts';

declare global {
	namespace App {
		interface Locals {
			base: Base;
			// Les octets des photos, à part de la base principale (décision 0010).
			basePhotos: BasePhotos;
			auth: Auth;
			// Null : personne n'est connecté, ou l'adresse n'a plus accès.
			acteur: Acteur | null;
			// Adresses des super administrateurs : aucune fiche ne peut les prendre.
			superAdmins: string[];
			affichage: Affichage;
			// waitUntil de Cloudflare : finir un travail après la réponse (les notifications).
			enArrierePlan?: (tache: Promise<unknown>) => void;
			// Clé publique VAPID du centre, pour abonner un appareil ; nulle sans secrets.
			clePublique?: string | null;
		}
	}
	// Variables Cloudflare de l'appli, lues avec `import { env } from 'cloudflare:workers'`
	namespace Cloudflare {
		interface Env extends EnvAuth, EnvVapid {
			BASE: D1Database;
			PHOTOS: D1Database;
		}
	}
}

export {};
