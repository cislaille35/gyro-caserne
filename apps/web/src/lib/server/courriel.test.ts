import { afterEach, describe, expect, it, vi } from 'vitest';
import { envoyerCourriel } from './courriel.ts';

const envoyer = vi.fn();
vi.mock('resend', () => ({
	Resend: class {
		emails = { send: envoyer };
	}
}));

const message = { a: 'test@exemple.fr', sujet: 'Connexion', texte: 'Votre lien : http://localhost/lien' };

afterEach(() => {
	vi.restoreAllMocks();
	envoyer.mockReset();
});

describe('envoyerCourriel', () => {
	it('écrit le lien dans la console sans clé Resend', async () => {
		const console_ = vi.spyOn(console, 'log').mockImplementation(() => {});
		await envoyerCourriel({}, message);
		expect(console_).toHaveBeenCalledWith(expect.stringContaining('http://localhost/lien'));
		expect(envoyer).not.toHaveBeenCalled();
	});

	it('envoie par Resend avec la clé, sans rien écrire dans la console', async () => {
		const console_ = vi.spyOn(console, 'log').mockImplementation(() => {});
		envoyer.mockResolvedValue({ data: { id: '1' }, error: null });
		await envoyerCourriel({ RESEND_CLE: 'cle', COURRIEL_EXPEDITEUR: 'Gyro <gyro@exemple.fr>' }, message);
		expect(envoyer).toHaveBeenCalledWith({ from: 'Gyro <gyro@exemple.fr>', to: 'test@exemple.fr', subject: 'Connexion', text: message.texte });
		expect(console_).not.toHaveBeenCalled();
	});

	it('signale un envoi refusé par Resend', async () => {
		envoyer.mockResolvedValue({ data: null, error: { message: 'refusé' } });
		await expect(envoyerCourriel({ RESEND_CLE: 'cle', COURRIEL_EXPEDITEUR: 'gyro@exemple.fr' }, message)).rejects.toThrow('refusé');
	});

	it('exige un expéditeur avec la clé', async () => {
		await expect(envoyerCourriel({ RESEND_CLE: 'cle' }, message)).rejects.toThrow();
		expect(envoyer).not.toHaveBeenCalled();
	});
});
