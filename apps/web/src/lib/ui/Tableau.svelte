<script lang="ts">
	import type { Snippet } from 'svelte';

	let { legende, children }: { legende: string; children: Snippet } = $props();
</script>

<!-- La boîte défile et se laisse atteindre au clavier. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div class="boite" tabindex="0" role="region" aria-label={legende}>
	<table>
		<caption>{legende}</caption>
		{@render children()}
	</table>
</div>

<style>
	.boite {
		overflow-x: auto;
		background: var(--surface);
		border: 1px solid var(--trait);
		border-radius: var(--rayon-grand);
	}
	table {
		width: 100%;
		min-width: 760px;
		border-collapse: collapse;
	}
	caption {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}
	table :global(th),
	table :global(td) {
		padding: var(--espace-12) var(--espace-16);
		text-align: left;
		border-bottom: 1px solid var(--trait);
	}
	table :global(thead th) {
		border-bottom-width: 2px;
	}
</style>
