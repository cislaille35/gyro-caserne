<script lang="ts">
	import type { Astreinte } from '@gyro-caserne/socle';
	import PastilleEquipe from '../ui/PastilleEquipe.svelte';
	import { phraseAstreinte } from './astreinte.ts';

	// La carte astreinte, à la couleur de l'équipe (toujours nommée). À l'Accueil (`compacte`) : la phrase en tête et « Voir le planning ».
	// Au Planning : condensée, pour laisser le calendrier en haut ; la phrase est dans l'en-tête de la page.
	// Les mêmes gestes partout, au téléphone comme à l'ordinateur. `priseOuverte` : la fenêtre de la relève, calculée sur le serveur.
	let { a, maintenant, compacte = false, priseOuverte = false }: { a: Astreinte; maintenant: string; compacte?: boolean; priseOuverte?: boolean } = $props();

	const p = $derived(phraseAstreinte(a, maintenant));
	const rubrique = $derived(!a.mienne ? 'Astreinte de la semaine' : a.enCours ? 'Mon astreinte en cours' : 'Ma prochaine astreinte');
	const prise = $derived(compacte && a.mienne && priseOuverte);
	const PRISE = 'M9 4h6v3H9z M9 5.5H5V21h14V5.5h-4 M9 14l2 2 4-4';
	const AGENDA = 'M4 6h16v14H4z M4 10h16 M8 3v4 M16 3v4 M12 13v5 M9.5 15.5h5';
	const REMPLACER = 'M7 7h11l-3-3 M17 17H6l3 3';
</script>

{#snippet corps()}
	<div class="haut">
		<h2 class="rubrique">{rubrique}</h2>
		<PastilleEquipe nom={a.equipe.nom} couleur={a.equipe.couleur} />
	</div>
	<div class="milieu">
		{#if compacte && a.mienne && !a.enCours && p.jours > 1}
			<span class="rebours" aria-hidden="true"><strong>{p.jours}</strong>jours</span>
		{/if}
		<div class="textes">
			{#if compacte}<p class="titre">{p.titre}</p>{/if}
			<p class="quand">{p.quand.charAt(0).toUpperCase() + p.quand.slice(1)}</p>
			{#if p.plage}<p class="plage">{p.plage}</p>{/if}
		</div>
	</div>
{/snippet}

<section class="carte" class:compacte style:--equipe={a.equipe.couleur} aria-label={rubrique}>
	{@render corps()}
	<div class="gestes">
		{#if prise}
			<a class="prise" href="/engins/prise"
				><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d={PRISE} /></svg>Faire la prise de garde</a
			>
		{/if}
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
		font: 700 1.25rem/1.15 var(--police-titre);
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
	.carte:not(.compacte) {
		gap: 6px;
		padding: 10px 12px 10px 14px;
	}
	.carte:not(.compacte) .gestes a {
		padding: 0 12px;
		font-size: 0.9375rem;
	}
	@media (min-width: 1024px) {
		.carte:not(.compacte) {
			flex-flow: row wrap;
			align-items: center;
			justify-content: space-between;
			gap: 8px 20px;
		}
		.carte:not(.compacte) .haut {
			justify-content: flex-start;
		}
	}
	/* Le geste du moment, à la relève. */
	.gestes .prise {
		border-color: var(--encre);
		background: var(--encre);
		color: var(--surface);
	}
</style>
