<script lang="ts">
	import type { AnomalieListee } from '@gyro-caserne/socle';
	import { dateCourte, texteEcart, texteEtape, tonEtape } from '#lib/engins/textes.ts';
	import { pluriel } from '#lib/pluriel.ts';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';
	import Groupe from '#lib/ui/Groupe.svelte';
	import ListeRangees from '#lib/ui/ListeRangees.svelte';
	import Pastille from '#lib/ui/Pastille.svelte';
	import Rangee from '#lib/ui/Rangee.svelte';
	import Vide from '#lib/ui/Vide.svelte';
	import { DESSINS } from '#lib/ui/icones-roles.ts';

	type Donnees = { ouvertes: AnomalieListee[]; closes: AnomalieListee[]; engins: { id: number; nom: string }[]; peutSignaler: boolean; enginId: number | null };
	let { data }: { data: Donnees } = $props();

	// Les ouvertes, engin par engin (déjà rangées par le socle).
	const parEngin = $derived(
		data.ouvertes.reduce<{ id: number; nom: string; anomalies: AnomalieListee[] }[]>((groupes, a) => {
			const g = groupes.find((x) => x.id === a.enginId);
			if (g) g.anomalies.push(a);
			else groupes.push({ id: a.enginId, nom: a.engin, anomalies: [a] });
			return groupes;
		}, [])
	);
	const filtre = $derived(data.engins.find((e) => e.id === data.enginId));
	const sous = (a: AnomalieListee) => [a.zone, texteEcart({ genre: a.genre, manque: a.manque, note: null }), `signalée le ${dateCourte(a.signaleeLe)}`].filter(Boolean).join(' · ');
	const signaler = $derived(data.enginId ? `/engins/anomalies/signaler?engin=${data.enginId}` : '/engins/anomalies/signaler');
</script>

<svelte:head>
	<title>Anomalies{filtre ? ` · ${filtre.nom}` : ''} · Engins · Gyro Caserne</title>
</svelte:head>

{#snippet ligne(a: AnomalieListee, close: boolean)}
	<li>
		<Rangee href="/engins/anomalies/{a.id}" titre={close ? `${a.engin} · ${a.libelle}` : a.libelle} sous={close ? `Close le ${dateCourte(a.closeLe ?? '')}` : sous(a)} icone="outil" discret={close}>
			{#snippet droite()}
				<span class="pastilles">
					{#if a.bloquante && !close}<Pastille ton="danger">Engin indisponible</Pastille>{/if}
					{#if !close}<Pastille ton={tonEtape(a)}>{texteEtape(a)}</Pastille>{/if}
				</span>
			{/snippet}
		</Rangee>
	</li>
{/snippet}

<div class="page">
	<EnTetePage
		titre="Anomalies"
		phrase={filtre ? `${filtre.nom} : ce qui est signalé et où en est la réparation.` : 'Ce qui est signalé sur les engins, et où en est la réparation.'}
		gyro
		tenue="anomalie"
		retour={filtre ? { href: `/engins/${filtre.id}`, libelle: filtre.nom } : { href: '/engins', libelle: 'Engins' }}
		action={data.peutSignaler ? { href: signaler, libelle: 'Signaler un problème', dessin: DESSINS.plus } : undefined}
	/>

	{#if data.engins.length > 1}
		<nav class="filtres" aria-label="Filtrer par engin">
			<a href="/engins/anomalies" aria-current={data.enginId === null ? 'page' : undefined}>Tous</a>
			{#each data.engins as e (e.id)}<a href="/engins/anomalies?engin={e.id}" aria-current={data.enginId === e.id ? 'page' : undefined}>{e.nom}</a>{/each}
		</nav>
	{/if}

	<div class="colonnes">
		<div class="principal">
			{#if parEngin.length === 0}
				<Vide titre="Aucune anomalie ouverte." texte="Un problème signalé à la prise de garde ou directement apparaît ici, avec son suivi jusqu’à la réparation." action={data.peutSignaler ? { href: signaler, libelle: 'Signaler un problème' } : undefined} />
			{:else}
				{#each parEngin as g (g.id)}
					<ListeRangees titre={g.nom} compte={g.anomalies.length}>
						{#each g.anomalies as a (a.id)}{@render ligne(a, false)}{/each}
					</ListeRangees>
				{/each}
			{/if}
		</div>

		{#if data.closes.length}
			<Groupe titre="Closes récemment" resume={pluriel(data.closes.length, 'anomalie close', 'anomalies closes')}>
				<ul class="liste" role="list">
					{#each data.closes as a (a.id)}{@render ligne(a, true)}{/each}
				</ul>
			</Groupe>
		{/if}
	</div>
</div>

<style>
	.page,
	.colonnes,
	.principal {
		display: flex;
		flex-direction: column;
		gap: 24px;
	}
	.liste {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.pastilles {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 4px;
	}
	.filtres {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.filtres a {
		display: inline-flex;
		align-items: center;
		min-height: var(--cible);
		padding: 0 14px;
		border: 1px solid var(--trait);
		border-radius: 999px;
		color: var(--encre);
		font-weight: 600;
		text-decoration: none;
	}
	.filtres a:hover {
		background: var(--fond);
	}
	.filtres a[aria-current='page'] {
		border-color: var(--encre);
		background: var(--encre);
		color: var(--surface);
	}
	@media (min-width: 1024px) {
		.colonnes {
			display: grid;
			grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
			align-items: start;
			gap: 28px;
		}
	}
</style>
