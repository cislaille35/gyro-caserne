// Avant les tests : base locale neuve avec les personnes fictives, serveur de développement,
// puis connexion de test@exemple.fr (agent) et du super administrateur fictif, gardées pour les tests « connecté ».
import { chromium, type FullConfig } from '@playwright/test';
import { execSync, spawn } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { connecter, JOURNAL } from './connexion.ts';

const appli = fileURLToPath(new URL('..', import.meta.url));
const centre = fileURLToPath(new URL('../../../centres/exemple/', import.meta.url));

// Les liens de connexion ne marchent qu'à l'adresse BETTER_AUTH_URL : le serveur de test s'y lance.
// Sans secrets de développement (CI), ils sont créés plus bas avec le port 5174.
function adresse(): string {
	const fichier = `${centre}.dev.vars`;
	if (!existsSync(fichier)) return 'http://localhost:5174';
	const url = readFileSync(fichier, 'utf8').match(/^BETTER_AUTH_URL=(.+)$/m)?.[1];
	if (!url) throw new Error(`BETTER_AUTH_URL manquant dans ${fichier}`);
	return new URL(url.trim()).origin;
}

export const ADRESSE = adresse();
export const ETAT_CONNECTE = fileURLToPath(new URL('../test-results/connecte.json', import.meta.url));
export const SUPER = 'admin@exemple.fr';
export const ETAT_SUPER = fileURLToPath(new URL('../test-results/super.json', import.meta.url));

// En CI, pas de secrets de développement : on en crée de faux, jamais de vrais.
function secretsDeTest() {
	const fichier = `${centre}.dev.vars`;
	if (existsSync(fichier)) return;
	const modele = readFileSync(fileURLToPath(new URL('../.dev.vars.exemple', import.meta.url)), 'utf8');
	writeFileSync(
		fichier,
		modele
			.replace('BETTER_AUTH_SECRET=a-remplacer', 'BETTER_AUTH_SECRET=secret-de-test-uniquement-pour-playwright')
			.replace('BETTER_AUTH_URL=http://localhost:5173', `BETTER_AUTH_URL=${ADRESSE}`)
	);
}

async function attendre(url: string) {
	const limite = Date.now() + 180_000;
	while (Date.now() < limite) {
		try {
			if ((await fetch(url)).ok) return;
		} catch {
			// Serveur pas encore prêt
		}
		await new Promise((r) => setTimeout(r, 1000));
	}
	throw new Error(`Serveur muet sur ${url}, voir ${JOURNAL}`);
}

function verifierSecrets() {
	const fichier = `${centre}.dev.vars`;
	const texte = readFileSync(fichier, 'utf8');
	if (/^BREVO_CLE=\S/m.test(texte))
		throw new Error(`BREVO_CLE est renseignée dans ${fichier} : les tests locaux enverraient de vrais e-mails. Videz cette ligne avant de lancer les tests.`);
	if (!texte.match(/^SUPER_ADMINS=(.*)$/m)?.[1]!.split(',').map((a) => a.trim()).includes(SUPER))
		throw new Error(`SUPER_ADMINS doit contenir ${SUPER} dans ${fichier} pour les tests de gestion.`);
}

export default async function preparer(config: FullConfig) {
	secretsDeTest();
	verifierSecrets();
	rmSync(`${centre}.wrangler`, { recursive: true, force: true });
	execSync('pnpm base-locale && pnpm jeu-de-depart', { cwd: appli, stdio: 'inherit', env: { ...process.env, CI: '1' } });

	mkdirSync(fileURLToPath(new URL('../test-results', import.meta.url)), { recursive: true });
	const journal = createWriteStream(JOURNAL);
	const serveur = spawn('pnpm', ['dev', '--port', new URL(ADRESSE).port, '--strictPort'], { cwd: appli, detached: true });
	serveur.stdout.pipe(journal);
	serveur.stderr.pipe(journal);
	const arreter = () => process.kill(-serveur.pid!, 'SIGTERM');

	try {
		await attendre(`${ADRESSE}/connexion`);
		const navigateur = await chromium.launch(config.projects[0]!.use.launchOptions);
		const page = await navigateur.newPage({ baseURL: ADRESSE });
		await connecter(page, 'test@exemple.fr');
		// Premier passage sur chaque page : Vite prépare ses fichiers une fois pour toutes.
		for (const chemin of ['/affichage', '/agents', '/profil']) await page.goto(chemin);
		await page.context().storageState({ path: ETAT_CONNECTE });

		const pageSuper = await navigateur.newPage({ baseURL: ADRESSE });
		await connecter(pageSuper, SUPER);
		await pageSuper.goto('/agents/nouveau');
		await pageSuper.context().storageState({ path: ETAT_SUPER });
		await navigateur.close();
	} catch (erreur) {
		arreter();
		throw erreur;
	}
	return arreter;
}
