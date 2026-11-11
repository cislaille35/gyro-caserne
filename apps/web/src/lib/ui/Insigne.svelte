<script lang="ts">
	import { dessinDe } from './insignes.ts';

	// L'insigne d'un grade (galons sur une patte sombre), d'après son libellé ; rien pour un grade sans insigne connu.
	// `decoratif` : le grade est écrit à côté, l'insigne est caché aux lecteurs d'écran. Sinon il se lit comme une image
	// nommée par le grade (et son libellé s'affiche au survol).
	let { grade, taille = 20, decoratif = false }: { grade: string | null | undefined; taille?: 20 | 24; decoratif?: boolean } = $props();

	const dessin = $derived(dessinDe(grade));
</script>

{#if dessin && grade}
	<svg
		class="insigne"
		class:t24={taille === 24}
		viewBox="0 0 24 24"
		width={taille}
		height={taille}
		role={decoratif ? undefined : 'img'}
		aria-hidden={decoratif ? 'true' : undefined}
		aria-label={decoratif ? undefined : grade}
		focusable="false"
	>
		{#if !decoratif}<title>{grade}</title>{/if}
		<rect class="patte" x="3" y="1" width="18" height="22" rx="3" />
		{#each dessin as g, i (i)}
			{#if g.forme === 'barre'}
				<rect class={g.couleur} x="5.5" y={g.y} width="13" height={g.h} rx="0.6" />
				{#if g.trait}<rect class="rouge" x="5.5" y={g.y + g.h / 2 - 0.5} width="13" height="1" />{/if}
			{:else}
				<path class="chevron {g.couleur}" d="M5.5 {g.y + 4} L12 {g.y} L18.5 {g.y + 4}" />
			{/if}
		{/each}
	</svg>
{/if}

<style>
	.insigne {
		flex: none;
		display: inline-block;
		vertical-align: middle;
	}
	.patte {
		fill: var(--insigne-fond);
		stroke: var(--insigne-trait);
		stroke-width: 1;
	}
	.rouge {
		fill: var(--insigne-rouge);
		stroke: var(--insigne-rouge);
	}
	.or {
		fill: var(--insigne-or);
		stroke: var(--insigne-or);
	}
	.argent {
		fill: var(--insigne-argent);
		stroke: var(--insigne-argent);
	}
	.chevron {
		fill: none;
		stroke-width: 2;
		stroke-linejoin: round;
		stroke-linecap: round;
	}
	/* Le mode contrasté garde les galons lisibles. */
	@media (forced-colors: active) {
		.patte {
			fill: Canvas;
			stroke: CanvasText;
		}
		.rouge,
		.or,
		.argent {
			fill: CanvasText;
			stroke: CanvasText;
		}
		.chevron {
			fill: none;
		}
	}
</style>
