<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		type = 'button',
		variante = 'principal',
		children
	}: { type?: 'button' | 'submit'; variante?: 'principal' | 'secondaire'; children: Snippet } = $props();
</script>

<button {type} class={variante}>{@render children()}</button>

<style>
	button {
		min-height: var(--cible);
		padding: 0 20px;
		border-radius: var(--rayon-petit);
		font: 700 1.0625rem var(--police);
		cursor: pointer;
	}
	/* Bordure visible : le rouge seul ne se détache pas du fond sombre. */
	.principal {
		background: var(--rouge);
		color: var(--sur-rouge);
		border: 2px solid var(--encre);
	}
	.secondaire {
		background: transparent;
		color: var(--encre);
		border: 2px solid var(--trait);
		font-weight: 600;
	}
</style>
