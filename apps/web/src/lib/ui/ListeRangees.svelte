<script lang="ts">
	import type { Snippet } from 'svelte';

	// Un groupe de lignes (les enfants sont des <li>) dans une seule carte, avec son titre au-dessus (h2, ou h3 sous une section) et son compteur, s'il y en a.
	// `ancre` : le titre reçoit cet id et peut prendre le focus par programme.
	let { titre, compte, ancre, niveau = 2, children }: { titre?: string; compte?: number; ancre?: string; niveau?: 2 | 3; children: Snippet } = $props();
	const idAuto = $props.id();
	const idTitre = $derived(ancre ?? idAuto);
</script>

{#snippet liste()}
	<ul role="list" class="lignes">{@render children()}</ul>
{/snippet}

{#if titre}
	<section aria-labelledby={idTitre}>
		<svelte:element this={`h${niveau}`} id={idTitre} class="titre-groupe" tabindex={ancre ? -1 : undefined}>{titre}{#if compte}{' '}<span class="compte">{compte}</span>{/if}</svelte:element>
		{@render liste()}
	</section>
{:else}
	{@render liste()}
{/if}

<style>
	section {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.titre-groupe:focus {
		outline: none;
	}
</style>
