<script lang="ts">
	import CarteDemande from '#lib/remplacements/CarteDemande.svelte';
	import Frise from '#lib/remplacements/Frise.svelte';
	import { frise, titreDemande } from '#lib/remplacements/textes.ts';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';
	import ListeRangees from '#lib/ui/ListeRangees.svelte';
	import Pastille from '#lib/ui/Pastille.svelte';
	import Rangee from '#lib/ui/Rangee.svelte';
	import Visage from '#lib/ui/Visage.svelte';
	import { pluriel } from '#lib/pluriel.ts';

	let { data, form } = $props();
	const v = $derived(data.demande);
	const nom = (q: { prenom: string; nom: string }) => `${q.prenom} ${q.nom}`.trim();
	const sdis = $derived(v.etat === 'conclue' && v.genre !== 'manoeuvre' && (v.moi === 'demandeur' || v.moi === 'remplacant'));
</script>

<svelte:head>
	<title>{titreDemande(v)} · Remplacements · Gyro Caserne</title>
</svelte:head>

<div class="page">
	<EnTetePage titre={v.genre === 'remplacement' ? 'Remplacement' : 'Échange'} retour={{ href: '/remplacements', libelle: 'Remplacements' }} />
	<p class="reussite" class:masque={!form?.succes && !data.envoyee} role="status">{form?.succes ?? (data.envoyee ? (v.genre === 'remplacement' ? 'Demande envoyée. Vous serez prévenu dès qu’un collègue répond.' : 'Échange proposé. Vous serez prévenu de sa réponse.') : '')}</p>
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
		<ListeRangees titre="Disponibles" compte={data.disponibles.length}>
			{#each data.disponibles as a (a.id)}
				<li>
					<Rangee titre={nom(a)} sous={a.aptitudes ? 'A vos aptitudes contrôlées' : 'Il lui manque une de vos aptitudes contrôlées : le chef devra valider'}>
						{#snippet tete()}<Visage prenom={a.prenom} nom={a.nom} couleur={null} taille={40} />{/snippet}
						{#snippet droite()}{#if a.aptitudes}<Pastille ton="ok">Aptitudes</Pastille>{/if}{/snippet}
					</Rangee>
				</li>
			{:else}
				<li><Rangee titre="Personne n’est disponible sur ces périodes pour le moment." icone="groupe" /></li>
			{/each}
		</ListeRangees>
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
		border: 1px solid var(--trait-doux);
		border-radius: var(--rayon-grand);
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
