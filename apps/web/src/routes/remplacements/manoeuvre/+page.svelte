<script lang="ts">
	import { momentLong } from '#lib/planning/dates.ts';
	import Progression from '#lib/remplacements/Progression.svelte';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';
	import Vide from '#lib/ui/Vide.svelte';
	import Visage from '#lib/ui/Visage.svelte';

	let { data, form } = $props();
	const TITRES = { mienne: 'Ma manœuvre', sienne: 'Contre quelle manœuvre ?', verifier: 'Vérifier et envoyer' } as const;
	const etapes = $derived((data.court ? (['sienne', 'verifier'] as const) : (['mienne', 'sienne', 'verifier'] as const)).map((id) => ({ id, titre: TITRES[id] })));
	const index = $derived(etapes.findIndex((e) => e.id === data.etape));
	const precedente = $derived(index > 0 ? etapes[index - 1]!.id : null);
	const adresse = (etape: string) => {
		const q = new URLSearchParams();
		if (data.mienne) q.set('mienne', String(data.mienne.id));
		if (data.court && data.miennes.length > 1) q.set('depuis', 'planning');
		if (data.sienne) q.set('sienne', `${data.sienne.collegue.id}:${data.sienne.manoeuvre.id}`);
		if (etape !== etapes[0]!.id) q.set('etape', etape);
		return `?${q}`;
	};
	const quoi = (m: { theme: string; debut: string }) => `« ${m.theme} », ${momentLong(m.debut)}`;
	const message = $derived(form?.message ?? data.message ?? '');
</script>

<svelte:head>
	<title>Échanger ma place à une manœuvre · Remplacements · Gyro Caserne</title>
</svelte:head>

