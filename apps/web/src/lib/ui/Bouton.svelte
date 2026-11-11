<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		type = 'button',
		variante = 'principal',
		desactive = false,
		onclick,
		children
	}: { type?: 'button' | 'submit'; variante?: 'principal' | 'secondaire' | 'grave'; desactive?: boolean; onclick?: () => void; children: Snippet } = $props();
</script>

<button {type} class={variante} disabled={desactive} {onclick}>{@render children()}</button>

<style>
	button {
		min-height: var(--cible);
		padding: 0 var(--espace-20);
		border-radius: var(--rayon-bouton);
		font: 700 var(--texte-16) var(--police);
		cursor: pointer;
	}
	/* Un à-plat, sans contour : le bord transparent reste pour le mode contrasté. */
	.principal {
		background: var(--rouge);
		color: var(--sur-rouge);
		border: 1px solid transparent;
	}
	button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
	/* Une action difficile à défaire : un contour et un texte d'alerte, et un libellé sans ambiguïté. */
	.grave {
		background: var(--surface);
		color: var(--accent);
		border: 1px solid var(--accent);
		font-weight: 600;
	}
	.secondaire {
		background: var(--surface);
		color: var(--encre);
		border: 1px solid var(--trait);
		font-weight: 600;
	}
</style>
