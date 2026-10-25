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

// enArrierePlan : waitUntil de Cloudflare, pour finir l'envoi après la réponse.
export function creerAuth(env: EnvAuth, base: Base, enArrierePlan: (tache: Promise<unknown>) => void, envoyer = envoyerCourriel) {
	const autorisee = (adresse: string) => adresseAutorisee(base, adresse, superAdmins(env));
	const envoyerLien = async (email: string, url: string) => {
		if (!(await autorisee(email))) return;
		await envoyer(env, { a: email, sujet: 'Connexion à Gyro Caserne', texte: `Pour vous connecter, ouvrez ce lien (valable 5 minutes) :\n${url}` });
	};
	return betterAuth({
		database: drizzleAdapter(base, { provider: 'sqlite', schema: { user, session, account, verification } }),
		secret: env.BETTER_AUTH_SECRET,
		// Fixée, pour que le lien envoyé pointe toujours vers l'appli, quelle que soit la requête.
		baseURL: env.BETTER_AUTH_URL,
		advanced: { backgroundTasks: { handler: enArrierePlan } },
		plugins: [
			magicLink({
				disableSignUp: false,
				// En base, seule l'empreinte du jeton : une fuite de la table ne donne aucun lien valable.
				storeToken: 'hashed',
				// Tout se fait après la réponse : son contenu et sa durée ne révèlent pas si l'adresse est connue.
				sendMagicLink: ({ email, url }, ctx) => {
					ctx!.context.runInBackground(envoyerLien(email, url).catch((erreur) => console.error('Lien de connexion non envoyé', erreur)));
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
