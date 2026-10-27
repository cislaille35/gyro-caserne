<script lang="ts">
	import type { Casquette } from '@gyro-caserne/socle';
	import IconeRole from './IconeRole.svelte';

	// Une casquette par rôle tenu ; chacune est un lien (?casquette=…), la page se charge côté serveur.
	let { casquettes, choisie }: { casquettes: Casquette[]; choisie: string } = $props();

	// Flèches, Début et Fin passent d'une casquette à l'autre ; Entrée l'ouvre.
	function clavier(e: KeyboardEvent) {
		const onglets = [...(e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('[role="tab"]')];
		const i = onglets.indexOf(document.activeElement as HTMLElement);
		const cible = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: onglets.length - 1 }[e.key];
		if (cible === undefined || i < 0) return;
		e.preventDefault();
		onglets[(cible + onglets.length) % onglets.length]!.focus();
	}
</script>

<div class="rangee" role="tablist" aria-label="Casquettes" tabindex="-1" onkeydown={clavier}>
	{#each casquettes as c (c.id)}
		<a
			role="tab"
			href="?casquette={encodeURIComponent(c.id)}"
			aria-selected={c.id === choisie}
			aria-label={c.compte > 0 ? `${c.nom}, ${c.compte} en attente` : undefined}
			aria-controls={c.id === choisie ? 'contenu-casquette' : undefined}
			id="casquette-{c.id}"
			tabindex={c.id === choisie ? 0 : -1}
			data-sveltekit-noscroll
			data-sveltekit-replacestate
		>
			<IconeRole icone={c.icone} taille={28} />
			<span>{c.nom}</span>
			{#if c.compte > 0}<span class="compte" aria-hidden="true">{c.compte}</span>{/if}
		</a>
	{/each}
</div>

<style>
	.rangee {
		display: flex;
		gap: 8px;
		overflow-x: auto;
		padding: 4px;
		margin: -4px;
	}
	a {
		flex: none;
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
	a[aria-selected='true'] {
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
