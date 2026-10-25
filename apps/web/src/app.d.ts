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
		interface Platform {
			env: EnvAuth & { BASE: D1Database };
			ctx: ExecutionContext;
			caches: CacheStorage & { default: Cache };
		}
	}
}

export {};
