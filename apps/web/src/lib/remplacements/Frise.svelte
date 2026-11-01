<script lang="ts">
	import type { Pas } from './textes.ts';

	// La frise d'état d'une demande : chaque pas écrit, son état dit en texte (pas seulement la couleur ou la forme).
	let { pas }: { pas: Pas[] } = $props();
	const ETATS = { fait: 'fait', 'en-cours': 'en cours', 'a-venir': 'à venir', arret: 'fin' } as const;
</script>

<ol class="frise" role="list" aria-label="Où en est la demande">
	{#each pas as p, i (i)}
		<li class={p.etat} aria-current={p.etat === 'en-cours' ? 'step' : undefined}>
			<span class="point" aria-hidden="true">{p.etat === 'fait' ? '✓' : p.etat === 'arret' ? '×' : ''}</span>
			<span class="libelle">{p.libelle}<span class="masque">{` : ${ETATS[p.etat]}`}</span></span>
		</li>
	{/each}
</ol>

<style>
	.frise {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
	}
	li {
		position: relative;
		display: flex;
		align-items: flex-start;
		gap: 12px;
		padding-bottom: 14px;
	}
	li:last-child {
		padding-bottom: 0;
	}
	/* Le trait qui relie les pas. */
	li:not(:last-child)::before {
		content: '';
		position: absolute;
		left: 13px;
		top: 28px;
		bottom: 0;
		width: 2px;
		background: var(--trait);
	}
	.point {
		flex: none;
		width: 28px;
		height: 28px;
		border-radius: 50%;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: 2px solid var(--trait);
		background: var(--surface);
		font-weight: 700;
		font-size: 0.875rem;
	}
	.libelle {
		padding-top: 2px;
		color: var(--doux);
	}
	.fait .point {
		border-color: var(--statut-ok-texte);
		background: var(--statut-ok-fond);
		color: var(--statut-ok-texte);
	}
	.fait .libelle,
	.en-cours .libelle,
	.arret .libelle {
		color: var(--encre);
		font-weight: 600;
	}
	.en-cours .point {
		border: 3px solid var(--rouge);
	}
	.en-cours .libelle {
		font-weight: 700;
	}
	.arret .point {
		border-color: var(--statut-danger-texte);
		background: var(--statut-danger-fond);
		color: var(--statut-danger-texte);
	}
	@media (min-width: 640px) {
		.frise {
			flex-direction: row;
		}
		li {
			flex: 1;
			flex-direction: column;
			gap: 6px;
			padding: 0 8px 0 0;
		}
		li:not(:last-child)::before {
			left: 32px;
			right: 4px;
			top: 13px;
			bottom: auto;
			width: auto;
			height: 2px;
		}
	}
</style>
