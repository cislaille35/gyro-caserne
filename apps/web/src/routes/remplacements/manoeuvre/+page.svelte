<script lang="ts">
	import { momentLong } from '#lib/planning/dates.ts';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';
	import Vide from '#lib/ui/Vide.svelte';

	let { data, form } = $props();
</script>

<svelte:head>
	<title>Échanger une manœuvre · Remplacements · Gyro Caserne</title>
</svelte:head>

<div class="page">
	<EnTetePage titre="Échanger une manœuvre" phrase="Vous allez à sa manœuvre, il va à la vôtre. Il doit accepter ; votre chef d’équipe est prévenu." retour={{ href: '/remplacements', libelle: 'Remplacements' }} />
	<p class="erreur" class:masque={!form?.message} role="alert">{form?.message ?? ''}</p>

	{#if data.miennes.length === 0}
		<Vide titre="Aucune manœuvre à échanger." texte="Seules les manœuvres qui convoquent certaines équipes s’échangent, pas celles de tout le centre." action={{ href: '/planning', libelle: 'Voir le planning' }} />
	{:else if data.collegues.length === 0}
		<Vide titre="Aucun collègue convoqué à une autre manœuvre." texte="Un échange se fait avec un collègue convoqué à une manœuvre où vous ne l’êtes pas." />
	{:else}
		<form method="POST" class="formulaire">
			<fieldset class="carte">
				<legend>Ma manœuvre</legend>
				{#each data.miennes as m, i (m.id)}
					<label class="case"><input type="radio" name="mienne" value={m.id} checked={i === 0} /> « {m.theme} », {momentLong(m.debut)}</label>
				{/each}
			</fieldset>
			<div class="carte">
				<label for="sienne" class="libelle">Contre celle d’un collègue</label>
				<select id="sienne" name="sienne" required>
					<option value="">Choisir</option>
					{#each data.collegues as c (c.id)}
						<optgroup label="{c.prenom} {c.nom}">
							{#each c.manoeuvres as m (m.id)}<option value="{c.id}:{m.id}">{c.prenom} {c.nom} · « {m.theme} », {momentLong(m.debut)}</option>{/each}
						</optgroup>
					{/each}
				</select>
				<label for="mot" class="libelle">Un mot (facultatif)</label>
				<textarea id="mot" name="mot" maxlength="200" rows="2"></textarea>
			</div>
			<button type="submit" class="bouton">Proposer l’échange</button>
		</form>
	{/if}
</div>

<style>
	.page,
	.formulaire {
		display: flex;
		flex-direction: column;
		gap: 16px;
		max-width: 44rem;
	}
	p {
		margin: 0;
	}
	.carte {
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin: 0;
		padding: 14px 16px;
		background: var(--surface);
		border: 1px solid var(--trait-doux);
		border-radius: var(--rayon-grand);
	}
	legend {
		float: left;
		padding: 0;
		font: 700 1.25rem var(--police-titre);
	}
	.case {
		min-height: var(--cible);
		display: flex;
		align-items: center;
		gap: 10px;
		clear: both;
	}
	.case input {
		width: 22px;
		height: 22px;
		flex: none;
		accent-color: var(--encre);
	}
	.libelle {
		font-weight: 600;
	}
	select,
	textarea {
		min-height: var(--cible);
		padding: 8px 12px;
		border: 2px solid var(--doux);
		border-radius: var(--rayon-petit);
		background: var(--surface);
		color: var(--encre);
		font: 400 1rem var(--police);
	}
	.bouton {
		align-self: flex-start;
		min-height: var(--cible);
		padding: 0 18px;
		border: 2px solid var(--encre);
		border-radius: 999px;
		background: var(--rouge);
		color: var(--sur-rouge);
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}
	.erreur {
		padding: 12px 14px;
		border-radius: var(--rayon-grand);
		font-weight: 600;
		background: var(--statut-danger-fond);
		color: var(--statut-danger-texte);
		border: 1px solid var(--statut-danger-trait);
	}
</style>
