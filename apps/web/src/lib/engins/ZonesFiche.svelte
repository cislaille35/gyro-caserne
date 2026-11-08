<script lang="ts">
	import type { ZoneFiche } from '@gyro-caserne/socle';
	import { pluriel } from '#lib/pluriel.ts';
	import Groupe from '#lib/ui/Groupe.svelte';

	// La fiche en lecture : une zone repliable par zone, ses éléments et leur quantité attendue.
	let { zones }: { zones: ZoneFiche[] } = $props();
</script>

<div class="zones">
	{#each zones as z (z.ref)}
		<Groupe titre={z.nom} resume={pluriel(z.elements.length, 'élément')} niveauTitre={3}>
			{#if z.elements.length === 0}
				<p class="doux">Aucun élément dans cette zone.</p>
			{:else}
				<ul role="list">
					{#each z.elements as e (e.ref)}
						<li>
							<span>{e.libelle}</span>
							{#if e.quantite !== null}<span class="quantite">{e.quantite}<span class="masque">{' '}attendus</span></span>{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</Groupe>
	{/each}
</div>

<style>
	.zones {
		display: flex;
		flex-direction: column;
		gap: var(--espace-12);
	}
	ul {
		margin: 0;
		padding: var(--espace-4) var(--espace-16) var(--espace-8);
		list-style: none;
	}
	li {
		display: flex;
		justify-content: space-between;
		gap: var(--espace-12);
		padding: var(--espace-12) 0;
		overflow-wrap: anywhere;
	}
	li + li {
		border-top: 1px solid var(--trait-doux);
	}
	.quantite {
		flex: none;
		min-width: 2.5em;
		padding: 0 var(--espace-8);
		border: 1px solid var(--trait);
		border-radius: 999px;
		text-align: center;
		font-weight: 700;
	}
	.doux {
		margin: 0;
		padding: var(--espace-12) var(--espace-16);
		color: var(--doux);
	}
	.masque {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}
</style>
