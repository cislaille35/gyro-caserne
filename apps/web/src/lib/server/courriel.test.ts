import { afterEach, describe, expect, it, vi } from 'vitest';
import { envoyerCourriel } from './courriel.ts';

const message = { a: 'test@exemple.fr', sujet: 'Connexion', texte: 'Votre lien : http://localhost/lien' };
const env = { BREVO_CLE: 'cle', COURRIEL_EXPEDITEUR: 'cislaille35@exemple.fr' };

function reponse(statut: number, corps: string) {
	const fetch_ = vi.fn().mockResolvedValue(new Response(corps, { status: statut }));
	vi.stubGlobal('fetch', fetch_);
	return fetch_;
}

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe('envoyerCourriel', () => {
	it('écrit le lien dans la console sans clé Brevo', async () => {
		const fetch_ = reponse(201, '{}');
		const console_ = vi.spyOn(console, 'log').mockImplementation(() => {});
		await envoyerCourriel({}, message);
		expect(console_).toHaveBeenCalledWith(expect.stringContaining('http://localhost/lien'));
		expect(fetch_).not.toHaveBeenCalled();
	});

	it('envoie par Brevo avec la clé', async () => {
		const fetch_ = reponse(201, '{"messageId":"1"}');
		const console_ = vi.spyOn(console, 'log').mockImplementation(() => {});
		await envoyerCourriel(env, message);
		expect(fetch_).toHaveBeenCalledTimes(1);
		const [adresse, options] = fetch_.mock.calls[0]!;
		expect(adresse).toBe('https://api.brevo.com/v3/smtp/email');
		expect(options.method).toBe('POST');
		expect(options.headers).toEqual({ 'api-key': 'cle', 'content-type': 'application/json', accept: 'application/json' });
		expect(JSON.parse(options.body)).toEqual({
			sender: { name: 'Gyro Caserne', email: 'cislaille35@exemple.fr' },
			to: [{ email: 'test@exemple.fr' }],
			subject: 'Connexion',
			textContent: message.texte
		});
		expect(console_).not.toHaveBeenCalled();
	});

	it('signale un envoi refusé par Brevo', async () => {
		reponse(400, '{"code":"invalid_parameter","message":"sender not valid"}');
		await expect(envoyerCourriel(env, message)).rejects.toThrow('sender not valid');
	});

	it('signale une réponse illisible', async () => {
		reponse(502, '<html>Bad gateway</html>');
		await expect(envoyerCourriel(env, message)).rejects.toThrow('502');
	});

	it('exige un expéditeur avec la clé', async () => {
		const fetch_ = reponse(201, '{}');
		await expect(envoyerCourriel({ BREVO_CLE: 'cle' }, message)).rejects.toThrow();
		expect(fetch_).not.toHaveBeenCalled();
	});
});
