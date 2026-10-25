import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { magicLink } from 'better-auth/plugins';
import { account, adresseAutorisee, session, user, verification, type Base } from '@gyro-caserne/socle';
import { envoyerCourriel, type EnvCourriel } from './courriel.ts';

export type EnvAuth = EnvCourriel & { BETTER_AUTH_SECRET: string; BETTER_AUTH_URL: string; SUPER_ADMINS?: string };

// SUPER_ADMINS : adresses séparées par des virgules.
export function superAdmins(env: EnvAuth): string[] {
	return (env.SUPER_ADMINS ?? '')
		.split(',')
		.map((a) => a.trim())
		.filter(Boolean);
}

export function creerAuth(env: EnvAuth, base: Base) {
	const autorisee = (adresse: string) => adresseAutorisee(base, adresse, superAdmins(env));
	return betterAuth({
		database: drizzleAdapter(base, { provider: 'sqlite', schema: { user, session, account, verification } }),
		secret: env.BETTER_AUTH_SECRET,
		// Fixée, pour que le lien envoyé pointe toujours vers l'appli, quelle que soit la requête.
		baseURL: env.BETTER_AUTH_URL,
		plugins: [
			magicLink({
				disableSignUp: false,
				// Rien ne part pour une adresse inconnue, et la réponse est la même.
				sendMagicLink: async ({ email, url }) => {
					if (!(await autorisee(email))) return;
					await envoyerCourriel(env, { a: email, sujet: 'Connexion à Gyro Caserne', texte: `Pour vous connecter, ouvrez ce lien (valable 5 minutes) :\n${url}` });
				}
			})
		],
		databaseHooks: {
			user: {
				create: {
					before: async (nouveau) => {
						if (!(await autorisee(nouveau.email))) return false;
					}
				}
			}
		}
	});
}

export type Auth = ReturnType<typeof creerAuth>;
