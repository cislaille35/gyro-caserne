<script lang="ts">
	import CarteDemande from '#lib/remplacements/CarteDemande.svelte';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';
	import Vide from '#lib/ui/Vide.svelte';

	let { data, form } = $props();

	const onglets = $derived(
		data.personne
			? [
					{ id: 'pour-moi', libelle: 'Pour moi', n: data.pourMoi.length },
					{ id: 'miennes', libelle: 'Mes demandes', n: 0 },
					...(data.avecValider ? [{ id: 'a-valider', libelle: 'À valider', n: data.aValider.length }] : []),
					{ id: 'historique', libelle: 'Historique', n: 0 }
				]
			: []
	);
	const liste = $derived(
		!data.personne ? [] : data.onglet === 'pour-moi' ? data.pourMoi : data.onglet === 'miennes' ? data.miennes : data.onglet === 'a-valider' ? data.aValider : data.historique
	);
	const VIDES = {
		'pour-moi': { titre: 'Aucune demande pour vous.', texte: 'Quand un collègue cherche un remplaçant et que vous êtes disponible, sa demande arrive ici et dans votre cloche.' },
		miennes: { titre: 'Aucune demande en cours.', texte: 'Pour vous faire remplacer ou échanger une période, partez de votre planning.' },
		'a-valider': { titre: 'Rien à valider.', texte: 'Quand une aptitude contrôlée manque à un remplaçant de votre équipe, la demande arrive ici.' },
		historique: { titre: 'Pas encore d’historique.', texte: 'Les demandes terminées, annulées ou expirées restent ici.' }
	} as const;
	const PLUS = 'M12 5v14 M5 12h14';
</script>

<svelte:head>
	<title>Remplacements · Gyro Caserne</title>
</svelte:head>

<div class="page">
	<EnTetePage titre="Remplacements" phrase="Se faire remplacer, échanger, et répondre aux collègues." retour={{ href: '/planning', libelle: 'Planning' }} action={data.personne ? { href: '/remplacements/demander', libelle: 'Me faire remplacer', dessin: PLUS } : undefined} />
	<p class="reussite" class:masque={!form?.succes} role="status">{form?.succes ?? ''}</p>
	<p class="erreur" class:masque={!form?.message} role="alert">{form?.message ?? ''}</p>

	{#if !data.personne}
		<Vide titre="Réservé aux agents." texte="Le super administrateur n’a pas d’astreinte." />
	{:else}
		<nav class="onglets" aria-label="Remplacements">
			{#each onglets as o (o.id)}
				<a href="?onglet={o.id}" aria-current={data.onglet === o.id ? 'page' : undefined}>{o.libelle}{#if o.n > 0}<span class="compte"><span class="masque"> : </span>{o.n}</span>{/if}</a>
			{/each}
		</nav>
		<p class="liens"><a href="/remplacements/manoeuvre">Échanger une manœuvre</a></p>

		{#if liste.length === 0}
			<Vide titre={VIDES[data.onglet].titre} texte={VIDES[data.onglet].texte} action={data.onglet === 'miennes' ? { href: '/remplacements/demander', libelle: 'Me faire remplacer' } : undefined} />
		{:else}
			<ul role="list">
				{#each liste as v (v.id)}
					<li><CarteDemande {v} niveau={2} /></li>
				{/each}
			</ul>
		{/if}
	{/if}
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	p {
		margin: 0;
	}
	ul {
		margin: 0;
		padding: 0;
		list-style: none;
		display: grid;
		gap: 10px;
	}
	.onglets {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.onglets a {
		min-height: var(--cible);
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 0 16px;
		border: 1px solid var(--trait);
		border-radius: 999px;
		background: var(--surface);
		color: var(--encre);
		font-weight: 600;
		text-decoration: none;
	}
	.onglets a[aria-current='page'] {
		background: var(--encre);
		border-color: var(--encre);
		color: var(--surface);
	}
	.compte {
		min-width: 1.5em;
		padding: 0 6px;
		border-radius: 999px;
		background: var(--rouge);
		color: var(--sur-rouge);
		font-size: 0.875rem;
		text-align: center;
	}
	.liens a {
		color: var(--encre);
		font-weight: 600;
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
	@media (min-width: 1024px) {
		.page {
			max-width: 64rem;
		}
		ul {
			grid-template-columns: 1fr 1fr;
			align-items: start;
		}
	}
</style>
