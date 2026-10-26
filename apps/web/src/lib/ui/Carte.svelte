<script lang="ts">
	import type { Snippet } from 'svelte';

	let { titre, children }: { titre: string; children: Snippet } = $props();
	const idTitre = $props.id();
</script>

<section aria-labelledby={idTitre}>
	<h2 id={idTitre}>{titre}</h2>
	{@render children()}
</section>

<style>
	section {
		background: var(--surface);
		border: 1px solid var(--trait);
		border-radius: var(--rayon-grand);
		padding: 20px;
	}
	h2 {
		margin: 0 0 12px;
		font: 700 1.5rem var(--police-titre);
	}
</style>
