export type EnvCourriel = { BREVO_CLE?: string; COURRIEL_EXPEDITEUR?: string; BETTER_AUTH_URL?: string };

// L'appli tourne sur la machine du développeur (développement, tests) : rien n'est gardé de sa console.
function enLocal(adresse: string | undefined): boolean {
	try {
		return ['localhost', '127.0.0.1'].includes(new URL(adresse ?? '').hostname);
	} catch {
		return false;
	}
}

// Sans clé Brevo, en local seulement, le message est écrit dans la console au lieu de partir. En ligne, le journal du Worker
// est gardé (décision 0036) : un lien ou un code écrit là servirait à se connecter à la place de l'agent, donc l'envoi échoue.
export async function envoyerCourriel(env: EnvCourriel, m: { a: string; sujet: string; texte: string }): Promise<void> {
	if (!env.BREVO_CLE) {
		if (!enLocal(env.BETTER_AUTH_URL)) throw new Error('BREVO_CLE manquante : courriel non envoyé');
		console.log(`Courriel pour ${m.a} : ${m.sujet}\n${m.texte}`);
		return;
	}
	if (!env.COURRIEL_EXPEDITEUR) throw new Error('COURRIEL_EXPEDITEUR manquant');
	const reponse = await fetch('https://api.brevo.com/v3/smtp/email', {
		method: 'POST',
		headers: { 'api-key': env.BREVO_CLE, 'content-type': 'application/json', accept: 'application/json' },
		body: JSON.stringify({
			sender: { name: 'Gyro Caserne', email: env.COURRIEL_EXPEDITEUR },
			to: [{ email: m.a }],
			subject: m.sujet,
			textContent: m.texte
		})
	});
	if (reponse.ok) return;
	const detail = await reponse.text();
	let message = detail;
	try {
		message = JSON.parse(detail).message ?? detail;
	} catch {
		// Réponse qui n'est pas du JSON (panne côté Brevo) : on garde le texte brut.
	}
	throw new Error(`Courriel refusé par Brevo (${reponse.status}) : ${message}`);
}
