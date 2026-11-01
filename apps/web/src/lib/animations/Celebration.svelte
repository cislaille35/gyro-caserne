<script lang="ts">
	import { onDestroy, untrack } from 'svelte';
	import Gyro from '../gyro/Gyro.svelte';
	import { lireAffichageContexte } from '../gyro/niveau.ts';
	import { aCelebrer, lireVus, noterVu, type Moment } from './celebration.ts';

	// Un vrai moment, fêté une fois par personne (mémoire du navigateur), fermable, et qui se retire seul.
	// Elle ne bloque rien : le doigt passe au travers, sauf sur « Fermer ».
	// annoncer : faux quand la page dit déjà la nouvelle aux lecteurs d'écran.
	let { moment, qui, annoncer = true }: { moment: Moment | null; qui: string; annoncer?: boolean } = $props();

	const affichage = lireAffichageContexte();
	const DUREE = 6000;
	let fete = $state<Moment | null>(null);
	let focus = false;
	// Déjà montrés sur cette page : utile quand la mémoire du navigateur manque.
	const montres: string[] = [];
	let minuteur: ReturnType<typeof setTimeout> | undefined;

	const confettis = [
		{ x: 8, c: '#f2c200', d: 0 },
		{ x: 20, c: '#e5699a', d: 0.15 },
		{ x: 33, c: '#3d7fd6', d: 0.05 },
		{ x: 46, c: '#3fa34d', d: 0.25 },
		{ x: 58, c: '#f2c200', d: 0.1 },
		{ x: 70, c: '#e5699a', d: 0.3 },
		{ x: 82, c: '#3d7fd6', d: 0.2 },
		{ x: 92, c: '#3fa34d', d: 0.35 }
	];

	const stockage = () => {
		try {
			return window.localStorage;
		} catch {
			return undefined;
		}
	};

	// Seulement dans le navigateur : la page rendue par le serveur ne fête jamais rien.
	$effect(() => {
		const m = moment;
		if (!m || untrack(() => fete)) return;
		const s = stockage();
		const reduit = matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (!aCelebrer(m, [...lireVus(s, qui), ...montres], { niveau: affichage.niveau, reduit })) return;
		noterVu(s, qui, m.cle);
		montres.push(m.cle);
		fete = m;
		retirerPlusTard();
	});

	function retirerPlusTard() {
		clearTimeout(minuteur);
		minuteur = setTimeout(() => {
			if (focus) retirerPlusTard();
			else fete = null;
		}, DUREE);
	}

	function fermer() {
		clearTimeout(minuteur);
		fete = null;
	}

	onDestroy(() => clearTimeout(minuteur));
</script>

<svelte:window onkeydown={(e) => fete && e.key === 'Escape' && fermer()} />

<!-- Annonce discrète, sans rôle « status » : la page garde sa seule zone d'état pour ses formulaires. -->
{#if annoncer}<div class="masque" aria-live="polite">{fete?.texte ?? ''}</div>{/if}
{#if fete}
	<div class="fete" role="presentation" onfocusin={() => (focus = true)} onfocusout={() => (focus = false)}>
		<div class="scene" aria-hidden="true">
			{#each confettis as c, i (i)}
				<span class="confetti" style:left="{c.x}%" style:background={c.c} style:animation-delay="{c.d}s"></span>
			{/each}
			<span class="gyro"><Gyro tenue={fete.tenue} taille={112} decoratif /></span>
		</div>
		<p class="texte">{fete.texte}</p>
		<button type="button" class="fermer" aria-label="Fermer" onclick={fermer}>
			<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" /></svg>
		</button>
	</div>
{/if}

<style>
	.fete {
		position: fixed;
		left: 50%;
		bottom: calc(4.5rem + env(safe-area-inset-bottom));
		z-index: 30;
		width: min(22rem, calc(100vw - 2rem));
		display: grid;
		justify-items: center;
		padding: 0.5rem 1rem 1rem;
		border: 1px solid var(--trait);
		border-radius: var(--rayon-grand);
		background: var(--surface);
		color: var(--encre);
		box-shadow: 0 10px 30px rgb(20 27 36 / 0.25);
		pointer-events: none;
		translate: -50% 0;
		animation: entree 0.4s ease-out both;
	}
	@keyframes entree {
		from {
			opacity: 0;
			transform: translateY(24px);
		}
	}
	.scene {
		position: relative;
		width: 100%;
		height: 112px;
		overflow: hidden;
		display: flex;
		justify-content: center;
		align-items: flex-end;
	}
	.gyro {
		animation: saute 0.45s ease-out 0.3s 2 alternate both;
	}
	@keyframes saute {
		to {
			translate: 0 -10px;
		}
	}
	.confetti {
		position: absolute;
		top: -10px;
		width: 7px;
		height: 10px;
		border-radius: 2px;
		animation: confetti 1.8s ease-in both;
	}
	@keyframes confetti {
		to {
			transform: translateY(120px) rotate(400deg);
			opacity: 0;
		}
	}
	.texte {
		margin: 0.25rem 2rem 0;
		font-family: var(--police-titre);
		font-size: 1.25rem;
		font-weight: 700;
		text-align: center;
		text-wrap: balance;
	}
	.fermer {
		position: absolute;
		top: 0.25rem;
		right: 0.25rem;
		width: var(--cible);
		height: var(--cible);
		display: grid;
		place-items: center;
		border: 0;
		border-radius: 50%;
		background: none;
		color: var(--doux);
		cursor: pointer;
		pointer-events: auto;
	}
	.fermer:hover {
		color: var(--encre);
	}
	@media (min-width: 1024px) {
		.fete {
			left: auto;
			right: 1.5rem;
			bottom: 1.5rem;
			translate: none;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.fete,
		.fete * {
			animation: none !important;
		}
	}
</style>
