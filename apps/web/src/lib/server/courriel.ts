import { Resend } from 'resend';

export type EnvCourriel = { RESEND_CLE?: string; COURRIEL_EXPEDITEUR?: string };

// Sans clé Resend (développement), le message est écrit dans la console au lieu de partir.
export async function envoyerCourriel(env: EnvCourriel, m: { a: string; sujet: string; texte: string }): Promise<void> {
	if (!env.RESEND_CLE) {
		console.log(`Courriel pour ${m.a} : ${m.sujet}\n${m.texte}`);
		return;
	}
	if (!env.COURRIEL_EXPEDITEUR) throw new Error('COURRIEL_EXPEDITEUR manquant');
	const { error } = await new Resend(env.RESEND_CLE).emails.send({ from: env.COURRIEL_EXPEDITEUR, to: m.a, subject: m.sujet, text: m.texte });
	if (error) throw new Error(`Courriel refusé par Resend : ${error.message}`);
}
