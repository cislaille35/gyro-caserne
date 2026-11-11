<script lang="ts">
	import { dessinDe } from './insignes.ts';

	// L'insigne d'un grade (galons sur un carré noir), d'après son libellé ; rien pour un grade sans insigne connu.
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
		<rect class="patte" x="2" y="2" width="20" height="20" rx="2" />
		{#each dessin as f, i (i)}
			{#if 'points' in f}
				<polygon class="{f.couleur}{f.bord ? ' bord' : ''}" points={f.points} />
			{:else}
				<rect class={f.couleur} x={f.x} y={f.y} width={f.l} height={f.h} />
				{#if f.raie}<rect class="raie" x={f.x} y={f.y + f.h / 2 - 0.7} width={f.l} height="1.4" />{/if}
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
	.rouge,
	.raie {
		fill: var(--insigne-rouge);
	}
	.or {
		fill: var(--insigne-or);
	}
	.argent {
		fill: var(--insigne-argent);
	}
	/* Galon argent bordé de rouge (sergents). */
	.bord {
		stroke: var(--insigne-rouge);
		stroke-width: 0.9;
		stroke-linejoin: round;
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
			stroke: none;
		}
		.raie {
			fill: Canvas;
		}
	}
</style>
