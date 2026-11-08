<script lang="ts">
	import type { Snippet } from 'svelte';

	let { ton, children }: { ton: 'ok' | 'info' | 'alerte' | 'danger' | 'neutre'; children: Snippet } = $props();
</script>

<span
	class="pastille"
	style:background="var(--statut-{ton}-fond)"
	style:color="var(--statut-{ton}-texte)"
	style:border-color="var(--statut-{ton}-trait)">{@render children()}</span
>

<style>
	.pastille {
		display: inline-block;
		padding: 2px var(--espace-12);
		border: 1px solid;
		border-radius: 999px;
		font-size: var(--texte-14);
		font-weight: 600;
	}
</style>
