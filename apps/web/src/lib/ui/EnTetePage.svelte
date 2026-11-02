<script lang="ts">
	import type { Snippet } from 'svelte';
	import GyroDuMoment from '../gyro/GyroDuMoment.svelte';
	import Retour from './Retour.svelte';
	import { DESSINS } from './icones-roles.ts';
	import { gyroSelonNiveau, lireAffichageContexte } from '../gyro/niveau.ts';

	// En-tête d'écran, comme Échanges : retour « ‹ Moi », titre (h1), phrase, complément sous la phrase, Gyro (selon le niveau) ou une tête sur mesure, action secondaire, action principale (bouton rouge, icône et libellé).
	let {
		titre,
		phrase,
		complement,
		gyro = false,
		tete,
		retour,
		secondaire,
		action
	}: {
		titre: string;
		phrase?: string;
		complement?: Snippet;
		gyro?: boolean;
		tete?: Snippet;
		retour?: { href: string; libelle: string };
		secondaire?: Snippet;
		action?: { href: string; libelle: string; dessin?: string };
	} = $props();

	const affichage = lireAffichageContexte();
	const avecGyro = $derived(gyro && gyroSelonNiveau(affichage.niveau).visible);
</script>

<header class="entete">
	{#if retour}<Retour href={retour.href} libelle={retour.libelle} />{/if}
	<div class="ligne">
		{#if tete}
			<span class="tete">{@render tete()}</span>
		{:else if avecGyro}
			<span class="mascotte"><GyroDuMoment tenue="normal" taille={72} decoratif /></span>
		{/if}
		<div class="titres">
			<h1 tabindex="-1">{titre}</h1>
			{#if phrase}<p class="phrase">{phrase}</p>{/if}
			{#if complement}{@render complement()}{/if}
		</div>
		{#if secondaire || action}
			<div class="actions">
				{#if secondaire}<span class="secondaire">{@render secondaire()}</span>{/if}
				{#if action}
					<a class="action" href={action.href}>
						<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"
							><path d={action.dessin ?? DESSINS.plus} /></svg
						>
						<span class="libelle">{action.libelle}</span>
					</a>
				{/if}
			</div>
		{/if}
	</div>
</header>

<style>
	.entete {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 4px;
	}
	/* Les actions passent sous le titre quand la place manque (téléphone, titre long). */
	.ligne {
		align-self: stretch;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 12px;
	}
	.actions {
		margin-left: auto;
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		align-items: center;
		gap: 8px;
	}
	.tete,
	.mascotte {
		flex: none;
	}
	.mascotte {
		margin: -10px -8px -10px -12px;
	}
	.titres {
		flex: 1 1 11rem;
		min-width: 0;
	}
	h1 {
		margin: 0;
		font: 700 1.875rem/1.1 var(--police-titre);
		overflow-wrap: anywhere;
	}
	h1:focus {
		outline: none;
	}
	.phrase {
		margin: 2px 0 0;
		color: var(--doux);
		font-size: 0.9375rem;
	}
	.secondaire {
		flex: none;
		display: inline-flex;
		gap: 8px;
	}
	.action {
		flex: none;
		min-width: 48px;
		height: 48px;
		border-radius: 999px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 0 18px 0 14px;
		background: var(--rouge);
		color: var(--sur-rouge);
		font-weight: 600;
		text-decoration: none;
		box-shadow: 0 4px 12px color-mix(in srgb, var(--rouge) 30%, transparent);
	}
	.action:hover {
		background: var(--rouge-survol);
		color: var(--sur-rouge);
	}
	/* Le libellé se voit à toutes les tailles : le bouton dit ce qu'il fait. */
	.libelle {
		white-space: nowrap;
	}
</style>
