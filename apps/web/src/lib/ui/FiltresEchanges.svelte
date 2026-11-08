<script lang="ts">
	// Les deux vues d'Échanges : les murs du centre et les messages privés.
	let { actif, nonLus }: { actif: 'murs' | 'messages'; nonLus: number } = $props();

	const nonLusEnTexte = $derived(`${nonLus} ${nonLus > 1 ? 'messages non lus' : 'message non lu'}`);
</script>

<nav class="segments filtres" aria-label="Filtrer les échanges">
	<a href="/echanges" aria-current={actif === 'murs' ? 'page' : undefined}>Murs</a>
	<a href="/echanges/messages" aria-current={actif === 'messages' ? 'page' : undefined}
		>Messages{#if nonLus > 0}
			<span class="nombre" aria-hidden="true">{nonLus > 99 ? '99+' : nonLus}</span><span class="masque">, {nonLusEnTexte}</span>{/if}</a
	>
</nav>

<style>
	.nombre {
		min-width: 20px;
		height: 20px;
		padding: 0 var(--espace-6);
		border-radius: var(--rayon-bouton);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: var(--rouge);
		color: var(--sur-rouge);
		font-size: var(--texte-12);
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
