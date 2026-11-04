import { describe, expect, it } from 'vitest';
import { DELAIS_ATTENTE, estCoupure, genreDeRequete, pageAttente, prochainEssai, reponseAction } from './attente.ts';

// Ce que renvoie vraiment Cloudflare (relevé le 4 novembre 2026 sur un Worker jetable) : 503, text/plain, 17 octets.
const VRAIE_REPONSE = 'error code: 1102\n';

describe('estCoupure', () => {
	it('reconnaît la vraie réponse 1102', () => {
		expect(estCoupure(503, VRAIE_REPONSE)).toBe(true);
	});

	it('reconnaît la page habillée de Cloudflare', () => {
		expect(estCoupure(503, '<h1>Error <span class="cf-error-code">1102</span></h1>')).toBe(true);
		expect(estCoupure(503, '<title>Worker exceeded resource limits</title>')).toBe(true);
	});

	it('ne confond jamais avec une erreur de l’appli', () => {
		expect(estCoupure(503, 'Service Unavailable')).toBe(false);
		expect(estCoupure(503, '<p>Fiche de l’agent 1102</p>')).toBe(false);
		expect(estCoupure(404, VRAIE_REPONSE)).toBe(false);
		expect(estCoupure(403, VRAIE_REPONSE)).toBe(false);
		expect(estCoupure(500, VRAIE_REPONSE)).toBe(false);
		expect(estCoupure(200, VRAIE_REPONSE)).toBe(false);
	});
});

describe('genreDeRequete', () => {
	const requete = (url: string, o: { method?: string; mode?: string; action?: boolean } = {}) => ({
		url,
		method: o.method ?? 'GET',
		mode: o.mode ?? 'cors',
		headers: new Headers(o.action ? { 'x-sveltekit-action': 'true' } : {})
	});
	const origine = 'https://gyro.test';

	it('distingue page, formulaire et action', () => {
		expect(genreDeRequete(requete(`${origine}/planning`, { mode: 'navigate' }), origine)).toBe('page');
		expect(genreDeRequete(requete(`${origine}/connexion`, { mode: 'navigate', method: 'POST' }), origine)).toBe('formulaire');
		expect(genreDeRequete(requete(`${origine}/planning?/ajouter`, { method: 'POST', action: true }), origine)).toBe('action');
	});

	it('laisse passer tout le reste : rien n’est intercepté ni mis en cache', () => {
		expect(genreDeRequete(requete(`${origine}/_app/immutable/a.js`), origine)).toBeNull();
		expect(genreDeRequete(requete(`${origine}/moi/notifications/abonnement`, { method: 'POST' }), origine)).toBeNull();
		expect(genreDeRequete(requete(`${origine}/planning/__data.json`), origine)).toBeNull();
		expect(genreDeRequete(requete('https://ailleurs.test/x', { method: 'POST', action: true }), origine)).toBeNull();
	});
});

describe('prochainEssai', () => {
	const T = 1_000_000;

	it('réessaie à 5, 10 puis 20 secondes, puis s’arrête', () => {
		expect(DELAIS_ATTENTE).toEqual([5, 10, 20]);
		let etat = prochainEssai(null, T, DELAIS_ATTENTE);
		expect(etat.delai).toBe(5);
		etat = prochainEssai(etat.etat, T + 5_000, DELAIS_ATTENTE);
		expect(etat.delai).toBe(10);
		etat = prochainEssai(etat.etat, T + 15_000, DELAIS_ATTENTE);
		expect(etat.delai).toBe(20);
		etat = prochainEssai(etat.etat, T + 35_000, DELAIS_ATTENTE);
		expect(etat.delai).toBeNull();
	});

	it('une ancienne coupure sur cette page est oubliée : on repart de 5 secondes', () => {
		const fini = prochainEssai({ essai: 3, le: T }, T + 1_000, DELAIS_ATTENTE);
		expect(fini.delai).toBeNull();
		expect(prochainEssai(fini.etat, T + 10 * 60_000, DELAIS_ATTENTE).delai).toBe(5);
	});
});

describe('pageAttente', () => {
	it('page autonome : tout est dans le texte, rien n’est demandé au serveur', () => {
		const html = pageAttente('page');
		expect(html).toContain('lang="fr"');
		expect(html).toContain('Un instant, ça arrive…');
		expect(html).toContain('aria-live="polite"');
		expect(html).toContain('prefers-reduced-motion');
		expect(html).toContain('prefers-color-scheme: dark');
		expect(html).not.toMatch(/(src|href)="\/|url\(\/|https?:\/\/(?!www\.w3\.org)/);
	});

	it('le script tient dans la page et applique le calcul testé', () => {
		const script = pageAttente('page').match(/<script>([\s\S]*)<\/script>/)![1]!;
		expect(script).toContain('[5,10,20]');
		expect(() => new Function(script)).not.toThrow();
	});

	it('après un formulaire : aucun nouvel essai, retour au formulaire', () => {
		const html = pageAttente('formulaire');
		expect(html).toContain('Votre envoi');
		expect(html).toContain('history.back()');
		expect(html).not.toContain('location.reload');
		expect(html).not.toContain('setTimeout');
	});
});

describe('réponses de repli', () => {
	it('un envoi : un refus lisible par `enhance`, la page et la saisie restent', () => {
		const corps = JSON.parse(reponseAction());
		expect(corps.type).toBe('failure');
		expect(corps.status).toBe(503);
		// Le format de SvelteKit : un tableau où 1 renvoie à la case d'indice 1.
		const [objet, texte] = JSON.parse(corps.data);
		expect(objet).toEqual({ coupure: 1 });
		expect(texte).toContain('n’est peut-être pas passé');
	});
});
