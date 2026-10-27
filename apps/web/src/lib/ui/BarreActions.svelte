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
		padding: 12px 16px 16px;
		background: var(--surface);
		border-top: 1px solid var(--trait-doux);
	}
	.message {
		margin: 0;
		font-size: 0.875rem;
		color: var(--statut-alerte-texte);
	}
	.message:not(:empty) {
		margin-bottom: 8px;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
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
