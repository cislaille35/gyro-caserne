<script lang="ts">
	import EnTetePage from '#lib/ui/EnTetePage.svelte';
	import Rangee from '#lib/ui/Rangee.svelte';
	import ListeReglages from './ListeReglages.svelte';

	let { data } = $props();

	const PHOTO = 'M4 7h3l2-3h6l2 3h3v12H4z M12 10a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z';

	// En millions d'octets, comme la limite de la base (500 Mo).
	const MO = 1000 * 1000;
	// Sous 10 Mo, une décimale (« 2,3 Mo ») ; au-delà, des Mo entiers.
	const enMo = (octets: number) => (octets < 10 * MO ? (octets / MO).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) : String(Math.round(octets / MO)));
</script>

<svelte:head>
	<title>Réglages du centre · Gyro Caserne</title>
</svelte:head>

<div class="page">
	<EnTetePage titre="Réglages du centre" phrase="Les rôles par thème, les comités et les profils." action={data.responsabilites ? { href: '/reglages/roles/nouveau', libelle: 'Nouveau rôle' } : undefined}>
		{#snippet secondaire()}
			{#if data.comites}
				<a class="secondaire" href="/reglages/comites/nouveau" aria-label="Nouveau comité"
					><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg>Comité</a
				>
			{/if}
		{/snippet}
	</EnTetePage>

	{#if data.photos}
		{@const part = Math.min(100, Math.round((data.photos.octets / data.photos.limite) * 100))}
		<ul class="jauge" role="list">
			<li>
				<Rangee icone="camion" dessin={PHOTO} titre="Photos" sous={`${enMo(data.photos.octets)} Mo sur ${enMo(data.photos.limite)} Mo${data.photos.alerte ? '. La base des photos est presque pleine : il faudra choisir entre l’offre payante (5 $/mois) ou un stockage R2.' : ''}`} alerte={data.photos.alerte}>
					{#snippet droite()}
						<span class="mesure">
							<span class="barre" aria-hidden="true"><span style:width="{part}%"></span></span>
							<span>{part} %</span>
						</span>
					{/snippet}
				</Rangee>
			</li>
		</ul>
	{/if}
	<ListeReglages {data} />
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 20px;
		max-width: 44rem;
	}
	.jauge {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.mesure {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		color: inherit;
		font-weight: 600;
		font-size: 0.9375rem;
		white-space: nowrap;
	}
	.barre {
		width: 64px;
		height: 8px;
		border-radius: 4px;
		background: var(--statut-neutre-fond);
		overflow: hidden;
	}
	.barre span {
		display: block;
		height: 100%;
		background: currentColor;
	}
	.secondaire {
		min-height: 48px;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 0 16px 0 12px;
		border: 1px solid var(--trait);
		border-radius: 999px;
		background: var(--surface);
		color: var(--encre);
		font-weight: 600;
		text-decoration: none;
	}
	.secondaire:hover {
		border-color: var(--encre);
	}
</style>
