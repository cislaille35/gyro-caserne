<script lang="ts">
	import type { Astreinte } from '@gyro-caserne/socle';
	import PastilleEquipe from '../ui/PastilleEquipe.svelte';
	import { phraseAstreinte } from './astreinte.ts';

	// La carte astreinte, à la couleur de l'équipe (toujours nommée). Compacte à l'Accueil : la phrase en tête et « Voir le planning ».
	// Les mêmes gestes partout, au téléphone comme à l'ordinateur.
	let { a, maintenant, compacte = false }: { a: Astreinte; maintenant: string; compacte?: boolean } = $props();

	const p = $derived(phraseAstreinte(a, maintenant));
	const rubrique = $derived(!a.mienne ? 'Astreinte de la semaine' : a.enCours ? 'Mon astreinte en cours' : 'Ma prochaine astreinte');
	const AGENDA = 'M4 6h16v14H4z M4 10h16 M8 3v4 M16 3v4 M12 13v5 M9.5 15.5h5';
	const REMPLACER = 'M7 7h11l-3-3 M17 17H6l3 3';
</script>

{#snippet corps()}
	<div class="haut">
		<h2 class="rubrique">{rubrique}</h2>
		<PastilleEquipe nom={a.equipe.nom} couleur={a.equipe.couleur} />
	</div>
	<div class="milieu">
		{#if a.mienne && !a.enCours && p.jours > 1}
			<span class="rebours" aria-hidden="true"><strong>{p.jours}</strong>jours</span>
		{/if}
		<div class="textes">
			<!-- Au Planning, la phrase est déjà dans l'en-tête : la carte donne les dates. -->
			{#if compacte}<p class="titre">{p.titre}</p>{/if}
			<p class="quand" class:titre={!compacte}>{p.quand.charAt(0).toUpperCase() + p.quand.slice(1)}</p>
			{#if p.plage}<p class="plage">{p.plage}</p>{/if}
		</div>
	</div>
{/snippet}

<section class="carte" class:compacte style:--equipe={a.equipe.couleur} aria-label={rubrique}>
	{@render corps()}
	<div class="gestes">
		{#if compacte}
			<a href="/planning"
				>Voir le planning<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6" /></svg></a
			>
		{/if}
		{#if a.mienne}
			<a href="/remplacements/demander?semaine={a.debut.slice(0, 10)}"
				><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d={REMPLACER} /></svg>Me faire remplacer</a
			>
			<a href="/moi/agenda"
				><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d={AGENDA} /></svg>Ajouter à mon agenda</a
			>
		{/if}
	</div>
</section>

<style>
	.carte {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 16px 16px 16px 20px;
		border: 1px solid color-mix(in srgb, var(--equipe) 45%, var(--trait-doux));
		border-left: 8px solid var(--equipe);
		border-radius: var(--rayon-grand);
		background: color-mix(in srgb, var(--equipe) 10%, var(--surface));
		color: var(--encre);
		text-decoration: none;
	}
	p {
		margin: 0;
	}
	.haut {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 4px 12px;
	}
	.rubrique {
		margin: 0;
		font: 700 0.9375rem var(--police);
		letter-spacing: 0.02em;
		text-transform: uppercase;
		color: var(--doux);
	}
	.milieu {
		display: flex;
		align-items: center;
		gap: 14px;
	}
	.rebours {
		flex: none;
		width: 64px;
		height: 64px;
		border-radius: 18px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		background: var(--surface);
		border: 2px solid var(--equipe);
		font-size: 0.75rem;
		color: var(--doux);
	}
	.rebours strong {
		font: 700 1.75rem/1 var(--police-titre);
		color: var(--encre);
	}
	.textes {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.titre {
		font: 700 1.375rem/1.15 var(--police-titre);
	}
	.compacte .titre {
		font-size: 1.25rem;
	}
	.quand {
		font-weight: 600;
		text-wrap: balance;
	}
	.plage {
		color: var(--doux);
	}
	.gestes {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.gestes a {
		min-height: var(--cible);
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 0 16px;
		border: 1px solid var(--trait);
		border-radius: 999px;
		background: var(--surface);
		color: var(--encre);
		font-weight: 600;
		text-decoration: none;
	}
	.gestes a:hover {
		border-color: var(--encre);
	}
</style>
