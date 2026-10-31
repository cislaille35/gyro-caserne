// Une paire de clés VAPID neuve pour les notifications d'un centre, à poser en secrets (voir docs/technique/installer-un-centre.md).
// Affichée une fois, jamais écrite sur le disque. Usage : pnpm --filter @gyro-caserne/web cles-vapid
import { b64u } from '../src/lib/server/webpush.ts';

const paire = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
const publique = b64u((await crypto.subtle.exportKey('raw', paire.publicKey)) as ArrayBuffer);
const { d } = (await crypto.subtle.exportKey('jwk', paire.privateKey)) as JsonWebKey;
console.log(`VAPID_PUBLIQUE=${publique}\nVAPID_PRIVEE=${d}`);
