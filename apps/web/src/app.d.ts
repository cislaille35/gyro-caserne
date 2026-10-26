import type { Acteur, Base } from '@gyro-caserne/socle';
import type { Auth, EnvAuth } from '#lib/server/auth.ts';

declare global {
	namespace App {
		interface Locals {
			base: Base;
			auth: Auth;
			// Null : personne n'est connecté, ou l'adresse n'a plus accès.
			acteur: Acteur | null;
		}
	}
	// Variables Cloudflare de l'appli, lues avec `import { env } from 'cloudflare:workers'`
	namespace Cloudflare {
		interface Env extends EnvAuth {
			BASE: D1Database;
		}
	}
}

export {};
