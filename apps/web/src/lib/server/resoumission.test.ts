import { describe, expect, it } from 'vitest';
import { formulaireEgare } from './resoumission.ts';

const html = { accept: 'text/html,application/xhtml+xml' };
const envoi = (adresse: string, entetes: Record<string, string> = html) => new Request(adresse, { method: 'POST', headers: entetes, body: 'id=1' });
const introuvable = () => new Response('Not Found', { status: 404 });

describe('formulaire renvoyé par Safari à une page qui ne l’attend pas', () => {
	it('recharge la page au lieu d’afficher 404', () => {
		const reponse = formulaireEgare(envoi('http://x/?casquette=centre'), new URL('http://x/?casquette=centre'), introuvable());
		expect(reponse?.status).toBe(303);
		expect(reponse?.headers.get('location')).toBe('/?casquette=centre');
	});

	it('ne touche pas à un geste nommé, même refusé en 404 (publication disparue)', () => {
		expect(formulaireEgare(envoi('http://x/?casquette=centre&/repondre'), new URL('http://x/?casquette=centre&/repondre'), introuvable())).toBeNull();
	});

	it('ne touche ni aux envois de l’appli, ni aux autres réponses, ni aux lectures', () => {
		const url = new URL('http://x/');
		expect(formulaireEgare(envoi('http://x/', { ...html, 'x-sveltekit-action': 'true' }), url, introuvable())).toBeNull();
		expect(formulaireEgare(envoi('http://x/', { accept: 'application/json' }), url, introuvable())).toBeNull();
		expect(formulaireEgare(envoi('http://x/'), url, new Response('ok'))).toBeNull();
		expect(formulaireEgare(new Request('http://x/', { headers: html }), url, introuvable())).toBeNull();
	});
});
