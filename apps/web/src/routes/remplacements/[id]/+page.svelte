<script lang="ts">
	import CarteDemande from '#lib/remplacements/CarteDemande.svelte';
	import Frise from '#lib/remplacements/Frise.svelte';
	import { frise, titreDemande } from '#lib/remplacements/textes.ts';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';
	import Visage from '#lib/ui/Visage.svelte';
	import { pluriel } from '#lib/pluriel.ts';

	let { data, form } = $props();
	const v = $derived(data.demande);
	const nom = (q: { prenom: string; nom: string }) => `${q.prenom} ${q.nom}`.trim();
	const envoyee = $derived(data.envoyee && v.moi === 'demandeur');
	const groupes = $derived(
		[
			{ titre: 'Sans validation', phrase: 'Ont vos aptitudes contrôlées.', agents: data.disponibles.filter((a) => a.aptitudes) },
			{ titre: 'À faire valider par le chef', phrase: 'Il leur manque une de vos aptitudes contrôlées.', agents: data.disponibles.filter((a) => !a.aptitudes) }
		].filter((g) => g.agents.length > 0)
	);
	const sdis = $derived(v.etat === 'conclue' && v.genre !== 'manoeuvre' && (v.moi === 'demandeur' || v.moi === 'remplacant'));
</script>

<svelte:head>
	<title>{titreDemande(v)} · Remplacements · Gyro Caserne</title>
</svelte:head>

<div class="page">
	<EnTetePage titre={v.genre === 'remplacement' ? 'Remplacement' : 'Échange'} retour={{ href: '/remplacements', libelle: 'Remplacements' }} />
	<p class="reussite" class:masque={!form?.succes && !envoyee} role="status">{form?.succes ?? (envoyee ? (v.genre === 'remplacement' ? 'Demande envoyée. Vous serez prévenu dès qu’un collègue répond.' : 'Échange proposé. Vous serez prévenu de sa réponse.') : '')}</p>
	<p class="erreur" class:masque={!form?.message} role="alert">{form?.message ?? ''}</p>

	<section class="carte" aria-labelledby="titre-frise">
		<h2 id="titre-frise" class="masque">Où en est la demande</h2>
		<Frise pas={frise(v)} />
	</section>

	{#if sdis}
		<p class="sdis"><strong>À faire :</strong> mettez à jour votre disponibilité dans l’appli du SDIS. C’est elle qui fait foi pour l’alerte.</p>
	{/if}

	<CarteDemande {v} detail={false} niveau={2} />

	{#if v.moi === 'demandeur' && v.ouverte && v.etat === 'attente'}
		<section class="disponibles" aria-labelledby="titre-disponibles">
			<h2 id="titre-disponibles" class="rubrique">Disponibles{#if data.disponibles.length}{' '}<span class="compte">{data.disponibles.length}</span>{/if}</h2>
			{#each groupes as g (g.titre)}
				<section class="carte groupe" aria-label={g.titre}>
					<h3>{g.titre} <span class="compte">{g.agents.length}</span></h3>
					<p class="doux">{g.phrase}</p>
					<ul role="list">
						{#each g.agents as a (a.id)}
							<li><Visage prenom={a.prenom} nom={a.nom} couleur={null} taille={30} /><span>{nom(a)}</span></li>
						{/each}
					</ul>
				</section>
			{:else}
				<p class="carte">Personne n’est disponible sur ces périodes pour le moment.</p>
			{/each}
		</section>
		{#if data.recue !== null}<p class="doux">Demande envoyée à {pluriel(data.recue, 'collègue')}, prévenus en même temps.</p>{/if}
	{/if}

	{#if data.valideurs.length > 0 && v.genre !== 'manoeuvre'}
		<p class="doux">{v.etat === 'a_valider' ? 'Valide' : 'Informé'} : {data.valideurs.map(nom).join(', ')}.</p>
	{/if}
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 16px;
		max-width: 44rem;
	}
	p {
		margin: 0;
	}
	.doux {
		color: var(--doux);
	}
	.carte {
		padding: 16px;
		background: var(--surface);
		border: 1px solid transparent;
		box-shadow: var(--ombre-carte);
		border-radius: var(--rayon-grand);
	}
	.disponibles,
	.groupe {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.rubrique,
	h3 {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 0;
	}
	h3 {
		font: 700 1.0625rem var(--police-titre);
	}
	.compte {
		min-width: 24px;
		height: 24px;
		padding: 0 7px;
		border-radius: 12px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: var(--statut-neutre-fond);
		color: var(--encre);
		font: 700 0.8125rem var(--police);
	}
	/* Des noms à lire, sans geste : ils tiennent sur plusieurs colonnes dès que la place le permet. */
	ul {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
		gap: 8px 12px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
		overflow-wrap: anywhere;
	}
	.sdis {
		padding: 12px 14px;
		border-radius: var(--rayon-grand);
		background: var(--statut-info-fond);
		color: var(--statut-info-texte);
		border: 1px solid var(--statut-info-trait);
	}
	.reussite,
	.erreur {
		padding: 12px 14px;
		border-radius: var(--rayon-grand);
		font-weight: 600;
	}
	.reussite {
		background: var(--statut-ok-fond);
		color: var(--statut-ok-texte);
		border: 1px solid var(--statut-ok-trait);
	}
	.erreur {
		background: var(--statut-danger-fond);
		color: var(--statut-danger-texte);
		border: 1px solid var(--statut-danger-trait);
	}
</style>