{#snippet garder()}
	{#if data.court && data.miennes.length > 1}<input type="hidden" name="depuis" value="planning" />{/if}
{/snippet}

{#snippet boutons(libelle: string, suivante: string)}
	<div class="boutons">
		<button type="submit" name="etape" value={suivante} class="bouton principal">{libelle}</button>
		{#if precedente}<a class="bouton secondaire" href={adresse(precedente)}>Retour</a>{/if}
	</div>
{/snippet}

<div class="page">
	<EnTetePage titre="Échanger ma place à une manœuvre" phrase="Un collègue va à votre manœuvre, vous allez à la sienne. Il doit accepter ; votre chef de garde est prévenu." retour={{ href: '/remplacements', libelle: 'Remplacements' }} />

	{#if data.miennes.length === 0}
		<Vide titre="Aucune manœuvre à échanger." texte="Seules les manœuvres qui convoquent certaines équipes s’échangent, pas celles de tout le centre." action={{ href: '/planning', libelle: 'Voir le planning' }} />
	{:else if data.collegues.length === 0}
		<Vide titre="Aucun collègue convoqué à une autre manœuvre." texte="Un échange se fait avec un collègue convoqué à une manœuvre où vous ne l’êtes pas." />
	{:else}
		<Progression {etapes} courante={data.etape} lien={adresse} />
		<p class="erreur" class:masque={!message} role="alert">{message}</p>

		<section class="carte" aria-labelledby="titre-etape">
			<h2 id="titre-etape">{TITRES[data.etape]}</h2>
			{#if data.mienne && data.etape !== 'mienne'}
				<p class="resume"><span>Votre manœuvre : <strong>{quoi(data.mienne)}</strong>.</span>{#if !data.court}<a href={adresse('mienne')}>Modifier<span class="masque">{' votre manœuvre'}</span></a>{/if}</p>
			{/if}

			{#if data.etape === 'mienne'}
				<form method="GET" class="formulaire">
					{@render garder()}
					<fieldset>
						<legend class="masque">Ma manœuvre</legend>
						<ul role="list">
							{#each data.miennes as m, i (m.id)}
								<li><label class="rangee"><input type="radio" name="mienne" value={m.id} checked={data.mienne ? data.mienne.id === m.id : i === 0} /><span class="corps"><span class="titre">« {m.theme} »</span><span class="sous">{momentLong(m.debut)}</span></span></label></li>
							{/each}
						</ul>
					</fieldset>
					{@render boutons('Continuer', 'sienne')}
				</form>
			{:else if data.etape === 'sienne' && data.mienne}
				<form method="GET" class="formulaire">
					{@render garder()}
					<input type="hidden" name="mienne" value={data.mienne.id} />
					<fieldset>
						<legend class="masque">La manœuvre d’un collègue</legend>
						<ul role="list">
							{#each data.collegues as c (c.id)}
								{#each c.manoeuvres as m (m.id)}
									<li>
										<label class="rangee">
											<input type="radio" name="sienne" value="{c.id}:{m.id}" checked={data.sienne?.collegue.id === c.id && data.sienne?.manoeuvre.id === m.id} />
											<Visage prenom={c.prenom} nom={c.nom} couleur={null} taille={40} />
											<span class="corps"><span class="titre">{c.prenom} {c.nom}</span><span class="sous">{quoi(m)}</span></span>
										</label>
									</li>
								{/each}
							{/each}
						</ul>
					</fieldset>
					{@render boutons('Continuer', 'verifier')}
				</form>
			{:else if data.etape === 'verifier' && data.mienne && data.sienne}
				<div class="recap">
					<p class="fort">Vous proposez à {data.sienne.collegue.prenom} {data.sienne.collegue.nom} d’aller à votre place à {quoi(data.mienne)}, et vous allez à {quoi(data.sienne.manoeuvre)}.</p>
					<p>{data.sienne.collegue.prenom} doit accepter.</p>
					<p>Votre chef de garde sera informé.</p>
				</div>
				<form method="POST" class="formulaire">
					<input type="hidden" name="mienne" value={data.mienne.id} />
					<input type="hidden" name="sienne" value="{data.sienne.collegue.id}:{data.sienne.manoeuvre.id}" />
					<label for="mot" class="libelle">Un mot pour votre collègue (facultatif)</label>
					<textarea id="mot" name="mot" maxlength="200" rows="2"></textarea>
					<div class="boutons">
						<button type="submit" class="bouton principal">Proposer l’échange</button>
						{#if precedente}<a class="bouton secondaire" href={adresse(precedente)}>Retour</a>{/if}
					</div>
				</form>
			{/if}
		</section>
	{/if}
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--espace-16);
		max-width: var(--largeur-page);
	}
	p,
	h2 {
		margin: 0;
	}
	h2 {
		font: 700 var(--texte-24) var(--police-titre);
	}
	.carte {
		display: flex;
		flex-direction: column;
		gap: var(--espace-16);
		padding: var(--espace-16);
		background: var(--surface);
		border: 1px solid transparent;
		box-shadow: var(--ombre-carte);
		border-radius: var(--rayon-grand);
	}
	.formulaire {
		display: flex;
		flex-direction: column;
		gap: var(--espace-16);
	}
	fieldset {
		margin: 0;
		padding: 0;
		border: 0;
		min-width: 0;
	}
	ul {
		margin: 0;
		padding: 0;
		list-style: none;
		display: grid;
		gap: var(--espace-6);
	}
	.rangee {
		min-height: 56px;
		display: flex;
		align-items: center;
		gap: var(--espace-12);
		padding: var(--espace-8) var(--espace-16);
		border: 1px solid var(--trait);
		border-radius: var(--rayon-grand);
		background: var(--surface);
		cursor: pointer;
	}
	.rangee:has(input:checked) {
		border: 2px solid var(--encre);
		padding: calc(var(--espace-12) - 1px) calc(var(--espace-16) - 1px);
	}
	.rangee:has(input:focus-visible) {
		outline: 3px solid var(--focus);
		outline-offset: 2px;
	}
	.rangee > input {
		flex: none;
		width: 22px;
		height: 22px;
		margin: 0;
		accent-color: var(--encre);
	}
	.corps {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.titre,
	.fort {
		font-weight: 700;
	}
	.sous {
		color: var(--doux);
		font-size: var(--texte-15);
	}
	.resume {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--espace-4) var(--espace-12);
		padding: var(--espace-12) var(--espace-16);
		border-radius: var(--rayon-grand);
		background: var(--statut-neutre-fond);
	}
	.resume a {
		color: var(--encre);
		font-weight: 600;
	}
	.recap {
		display: flex;
		flex-direction: column;
		gap: var(--espace-6);
		padding: var(--espace-16) var(--espace-16);
		border-radius: var(--rayon-grand);
		background: var(--statut-neutre-fond);
		font-size: var(--texte-16);
	}
	.libelle {
		font-weight: 600;
	}
	textarea {
		min-height: var(--cible);
		padding: var(--espace-8) var(--espace-12);
		background: var(--surface);
		color: var(--encre);
		font: 400 var(--texte-16) var(--police);
		resize: vertical;
	}
	.boutons {
		display: flex;
		flex-wrap: wrap;
		gap: var(--espace-8);
	}
	.bouton {
		min-height: var(--cible);
		display: inline-flex;
		align-items: center;
		padding: 0 var(--espace-20);
		border-radius: var(--rayon-bouton);
		font: inherit;
		font-weight: 700;
		text-decoration: none;
		cursor: pointer;
	}
	.principal {
		border: 1px solid transparent;
		background: var(--rouge);
		color: var(--sur-rouge);
	}
	.secondaire {
		border: 1px solid var(--trait);
		background: var(--surface);
		color: var(--encre);
	}
	.erreur {
		padding: var(--espace-12) var(--espace-16);
		border-radius: var(--rayon-grand);
		font-weight: 600;
		background: var(--statut-danger-fond);
		color: var(--statut-danger-texte);
		border: 1px solid var(--statut-danger-trait);
	}
	@media (min-width: 900px) {
		ul {
			grid-template-columns: 1fr 1fr;
		}
	}
</style>
