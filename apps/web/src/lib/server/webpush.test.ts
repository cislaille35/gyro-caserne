import { describe, expect, it } from 'vitest';
import { b64u, chiffrer, clesVapid, depuisB64u, jetonVapid, requetePush } from './webpush.ts';
import { paireVapid } from './vapid-de-test.ts';

const enc = new TextEncoder();

async function hmac(cle: Uint8Array, donnees: Uint8Array) {
	const k = await crypto.subtle.importKey('raw', cle as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
	return new Uint8Array(await crypto.subtle.sign('HMAC', k, donnees as BufferSource));
}
const joindre = (...p: Uint8Array[]) => {
	const r = new Uint8Array(p.reduce((n, x) => n + x.length, 0));
	let i = 0;
	for (const x of p) (r.set(x, i), (i += x.length));
	return r;
};

// Un navigateur abonné : sa paire ECDH et son secret d'authentification.
async function navigateur() {
	const paire = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair;
	const publique = new Uint8Array((await crypto.subtle.exportKey('raw', paire.publicKey)) as ArrayBuffer);
	const auth = crypto.getRandomValues(new Uint8Array(16));
	return { paire, publique, auth, p256dh: b64u(publique), authB64: b64u(auth) };
}

// Déchiffrement selon la RFC 8291, écrit à part pour vérifier `chiffrer`.
async function dechiffrer(corps: Uint8Array, nav: Awaited<ReturnType<typeof navigateur>>) {
	const sel = corps.slice(0, 16);
	const rs = new DataView(corps.buffer, corps.byteOffset + 16, 4).getUint32(0);
	const longueur = corps[20]!;
	const asPublique = corps.slice(21, 21 + longueur);
	const cleAs = await crypto.subtle.importKey('raw', asPublique, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
	const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: cleAs }, nav.paire.privateKey, 256));
	const prkCle = await hmac(nav.auth, ecdh);
	const ikm = (await hmac(prkCle, joindre(enc.encode('WebPush: info\0'), nav.publique, asPublique, new Uint8Array([1])))).slice(0, 32);
	const prk = await hmac(sel, ikm);
	const cek = (await hmac(prk, joindre(enc.encode('Content-Encoding: aes128gcm\0'), new Uint8Array([1])))).slice(0, 16);
	const nonce = (await hmac(prk, joindre(enc.encode('Content-Encoding: nonce\0'), new Uint8Array([1])))).slice(0, 12);
	const cle = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
	const clair = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, cle, corps.slice(21 + longueur)));
	return { rs, longueur, texte: new TextDecoder().decode(clair.slice(0, -1)), fin: clair.at(-1) };
}

describe('Web Push', () => {
	it('chiffrer : lisible par le navigateur abonné (aes128gcm, enregistrement de 4096)', async () => {
		const nav = await navigateur();
		const corps = await chiffrer('{"titre":"Équipe 2 · Bruno"}', nav.p256dh, nav.authB64);
		expect(await dechiffrer(corps, nav)).toEqual({ rs: 4096, longueur: 65, texte: '{"titre":"Équipe 2 · Bruno"}', fin: 2 });
	});

	it('clesVapid : nulles sans secrets ; sinon la clé privée complète et le contact', async () => {
		expect(clesVapid({})).toBeNull();
		const { VAPID_PUBLIQUE, VAPID_PRIVEE } = await paireVapid();
		const cles = clesVapid({ VAPID_PUBLIQUE, VAPID_PRIVEE, COURRIEL_EXPEDITEUR: 'caserne@exemple.fr', BETTER_AUTH_URL: 'https://appli.exemple' })!;
		expect(cles.publique).toBe(VAPID_PUBLIQUE);
		expect(cles.privee).toMatchObject({ kty: 'EC', crv: 'P-256', d: VAPID_PRIVEE });
		expect(cles.contact).toBe('mailto:caserne@exemple.fr');
		expect(clesVapid({ VAPID_PUBLIQUE, VAPID_PRIVEE, BETTER_AUTH_URL: 'https://appli.exemple' })!.contact).toBe('https://appli.exemple');
		expect(clesVapid({ VAPID_PUBLIQUE: 'abc', VAPID_PRIVEE, BETTER_AUTH_URL: 'https://appli.exemple' })).toBeNull();
		// Sans contact (Apple refuserait tout), ou une clé privée qui n'en est pas une : pas de clés plutôt que des envois perdus.
		expect(clesVapid({ VAPID_PUBLIQUE, VAPID_PRIVEE })).toBeNull();
		expect(clesVapid({ VAPID_PUBLIQUE, VAPID_PRIVEE: 'abc', BETTER_AUTH_URL: 'https://appli.exemple' })).toBeNull();
	});

	it('jetonVapid : signé par la clé VAPID, pour le service push visé', async () => {
		const { VAPID_PUBLIQUE, VAPID_PRIVEE, paire } = await paireVapid();
		const cles = clesVapid({ VAPID_PUBLIQUE, VAPID_PRIVEE, BETTER_AUTH_URL: 'https://appli.exemple' })!;
		const jeton = await jetonVapid('https://fcm.googleapis.com', cles, 1_800_000_000);
		const [tete, charge, signature] = jeton.split('.');
		expect(JSON.parse(new TextDecoder().decode(depuisB64u(charge!)))).toEqual({ aud: 'https://fcm.googleapis.com', exp: 1_800_000_000 + 12 * 3600, sub: 'https://appli.exemple' });
		expect(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, paire.publicKey, depuisB64u(signature!), enc.encode(`${tete}.${charge}`))).toBe(true);
	});

	it('requetePush : en-têtes Web Push, sujet tiré du tag, un jeton par service push', async () => {
		const { VAPID_PUBLIQUE, VAPID_PRIVEE } = await paireVapid();
		const cles = clesVapid({ VAPID_PUBLIQUE, VAPID_PRIVEE, BETTER_AUTH_URL: 'https://appli.exemple' })!;
		const nav = await navigateur();
		const jetons = new Map<string, string>();
		const abonnement = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', p256dh: nav.p256dh, auth: nav.authB64 };
		const { url, init } = await requetePush(abonnement, { titre: 'T', texte: 'x', url: '/', tag: 'conversation:12' }, cles, jetons);
		expect(url).toBe(abonnement.endpoint);
		const entetes = init.headers as Record<string, string>;
		expect(entetes).toMatchObject({ 'Content-Encoding': 'aes128gcm', TTL: '86400', Topic: 'conversation-12' });
		expect(entetes.Authorization).toMatch(new RegExp(`^vapid t=[\\w-]+\\.[\\w-]+\\.[\\w-]+, k=${VAPID_PUBLIQUE}$`));
		await requetePush(abonnement, { titre: 'T', texte: 'x', url: '/', tag: 'publication:3' }, cles, jetons);
		expect([...jetons.keys()]).toEqual(['https://fcm.googleapis.com']);
		await expect(requetePush({ ...abonnement, endpoint: 'http://x' }, { titre: 'T', texte: '', url: '/', tag: 't' }, cles, jetons)).rejects.toThrow();
	});
});
