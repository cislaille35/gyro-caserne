<script lang="ts">
	// Les deux vues d'Échanges : les murs du centre et les messages privés.
	let { actif, nonLus }: { actif: 'murs' | 'messages'; nonLus: number } = $props();

	const nonLusEnTexte = $derived(`${nonLus} ${nonLus > 1 ? 'messages non lus' : 'message non lu'}`);
</script>

<nav class="filtres" aria-label="Filtrer les échanges">
	<a href="/echanges" aria-current={actif === 'murs' ? 'page' : undefined}>Murs</a>
	<a href="/echanges/messages" aria-current={actif === 'messages' ? 'page' : undefined}
		>Messages{#if nonLus > 0}
			<span class="nombre" aria-hidden="true">{nonLus > 99 ? '99+' : nonLus}</span><span class="masque">, {nonLusEnTexte}</span>{/if}</a
	>
</nav>

<style>
	.filtres {
		display: flex;
		gap: 8px;
	}
	a {
		min-height: var(--cible);
		padding: 0 18px;
		border-radius: 999px;
		display: inline-flex;
		align-items: center;
		gap: 8px;
		border: 1px solid var(--trait-doux);
		background: var(--surface);
		color: var(--encre);
		font-weight: 600;
		text-decoration: none;
	}
	a:hover {
		border-color: var(--trait);
		color: var(--encre);
	}
	a[aria-current='page'] {
		border-color: var(--encre);
		background: var(--encre);
		color: var(--surface);
	}
	.nombre {
		min-width: 20px;
		height: 20px;
		padding: 0 6px;
		border-radius: 10px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: var(--rouge);
		color: var(--sur-rouge);
		font-size: 0.75rem;
		font-weight: 700;
		line-height: 1;
	}
	.masque {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
</style>
