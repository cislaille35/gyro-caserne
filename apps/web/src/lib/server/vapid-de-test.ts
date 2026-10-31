import { b64u } from './webpush.ts';

// Une paire VAPID comme celle des secrets : point public brut et `d`, en base64url.
export async function paireVapid() {
	const paire = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
	const publique = b64u((await crypto.subtle.exportKey('raw', paire.publicKey)) as ArrayBuffer);
	const { d } = (await crypto.subtle.exportKey('jwk', paire.privateKey)) as JsonWebKey;
	return { VAPID_PUBLIQUE: publique, VAPID_PRIVEE: d!, paire };
}

