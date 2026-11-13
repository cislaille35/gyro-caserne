import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { createAuthMiddleware } from 'better-auth/api';
import { emailOTP, magicLink } from 'better-auth/plugins';
import { eq } from 'drizzle-orm';
import { account, adresseAutorisee, annulerEnvoi, effacerLien, effacerLiensVers, identifiantDuCode, reserverEnvoi, session, user, verification, type Base } from '@gyro-caserne/socle';
import { envoyerCourriel, type EnvCourriel } from './courriel.ts';

export type EnvAuth = EnvCourriel & { BETTER_AUTH_SECRET: string; BETTER_AUTH_URL: string; SUPER_ADMINS?: string };

// 90 jours sans ouvrir l'appli avant d'être déconnecté ; chaque jour d'usage repousse l'échéance (décision 0032). En secondes.
export const DUREE_SESSION = 90 * 86_400;
export const PROLONGEE_APRES = 86_400;

// SUPER_ADMINS : adresses séparées par des virgules.
export function superAdmins(env: EnvAuth): string[] {
	return (env.SUPER_ADMINS ?? '')
		.split(',')
		.map((a) => a.trim())
		.filter(Boolean);
}

// Identifiant du lien en base, calculé comme Better Auth avec storeToken: 'hashed'.
async function identifiantDuLien(jeton: string): Promise<string> {
	const empreinte = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(jeton)));
	const base64url = btoa(String.fromCharCode(...empreinte)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
	return `magic-link:${base64url}`;
}

// Empreinte du code à 6 chiffres, liée au secret de l'appli : sans le secret, une fuite de la table ne permet pas
// de retrouver le code en essayant le million de possibilités.
async function empreinteDuCode(secret: string, code: string): Promise<string> {
	const cle = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
	const empreinte = new Uint8Array(await crypto.subtle.sign('HMAC', cle, new TextEncoder().encode(code)));
	return btoa(String.fromCharCode(...empreinte)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Le plugin emailOTP ne sert qu'à se connecter par le code reçu avec le lien, par l'action de la page de connexion :
// toutes ses routes HTTP sont fermées (auth.api reste utilisable côté serveur).
const ROUTES_DU_CODE_FERMEES = [
	'/sign-in/email-otp',
	'/email-otp/send-verification-otp',
	'/email-otp/check-verification-otp',
	'/email-otp/verify-email',
	'/email-otp/request-password-reset',
	'/forget-password/email-otp',
	'/email-otp/reset-password',
	'/email-otp/request-email-change',
	'/email-otp/change-email'
];

// enArrierePlan : waitUntil de Cloudflare, pour finir l'envoi après la réponse.
export function creerAuth(env: EnvAuth, base: Base, enArrierePlan: (tache: Promise<unknown>) => void, envoyer = envoyerCourriel) {
	const autorisee = (adresse: string) => adresseAutorisee(base, adresse, superAdmins(env));
	const envoyerLien = async (email: string, url: string, jeton: string) => {
		const identifiant = await identifiantDuLien(jeton);
		const reservee = (await autorisee(email)) ? await reserverEnvoi(base, email) : null;
		if (!reservee) {
			// Ce lien ne part pas : on l'efface.
			await effacerLien(base, identifiant);
			return;
		}
		try {
			// Le code part dans le même courriel que le lien : il remplace un code plus ancien.
			await base.delete(verification).where(eq(verification.identifier, identifiantDuCode(email)));
			const code = await auth.api.createVerificationOTP({ body: { email, type: 'sign-in' } });
			await envoyer(env, {
				a: email,
				sujet: 'Connexion à Gyro Caserne',
				texte: `Votre code de connexion : ${code}\n\nTapez-le dans l’appli, sur la page de connexion où vous avez demandé ce courriel. Code et lien valables 5 minutes.\n\nOu ouvrez ce lien :\n${url}`
			});
		} catch (erreur) {
			// Courriel non reçu : on efface le lien et le code, et un nouvel essai est permis tout de suite.
			console.error('Lien de connexion non envoyé', erreur);
			try {
				await effacerLien(base, identifiant);
				await base.delete(verification).where(eq(verification.identifier, identifiantDuCode(email)));
			} finally {
				await annulerEnvoi(base, email, reservee);
			}
			throw erreur;
		}
	};
	const auth = betterAuth({
		database: drizzleAdapter(base, { provider: 'sqlite', schema: { user, session, account, verification } }),
		secret: env.BETTER_AUTH_SECRET,
		// Fixée, pour que le lien envoyé pointe toujours vers l'appli, quelle que soit la requête.
		baseURL: env.BETTER_AUTH_URL,
		advanced: { backgroundTasks: { handler: enArrierePlan } },
		disabledPaths: ROUTES_DU_CODE_FERMEES,
		// Lue sans Better Auth à chaque requête, dans le même format (session.ts, décision 0035).
		session: { expiresIn: DUREE_SESSION, updateAge: PROLONGEE_APRES },
		plugins: [
			magicLink({
				disableSignUp: false,
				// En base, seule l'empreinte du jeton : une fuite de la table ne donne aucun lien valable.
				storeToken: 'hashed',
				// Un lien par minute et par adresse.
				// Tout se fait après la réponse : son contenu et sa durée ne révèlent pas si l'adresse est connue.
				sendMagicLink: ({ email, url, token }, ctx) => {
					ctx!.context.runInBackground(envoyerLien(email, url, token).catch((erreur) => console.error('Lien de connexion non envoyé', erreur)));
				}
			}),
			// Le code à 6 chiffres du même courriel : pour l'appli installée sur iPhone, que le lien n'atteint pas (il ouvre Safari).
			emailOTP({
				expiresIn: 300,
				allowedAttempts: 3,
				storeOTP: { hash: (code) => empreinteDuCode(env.BETTER_AUTH_SECRET, code) },
				// Jamais appelé : le code n'est créé et envoyé qu'avec le lien (voir envoyerLien), les routes d'envoi sont fermées.
				sendVerificationOTP: async () => {
					throw new Error('Envoi d’un code seul non prévu');
				}
			})
		],
		hooks: {
			// Connecté par le code : le lien du même courriel ne sert plus, on l'efface.
			after: createAuthMiddleware(async (ctx) => {
				const nouvelle = ctx.context.newSession;
				if (ctx.path === '/sign-in/email-otp' && nouvelle) await effacerLiensVers(base, nouvelle.user.email);
			})
		},
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
	return auth;
}

export type Auth = ReturnType<typeof creerAuth>;
