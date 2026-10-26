export type EnvCourriel = { BREVO_CLE?: string; COURRIEL_EXPEDITEUR?: string };

// Sans clé Brevo (développement), le message est écrit dans la console au lieu de partir.
export async function envoyerCourriel(env: EnvCourriel, m: { a: string; sujet: string; texte: string }): Promise<void> {
	if (!env.BREVO_CLE) {
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
