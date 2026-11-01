<script lang="ts">
	import type { Casquette } from '@gyro-caserne/socle';
	import IconeRole from './IconeRole.svelte';

	// Une casquette par rôle tenu ; chacune est un lien (?casquette=…), la page se charge côté serveur.
	let { casquettes, choisie }: { casquettes: Casquette[]; choisie: string } = $props();
</script>

<nav aria-label="Casquettes">
	<ul role="list">
		{#each casquettes as c (c.id)}
			<li>
				<a
					href="?casquette={encodeURIComponent(c.id)}"
					aria-current={c.id === choisie ? 'true' : undefined}
					aria-label={c.compte > 0 ? `${c.nom}, ${c.compte} en attente` : undefined}
					data-sveltekit-reset="false"
					data-sveltekit-replacestate
				>
					<IconeRole icone={c.icone} taille={28} />
					<span>{c.nom}</span>
					{#if c.compte > 0}<span class="compte" aria-hidden="true">{c.compte}</span>{/if}
				</a>
			</li>
		{/each}
	</ul>
</nav>

<style>
	ul {
		display: flex;
		gap: 8px;
		overflow-x: auto;
		list-style: none;
		padding: 4px;
		margin: -4px;
	}
	li {
		flex: none;
	}
	a {
		min-height: var(--cible);
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 0 14px 0 8px;
		border: 1px solid var(--trait-doux);
		border-radius: 999px;
		background: var(--surface);
		color: var(--encre);
		font-weight: 500;
		text-decoration: none;
	}
	/* La choisie : contour épais et texte gras, pas seulement une couleur. */
	a[aria-current='true'] {
		border: 2px solid var(--encre);
		font-weight: 700;
	}
	a:hover span:not(.compte) {
		text-decoration: underline;
	}
	.compte {
		min-width: 22px;
		height: 22px;
		padding: 0 6px;
		border-radius: 11px;
		background: var(--rouge);
		color: var(--sur-rouge);
		font-size: 0.8125rem;
		font-weight: 700;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}
</style>
