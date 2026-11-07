<script lang="ts">
	import type { Snippet } from 'svelte';

	// Un groupe de lignes (les enfants sont des <li>) dans une seule carte, avec son titre h2 au-dessus et son compteur, s'il y en a.
	// `ancre` : le titre reçoit cet id et peut prendre le focus par programme.
	let { titre, compte, ancre, children }: { titre?: string; compte?: number; ancre?: string; children: Snippet } = $props();
	const idAuto = $props.id();
	const idTitre = $derived(ancre ?? idAuto);
</script>

{#snippet liste()}
	<ul role="list" class="lignes">{@render children()}</ul>
{/snippet}

{#if titre}
	<section aria-labelledby={idTitre}>
		{#if ancre}
			<h2 id={idTitre} class="titre-groupe" tabindex="-1">{titre}{#if compte}{' '}<span class="compte">{compte}</span>{/if}</h2>
		{:else}
			<h2 id={idTitre} class="titre-groupe">{titre}{#if compte}{' '}<span class="compte">{compte}</span>{/if}</h2>
		{/if}
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
	h2:focus {
		outline: none;
	}
</style>
