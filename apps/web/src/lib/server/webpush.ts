// Web Push sans bibliothèque, avec Web Crypto (repris du MVP cis-laille) : chiffrement « aes128gcm » (RFC 8291 et 8188) et
// jeton VAPID (RFC 8292). Accepté par Chrome, Firefox, Edge et Safari (iPhone 16.4 et plus, appli installée).
// Chargé aussi par la tâche planifiée, hors de SvelteKit : aucun import.

const enc = new TextEncoder();

export function b64u(octets: ArrayBuffer | Uint8Array): string {
	const b = octets instanceof Uint8Array ? octets : new Uint8Array(octets);
	let s = '';
	for (const x of b) s += String.fromCharCode(x);
	return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function depuisB64u(texte: string): Uint8Array<ArrayBuffer> {
	const brut = atob((texte + '='.repeat((4 - (texte.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
	const o = new Uint8Array(new ArrayBuffer(brut.length));
	for (let i = 0; i < brut.length; i++) o[i] = brut.charCodeAt(i);
	return o;
}

function joindre(...parties: Uint8Array[]): Uint8Array<ArrayBuffer> {
	const r = new Uint8Array(new ArrayBuffer(parties.reduce((n, p) => n + p.length, 0)));
	let i = 0;
	for (const p of parties) {
		r.set(p, i);
		i += p.length;
	}
	return r;
}

async function hmac(cle: Uint8Array<ArrayBuffer>, donnees: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
	const k = await crypto.subtle.importKey('raw', cle, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
	return new Uint8Array(await crypto.subtle.sign('HMAC', k, donnees));
}

// HKDF-Expand sur un seul bloc (32 octets au plus), suffisant ici.
const etendre = async (prk: Uint8Array<ArrayBuffer>, info: Uint8Array<ArrayBuffer>, n: number) => (await hmac(prk, joindre(info, new Uint8Array([1])))).slice(0, n);

// Le corps chiffré pour un abonnement, prêt à envoyer.
export async function chiffrer(message: string, p256dh: string, auth: string): Promise<Uint8Array<ArrayBuffer>> {
	const uaPublique = depuisB64u(p256dh);
	const cleUA = await crypto.subtle.importKey('raw', uaPublique, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
	const paire = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair;
	const asPublique = new Uint8Array((await crypto.subtle.exportKey('raw', paire.publicKey)) as ArrayBuffer);
	const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: cleUA }, paire.privateKey, 256));

	const ikm = await etendre(await hmac(depuisB64u(auth), ecdh), joindre(enc.encode('WebPush: info\0'), uaPublique, asPublique), 32);
	const sel = crypto.getRandomValues(new Uint8Array(16));
	const prk = await hmac(sel, ikm);
	const cek = await etendre(prk, enc.encode('Content-Encoding: aes128gcm\0'), 16);
	const nonce = await etendre(prk, enc.encode('Content-Encoding: nonce\0'), 12);

	const cleAes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
	// 0x02 : dernier enregistrement.
	const chiffre = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, cleAes, joindre(enc.encode(message), new Uint8Array([2]))));
	const entete = new Uint8Array(21);
	entete.set(sel, 0);
	new DataView(entete.buffer).setUint32(16, 4096);
	entete[20] = asPublique.length;
	return joindre(entete, asPublique, chiffre);
}

export type ClesVapid = { publique: string; privee: JsonWebKey; contact: string };
export type EnvVapid = { VAPID_PUBLIQUE?: string; VAPID_PRIVEE?: string; COURRIEL_EXPEDITEUR?: string; BETTER_AUTH_URL?: string };

// Les clés du centre (secrets) : le point public brut et `d`, en base64url. Nulles si elles manquent ou sont illisibles,
// ou sans contact (le service push d'Apple refuse un jeton sans lui) : mieux vaut aucun envoi que des envois perdus.
export function clesVapid(env: EnvVapid): ClesVapid | null {
	const contact = env.COURRIEL_EXPEDITEUR ? `mailto:${env.COURRIEL_EXPEDITEUR}` : (env.BETTER_AUTH_URL ?? '');
	if (!env.VAPID_PUBLIQUE || !env.VAPID_PRIVEE || !/^[A-Za-z0-9_-]{43}$/.test(env.VAPID_PRIVEE) || !contact) return null;
	try {
		const point = depuisB64u(env.VAPID_PUBLIQUE);
		if (point.length !== 65 || point[0] !== 4) return null;
		const privee = { kty: 'EC', crv: 'P-256', x: b64u(point.slice(1, 33)), y: b64u(point.slice(33)), d: env.VAPID_PRIVEE };
		return { publique: env.VAPID_PUBLIQUE, privee, contact };
	} catch {
		return null;
	}
}

// Jeton VAPID (JWT ES256) pour un service push, valable 12 h.
export async function jetonVapid(audience: string, cles: ClesVapid, maintenant = Math.floor(Date.now() / 1000)): Promise<string> {
	const tete = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
	const charge = b64u(enc.encode(JSON.stringify({ aud: audience, exp: maintenant + 12 * 3600, sub: cles.contact })));
	const cle = await crypto.subtle.importKey('jwk', cles.privee, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
	const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, cle, enc.encode(`${tete}.${charge}`));
	return `${tete}.${charge}.${b64u(signature)}`;
}

// La requête à envoyer au service push. `jetons` : un jeton par service push, calculé une fois par lot.
// Le sujet (Topic) remplace, chez le service push, une notification pas encore remise de la même conversation ou publication.
// `sujet` faux : sans Topic (un envoi repris ne doit pas remplacer un envoi plus récent).
export async function requetePush(
	abonnement: { endpoint: string; p256dh: string; auth: string },
	donnees: { titre: string; texte: string; url: string; tag: string },
	cles: ClesVapid,
	jetons: Map<string, string>,
	sujet = true
): Promise<{ url: string; init: RequestInit }> {
	if (!abonnement.endpoint.startsWith('https://')) throw new Error('Adresse push invalide');
	const audience = new URL(abonnement.endpoint).origin;
	let jeton = jetons.get(audience);
	if (!jeton) {
		jeton = await jetonVapid(audience, cles);
		jetons.set(audience, jeton);
	}
	const corps = await chiffrer(JSON.stringify(donnees), abonnement.p256dh, abonnement.auth);
	const headers: Record<string, string> = {
		'Content-Encoding': 'aes128gcm',
		'Content-Type': 'application/octet-stream',
		TTL: '86400',
		Urgency: 'normal',
		Authorization: `vapid t=${jeton}, k=${cles.publique}`
	};
	if (sujet) headers.Topic = donnees.tag.replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 32);
	return { url: abonnement.endpoint, init: { method: 'POST', headers, body: corps } };
}
