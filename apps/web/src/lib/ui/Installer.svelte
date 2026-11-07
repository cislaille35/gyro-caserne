<script lang="ts">
	import { onMount } from 'svelte';
	import Bouton from './Bouton.svelte';
	import { appareil, installer } from '#lib/installation.svelte.ts';
	import { choixEncart, choixPage, lirePlusTard, noterPlusTard } from '#lib/installation.ts';

	// L'aide à l'installation : `encart` sur l'accueil (discret, « Plus tard »), `page` dans Moi → Installer l'appli.
	// Rien n'est rendu côté serveur : seul le navigateur sait s'il est déjà installé.
	let { mode }: { mode: 'encart' | 'page' } = $props();

	const id = $props.id();
	let monte = $state(false);
	let plusTard = $state<string | null>(null);
	const stockage = () => {
		try {
			return window.localStorage;
		} catch {
			return null;
		}
	};
	onMount(() => {
		plusTard = lirePlusTard(stockage());
		monte = true;
	});
	const choix = $derived(!monte ? null : mode === 'encart' ? choixEncart(appareil(), plusTard, new Date()) : choixPage(appareil()));

	// L'encart disparaît avec le bouton qui a le focus : le focus va au titre de la page, pas au début du document.
	function focusAuTitre() {
		const titre = document.querySelector<HTMLElement>('main h1, h1');
		if (!titre) return;
		if (!titre.hasAttribute('tabindex')) titre.setAttribute('tabindex', '-1');
		titre.focus();
	}
	function ecarter() {
		const maintenant = new Date();
		noterPlusTard(stockage(), maintenant);
		plusTard = maintenant.toISOString();
		focusAuTitre();
	}
	async function installerIci() {
		await installer();
		if (mode === 'encart') focusAuTitre();
	}

	const PARTAGER = 'M12 3v12 M8 7l4-4 4 4 M8 11H6a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-2';
	const AJOUTER = 'M7 4h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3z M12 8.5v7 M8.5 12h7';
</script>

{#snippet geste(dessin: string)}
	<span class="geste" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d={dessin} /></svg></span>
{/snippet}

{#if mode === 'page' && choix === null}
	<p class="doux">Vérification de cet appareil…</p>
	<noscript><p>Dans le menu du navigateur, choisissez « Installer l’appli » ou « Ajouter à l’écran d’accueil ».</p></noscript>
{:else if choix === 'iphone' || choix === 'bouton' || mode === 'page'}
	<section class="installer" class:encart={mode === 'encart'} aria-labelledby={id}>
		<img src="/icones/icone-192.png" alt="" width="48" height="48" />
		<div class="corps">
			{#if choix === 'iphone'}
				<h2 id={id}>Ajoutez Gyro à votre écran d’accueil</h2>
				<p>Sur iPhone, les notifications et le nombre sur l’icône n’arrivent que si l’appli est installée.</p>
				<ol class="etapes">
					<li>{@render geste(PARTAGER)}<span>Touchez <strong>Partager</strong> dans la barre du navigateur.</span></li>
					<li>{@render geste(AJOUTER)}<span>Choisissez <strong>Sur l’écran d’accueil</strong>, puis <strong>Ajouter</strong>.</span></li>
				</ol>
				{#if mode === 'page'}<p class="doux">Ouvrez ensuite Gyro Caserne depuis son icône, puis activez les notifications dans Moi → Notifications.</p>{/if}
			{:else if choix === 'bouton'}
				<h2 id={id}>Installez Gyro Caserne</h2>
				<p>Elle s’ouvre d’un geste depuis l’écran d’accueil, en plein écran, avec le nombre de notifications sur son icône.</p>
			{:else if choix === 'installee'}
				<h2 id={id}>L’appli est installée</h2>
				<p>Gyro Caserne est sur cet appareil : ouvrez-la depuis son icône.</p>
			{:else}
				<h2 id={id}>Installer depuis le navigateur</h2>
				<p>Dans le menu du navigateur, choisissez <strong>Installer l’appli</strong> ou <strong>Ajouter à l’écran d’accueil</strong>.</p>
			{/if}
			{#if choix === 'bouton' || mode === 'encart'}
				<div class="actions">
					{#if choix === 'bouton'}<Bouton onclick={() => void installerIci()}>Installer Gyro Caserne</Bouton>{/if}
					{#if mode === 'encart'}<Bouton variante="secondaire" onclick={ecarter}>Plus tard</Bouton>{/if}
				</div>
			{/if}
		</div>
	</section>
{/if}

<style>
	.installer {
		display: flex;
		align-items: flex-start;
		gap: 14px;
		padding: 16px;
		border: 1px solid transparent;
		border-radius: var(--rayon-grand);
		background: var(--surface);
		box-shadow: var(--ombre-carte);
	}
	img {
		flex: none;
		border-radius: 12px;
	}
	.corps {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	h2,
	p,
	ol {
		margin: 0;
	}
	h2 {
		font: 700 1.25rem/1.2 var(--police-titre);
	}
	.encart h2 {
		font-size: 1.125rem;
	}
	.etapes {
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.etapes li {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.geste {
		flex: none;
		width: 40px;
		height: 40px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--trait-doux);
		border-radius: var(--rayon-petit);
		background: var(--fond);
		color: var(--encre);
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}
	.doux {
		color: var(--doux);
	}
</style>
