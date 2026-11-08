<script lang="ts">
	import type { Casquette } from '@gyro-caserne/socle';

	// Une casquette par rôle tenu ; chacune est un lien (?casquette=…), la page se charge côté serveur.
	let { casquettes, choisie }: { casquettes: Casquette[]; choisie: string } = $props();
</script>

<nav aria-label="Casquettes">
	<ul role="list" class="segments">
		{#each casquettes as c (c.id)}
			<li>
				<a
					href="?casquette={encodeURIComponent(c.id)}"
					aria-current={c.id === choisie ? 'true' : undefined}
					aria-label={c.compte > 0 ? `${c.nom}, ${c.compte} en attente` : undefined}
					data-sveltekit-reset="false"
					data-sveltekit-replacestate
				>
					<span>{c.nom}</span>
					{#if c.compte > 0}<span class="compte" aria-hidden="true">{c.compte}</span>{/if}
				</a>
			</li>
		{/each}
	</ul>
</nav>

<style>
	.compte {
		min-width: 22px;
		height: 22px;
		padding: 0 var(--espace-6);
		border-radius: var(--rayon-bouton);
		background: var(--rouge);
		color: var(--sur-rouge);
		font-size: var(--texte-14);
		font-weight: 700;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}
</style>
