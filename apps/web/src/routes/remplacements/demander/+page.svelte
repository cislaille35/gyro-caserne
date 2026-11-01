<script lang="ts">
	import { texteDemande, texteTranche } from '@gyro-caserne/socle';
	import { duAu, finDeSemaine } from '#lib/planning/dates.ts';
	import { blocs, majuscule } from '#lib/remplacements/textes.ts';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';
	import Vide from '#lib/ui/Vide.svelte';

	let { data, form } = $props();
	const echange = $derived(data.mode === 'echange');
	const nom = (q: { prenom: string; nom: string }) => `${q.prenom} ${q.nom}`;
	let pour = $state('tous');
</script>

<svelte:head>
	<title>{echange ? 'Échanger' : 'Me faire remplacer'} · Remplacements · Gyro Caserne</title>
</svelte:head>

{#snippet semaines(liste: typeof data.semaines, nomChamp: string, aQui: string)}
	{#each liste as s (s.semaine)}
		<fieldset class="semaine" id="{nomChamp}-{s.semaine}">
			<legend>{aQui} semaine du {duAu(s.semaine, finDeSemaine(s.semaine))}</legend>
			{#each blocs(s.tranches) as b (b.debut)}
				<label class="case bloc"><input type="checkbox" name="{nomChamp}-bloc" value="{b.debut}|{b.fin}" /> Tout : {texteDemande([b])}</label>
			{/each}
			{#each s.tranches as t (t.debut)}
				<label class="case" class:prise={t.prise}>
					<input type="checkbox" name={nomChamp} value="{t.debut}|{t.fin}" disabled={t.prise} />
					{majuscule(texteTranche(t))}{#if t.prise}<span class="note"> · déjà dans une demande</span>{/if}
				</label>
			{/each}
		</fieldset>
	{/each}
{/snippet}

<div class="page">
	<EnTetePage titre={echange ? 'Échanger une période' : 'Me faire remplacer'} phrase={echange ? 'Vous prenez une période de son astreinte, il prend une des vôtres. Il doit accepter.' : 'Choisissez vos périodes. Un collègue accepte, et votre chef d’équipe est prévenu.'} retour={{ href: '/remplacements', libelle: 'Remplacements' }} />

	<nav class="modes" aria-label="Type de demande">
		<a href="?mode=remplacement" aria-current={!echange ? 'page' : undefined}>Me faire remplacer</a>
		<a href="?mode=echange" aria-current={echange ? 'page' : undefined}>Échanger</a>
		<a href="/remplacements/manoeuvre">Échanger une manœuvre</a>
	</nav>

	<p class="erreur" class:masque={!form?.message} role="alert">{form?.message ?? ''}</p>

	{#if data.semaines.length === 0}
		<Vide titre="Aucune astreinte à venir." texte="Vos périodes d’astreinte des douze prochaines semaines apparaîtront ici, dès que le planning est publié." action={{ href: '/planning', libelle: 'Voir le planning' }} />
	{:else}
		{#if echange}
			<form method="GET" class="carte choix">
				<input type="hidden" name="mode" value="echange" />
				<label for="avec">Avec qui ?</label>
				<select id="avec" name="avec">
					<option value="">Choisir un collègue</option>
					{#each data.collegues as c (c.id)}<option value={c.id} selected={data.avec?.id === c.id}>{nom(c)}</option>{/each}
				</select>
				<button type="submit" class="bouton secondaire">Voir ses périodes</button>
			</form>
		{/if}

		{#if !echange || data.avec}
			<form method="POST" class="formulaire">
				<input type="hidden" name="mode" value={data.mode} />
				<section class="carte" aria-labelledby="t-miennes">
					<h2 id="t-miennes">{echange ? 'Ce que je donne' : 'Mes périodes'}</h2>
					{@render semaines(data.semaines, 'periode', 'Ma')}
				</section>
	
				{#if echange}
					{#if data.avec}
						<input type="hidden" name="collegue" value={data.avec.id} />
						<section class="carte" aria-labelledby="t-siennes">
							<h2 id="t-siennes">Ce que je prends à {nom(data.avec)}</h2>
							{#if data.semainesAvec.length === 0}
								<p class="doux">{nom(data.avec)} n’a pas d’astreinte libre dans les douze prochaines semaines.</p>
							{:else}
								{@render semaines(data.semainesAvec, 'periodeCible', 'Sa')}
							{/if}
						</section>
					{/if}
				{:else}
					<fieldset class="carte">
						<legend>À qui la demander ?</legend>
						<label class="case"><input type="radio" name="pour" value="tous" bind:group={pour} /> À tous les collègues disponibles</label>
						<p class="aide">Le premier qui accepte vous remplace. Ceux qui ont vos aptitudes contrôlées sont en tête de liste.</p>
						<label class="case"><input type="radio" name="pour" value="collegue" bind:group={pour} /> À un collègue en particulier</label>
						<label for="collegue" class="libelle">Collègue</label>
						<p class="aide-champ">Il doit être libre sur ces périodes : ni d’astreinte, ni déjà remplaçant.</p>
						<select id="collegue" name="collegue">
							<option value="">Choisir un collègue</option>
							{#each data.collegues as c (c.id)}<option value={c.id}>{nom(c)}</option>{/each}
						</select>
					</fieldset>
				{/if}
	
				<div class="carte">
					<label for="mot" class="libelle">Un mot (facultatif)</label>
					<textarea id="mot" name="mot" maxlength="200" rows="2"></textarea>
				</div>
				{#if !echange || data.avec}
					<button type="submit" class="bouton principal">{echange ? 'Proposer l’échange' : 'Envoyer la demande'}</button>
				{/if}
			</form>
		{/if}
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
	p,
	h2 {
		margin: 0;
	}
	h2 {
		font: 700 1.25rem var(--police-titre);
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
	fieldset.carte legend {
		float: left;
		padding: 0;
		margin-bottom: 4px;
		font: 700 1.25rem var(--police-titre);
	}
	.semaine {
		display: flex;
		flex-direction: column;
		gap: 2px;
		margin: 0;
		padding: 10px 0 0;
		border: 0;
		border-top: 1px solid var(--trait-doux);
	}
	.semaine legend {
		float: left;
		padding: 0;
		margin-bottom: 4px;
		font-weight: 700;
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
	.bloc {
		font-weight: 700;
	}
	.prise,
	.note,
	.doux,
	.aide {
		color: var(--doux);
	}
	.aide-champ {
		margin-top: -6px;
		color: var(--doux);
		font-size: 0.9375rem;
	}
	.aide {
		margin: -6px 0 4px 32px;
		font-size: 0.9375rem;
	}
	.libelle,
	.choix label {
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
	.modes {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.modes a {
		min-height: var(--cible);
		display: inline-flex;
		align-items: center;
		padding: 0 16px;
		border: 1px solid var(--trait);
		border-radius: 999px;
		background: var(--surface);
		color: var(--encre);
		font-weight: 600;
		text-decoration: none;
	}
	.modes a[aria-current='page'] {
		background: var(--encre);
		border-color: var(--encre);
		color: var(--surface);
	}
	.bouton {
		align-self: flex-start;
		min-height: var(--cible);
		display: inline-flex;
		align-items: center;
		padding: 0 18px;
		border-radius: 999px;
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}
	.principal {
		border: 2px solid var(--encre);
		background: var(--rouge);
		color: var(--sur-rouge);
	}
	.secondaire {
		border: 1px solid var(--trait);
		background: var(--surface);
		color: var(--encre);
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
