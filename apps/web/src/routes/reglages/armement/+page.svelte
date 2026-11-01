<script lang="ts">
	import { enhance } from '$app/forms';
	import { LIBELLES_NIVEAU, LIBELLES_POSTE, NIVEAUX, POSTES } from '@gyro-caserne/socle';
	import Bouton from '#lib/ui/Bouton.svelte';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';

	let { data, form } = $props();
	const r = $derived(data.armement);
	const LIBELLES_POSTES = { ...LIBELLES_POSTE, cod1: 'Conducteur (COD1 au moins)', ce: 'Chef d’équipe (CE)', agent: 'Agent' };
</script>

<svelte:head>
	<title>Armement des engins · Réglages · Gyro Caserne</title>
</svelte:head>

<div class="page">
	<EnTetePage titre="Armement des engins" phrase="L’équipage de chaque engin, poste par poste ; une personne tient un seul poste, et un agent plus qualifié peut tenir un poste en dessous. Le planning d’été vise le FPT : s’il est armé, les autres le sont." />

	<div role="status" class="masque">{form?.succes ?? ''}</div>
	{#if form?.succes}<p class="succes">{form.succes}</p>{/if}
	{#if form?.message}<p class="echec" role="alert">{form.message}</p>{/if}

	<form method="POST" action="?/enregistrer" use:enhance={() => async ({ update }) => update({ reset: false })}>
		{#each r.engins as e (e.nom)}
			<fieldset class="carte">
				<legend>{e.nom}{e.nom === 'FPT' ? ' · calculé pour l’été' : ''}</legend>
				<div class="postes">
					{#each POSTES as p (p)}
						<label class="nombre">
							<span>{LIBELLES_POSTES[p]}</span>
							<input type="number" name="{e.nom}-{p}" min="0" max="8" inputmode="numeric" value={e.postes[p]} aria-label="{e.nom} : {LIBELLES_POSTES[p]}" />
						</label>
					{/each}
				</div>
			</fieldset>
		{/each}

		<fieldset class="carte">
			<legend>Aptitudes du centre</legend>
			<p class="doux">Quelle aptitude donne chaque niveau. Un CA tout engins tient aussi les postes CA 1 agrès et CE ; un CA 1 agrès, le poste CE ; un COD2, le poste de conducteur COD1.</p>
			<div class="niveaux">
				{#each NIVEAUX as n (n)}
					<label class="choix">
						<span>{LIBELLES_NIVEAU[n]}</span>
						<select name="niveau-{n}">
							<option value="" selected={r.niveaux[n] === null}>Aucune</option>
							{#each data.aptitudes as a (a.id)}<option value={a.id} selected={r.niveaux[n] === a.id}>{a.nom}</option>{/each}
						</select>
					</label>
				{/each}
			</div>
		</fieldset>

		<div class="gestes"><Bouton type="submit">Enregistrer</Bouton></div>
	</form>
</div>

<style>
	.page,
	form {
		display: flex;
		flex-direction: column;
		gap: 16px;
		max-width: 44rem;
	}
	p {
		margin: 0;
	}
	.carte {
		margin: 0;
		padding: 14px 16px 16px;
		background: var(--surface);
		border: 1px solid var(--trait-doux);
		border-radius: var(--rayon-grand);
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	legend {
		padding: 0 6px;
		font: 700 1.25rem var(--police-titre);
	}
	.doux {
		color: var(--doux);
	}
	.postes,
	.niveaux {
		display: grid;
		grid-template-columns: 1fr;
		gap: 8px;
	}
	.nombre,
	.choix {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		min-height: var(--cible);
		font-weight: 600;
	}
	input,
	select {
		min-height: var(--cible);
		font: inherit;
		color: var(--texte);
		background: var(--fond);
		border: 1px solid var(--trait);
		border-radius: var(--rayon-petit);
		padding: 0 10px;
	}
	input {
		width: 5rem;
		text-align: center;
	}
	select {
		min-width: 8rem;
	}
	.succes {
		padding: 12px 16px;
		border-radius: var(--rayon-petit);
		background: var(--statut-ok-fond);
		color: var(--statut-ok-texte);
		border: 1px solid var(--statut-ok-trait);
		font-weight: 600;
	}
	.echec {
		padding: 10px 14px;
		border-radius: var(--rayon-petit);
		border: 2px solid var(--accent);
		font-weight: 600;
	}
	.masque {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}
	@media (min-width: 720px) {
		.postes,
		.niveaux {
			grid-template-columns: 1fr 1fr;
			column-gap: 24px;
		}
	}
</style>
