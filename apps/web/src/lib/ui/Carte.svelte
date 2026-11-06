<script lang="ts">
	import type { Snippet } from 'svelte';

	// `ancre` : le titre reçoit cet id et peut prendre le focus par programme.
	let { titre, ancre, children }: { titre: string; ancre?: string; children: Snippet } = $props();
	const idAuto = $props.id();
	const idTitre = $derived(ancre ?? idAuto);
</script>

<section aria-labelledby={idTitre}>
	{#if ancre}<h2 id={idTitre} tabindex="-1">{titre}</h2>{:else}<h2 id={idTitre}>{titre}</h2>{/if}
	{@render children()}
</section>

<style>
	section {
		background: var(--surface);
		border: 1px solid transparent;
		box-shadow: var(--ombre-carte);
		border-radius: var(--rayon-grand);
		padding: 20px;
	}
	h2 {
		margin: 0 0 12px;
		font: 700 1.5rem var(--police-titre);
	}
</style>
