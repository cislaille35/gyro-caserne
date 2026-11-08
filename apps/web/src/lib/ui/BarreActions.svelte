<script lang="ts">
	import type { Snippet } from 'svelte';

	let { message, children }: { message?: string; children: Snippet } = $props();
</script>

<div class="barre">
	<!-- La zone existe toujours, pour que le message qui s'y insère soit lu. -->
	<p class="message" role="status">{message ?? ''}</p>
	<div class="actions">{@render children()}</div>
</div>

<style>
	.barre {
		position: sticky;
		/* Au téléphone, juste au-dessus de la navigation du bas. */
		bottom: calc(3.5rem + env(safe-area-inset-bottom));
		z-index: 5;
		margin: 0 -1rem;
		padding: var(--espace-12) var(--espace-16) var(--espace-16);
		background: var(--surface);
		border-top: 1px solid var(--trait-doux);
	}
	.message {
		margin: 0;
		font-size: var(--texte-14);
		color: var(--statut-alerte-texte);
	}
	.message:not(:empty) {
		margin-bottom: var(--espace-8);
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--espace-12);
	}
	@media (min-width: 1024px) {
		.barre {
			bottom: 0;
			margin: 0;
			border: 1px solid var(--trait-doux);
			border-radius: var(--rayon-grand) var(--rayon-grand) 0 0;
		}
	}
</style>
