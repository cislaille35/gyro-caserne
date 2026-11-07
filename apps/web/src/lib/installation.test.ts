import { describe, expect, it } from 'vitest';
import { choixEncart, choixPage, estInstallee, estIOS, lirePlusTard, noterPlusTard, PLUS_TARD_JOURS } from './installation.ts';

const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const android = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36';
const mac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
const maintenant = new Date('2026-11-07T10:00:00Z');

function stockage(valeurs: Record<string, string> = {}) {
	return { getItem: (k: string) => valeurs[k] ?? null, setItem: (k: string, v: string) => void (valeurs[k] = v), valeurs };
}

describe('plateforme', () => {
	it('iPhone, iPad (qui se dit Mac, mais tactile) ; pas Android ni un vrai Mac', () => {
		expect(estIOS({ userAgent: iphone, maxTouchPoints: 5 })).toBe(true);
		expect(estIOS({ userAgent: mac, maxTouchPoints: 5 })).toBe(true);
		expect(estIOS({ userAgent: mac, maxTouchPoints: 0 })).toBe(false);
		expect(estIOS({ userAgent: android, maxTouchPoints: 5 })).toBe(false);
	});

	it('installée : ouverte en plein écran (display-mode standalone), ou depuis l’écran d’accueil d’un iPhone', () => {
		expect(estInstallee(true, {})).toBe(true);
		expect(estInstallee(false, { standalone: true })).toBe(true);
		expect(estInstallee(false, { standalone: false })).toBe(false);
		expect(estInstallee(false, {})).toBe(false);
	});
});

describe('choixEncart (l’accueil)', () => {
	it('iPhone non installé : l’encart guidé ; navigateur qui propose l’installation : le bouton ; sinon rien', () => {
		expect(choixEncart({ installee: false, ios: true, invite: false }, null, maintenant)).toBe('iphone');
		expect(choixEncart({ installee: false, ios: false, invite: true }, null, maintenant)).toBe('bouton');
		expect(choixEncart({ installee: false, ios: false, invite: false }, null, maintenant)).toBe('rien');
	});

	it('déjà installée : rien, quelle que soit la plateforme', () => {
		expect(choixEncart({ installee: true, ios: true, invite: false }, null, maintenant)).toBe('rien');
		expect(choixEncart({ installee: true, ios: false, invite: true }, null, maintenant)).toBe('rien');
	});

	it(`« Plus tard » : rien pendant ${PLUS_TARD_JOURS} jours, puis l’encart revient ; une date illisible ne bloque rien`, () => {
		const ios = { installee: false, ios: true, invite: false };
		const il = (jours: number) => new Date(maintenant.getTime() - jours * 864e5).toISOString();
		expect(choixEncart(ios, il(1), maintenant)).toBe('rien');
		expect(choixEncart(ios, il(PLUS_TARD_JOURS - 0.01), maintenant)).toBe('rien');
		expect(choixEncart(ios, il(PLUS_TARD_JOURS), maintenant)).toBe('iphone');
		expect(choixEncart(ios, 'nimporte', maintenant)).toBe('iphone');
	});
});

describe('choixPage (Moi → Installer l’appli)', () => {
	it('toujours une réponse : installée, iPhone, bouton, ou le menu du navigateur ; « Plus tard » n’y compte pas', () => {
		expect(choixPage({ installee: true, ios: true, invite: false })).toBe('installee');
		expect(choixPage({ installee: false, ios: true, invite: false })).toBe('iphone');
		expect(choixPage({ installee: false, ios: false, invite: true })).toBe('bouton');
		expect(choixPage({ installee: false, ios: false, invite: false })).toBe('menu');
	});
});

describe('« Plus tard » sur ce navigateur', () => {
	it('noté puis relu', () => {
		const s = stockage();
		noterPlusTard(s, maintenant);
		expect(lirePlusTard(s)).toBe(maintenant.toISOString());
	});

	it('stockage refusé (navigation privée, données bloquées) : sans erreur, l’encart reste proposé', () => {
		const refuse = {
			getItem: () => {
				throw new DOMException('refus', 'SecurityError');
			},
			setItem: () => {
				throw new DOMException('plein', 'QuotaExceededError');
			}
		};
		expect(() => noterPlusTard(refuse, maintenant)).not.toThrow();
		expect(lirePlusTard(refuse)).toBeNull();
		expect(lirePlusTard(null)).toBeNull();
		expect(() => noterPlusTard(null, maintenant)).not.toThrow();
	});
});
