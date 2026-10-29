<script lang="ts">
	import type { Snippet } from 'svelte';

	// Une liste de rangées (les enfants sont des <li>), avec une rubrique h2 facultative, son compteur, et un pied sous la liste.
	// `ancre` : le titre reçoit cet id et peut prendre le focus par programme.
	let { titre, compte, ancre, pied, children }: { titre?: string; compte?: number; ancre?: string; pied?: Snippet; children: Snippet } = $props();
	const idAuto = $props.id();
	const idTitre = $derived(ancre ?? idAuto);
</script>

{#snippet liste()}
	<ul role="list">{@render children()}</ul>
{/snippet}

{#if titre}
	<section aria-labelledby={idTitre}>
		<h2 id={idTitre} class="rubrique" tabindex={ancre ? -1 : undefined}>{titre}{#if compte}{' '}<span class="compte">{compte}</span>{/if}</h2>
		{@render liste()}
		{#if pied}{@render pied()}{/if}
	</section>
{:else}
	{@render liste()}
{/if}

<style>
	section {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	h2 {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	h2:focus {
		outline: none;
	}
	ul {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.compte {
		min-width: 24px;
		height: 24px;
		padding: 0 7px;
		border-radius: 12px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: var(--statut-neutre-fond);
		color: var(--encre);
		font: 700 0.8125rem var(--police);
	}
</style>
