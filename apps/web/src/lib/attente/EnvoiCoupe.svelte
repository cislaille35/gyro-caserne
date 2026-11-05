<script lang="ts">
	import { afterNavigate } from '$app/navigation';

	// Un envoi coupé (voir attente.ts) : le message dit par le service worker, sur tous les écrans, sans toucher à la page ni à la saisie.
	let texte = $state<string | null>(null);
	$effect(() => {
		const sw = navigator.serviceWorker;
		if (!sw) return;
		const recu = (e: MessageEvent) => {
			if (typeof e.data?.coupure === 'string') texte = e.data.coupure;
		};
		sw.addEventListener('message', recu);
		return () => sw.removeEventListener('message', recu);
	});
	afterNavigate(() => (texte = null));
</script>

<div class="zone">
	{#if texte}
		<div class="message" role="alert">
			<p>{texte}</p>
			<button type="button" onclick={() => (texte = null)}>Fermer</button>
		</div>
	{/if}
</div>

<style>
	.zone {
		position: fixed;
		z-index: 30;
		left: 16px;
		right: 16px;
		bottom: calc(88px + env(safe-area-inset-bottom));
		display: flex;
		justify-content: center;
		pointer-events: none;
	}
	.message {
		pointer-events: auto;
		max-width: 32rem;
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 16px;
		border: 1px solid var(--statut-alerte-trait);
		border-radius: var(--rayon-grand);
		background: var(--statut-alerte-fond);
		color: var(--statut-alerte-texte);
		box-shadow: 0 6px 18px color-mix(in srgb, var(--encre) 20%, transparent);
	}
	p {
		margin: 0;
	}
	button {
		flex: none;
		min-height: var(--cible);
		padding: 0 8px;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		font-weight: 600;
		text-decoration: underline;
		cursor: pointer;
	}
	@media (min-width: 1024px) {
		.zone {
			bottom: 24px;
		}
	}
</style>
