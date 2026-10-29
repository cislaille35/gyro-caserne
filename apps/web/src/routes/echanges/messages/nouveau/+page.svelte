<script lang="ts">
	import { untrack } from 'svelte';
	import PastilleMur from '#lib/ui/PastilleMur.svelte';
	import Visage from '#lib/ui/Visage.svelte';
	import { avecLeComite, plat } from '#lib/messagerie/recherche.ts';

	let { data } = $props();

	// La recherche part de celle reçue sans JavaScript, puis filtre à chaque frappe.
	let recherche = $state(untrack(() => data.q));
	const cherche = $derived(plat(recherche) !== '');
	const visibles = $derived(data.personnes.filter((p) => plat(`${p.prenom} ${p.nom} ${p.surnom ?? ''}`).includes(plat(recherche))));
	const p = $derived(data.pourVous);
	const raccourcis = $derived(p.chefs.length + p.equipes.length + p.comites.length > 0);
	const membres = (n: number, suite: string) => `${n} ${n > 1 ? 'membres' : 'membre'}${suite}`;
</script>

<svelte:head>
	<title>Nouveau message · Échanges · Gyro Caserne</title>
</svelte:head>

<div class="page">
	<header class="entete">
		<a class="annuler" href="/echanges/messages">Annuler</a>
		<h1>Nouveau message</h1>
	</header>

	<form class="recherche" method="get" role="search" onsubmit={(e) => e.preventDefault()}>
		<label for="recherche" class="masque">Écrire à</label>
		<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
		<input id="recherche" type="search" name="q" bind:value={recherche} placeholder="Nom, prénom ou surnom" autocomplete="off" />
	</form>

	{#if !cherche}
		<a class="ligne grande" href="/echanges/messages/nouveau/groupe">
			<span class="rond" aria-hidden="true">
				<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="9" cy="9" r="3.5" /><path d="M3 19c.8-3.2 3.2-5 6-5s5.2 1.8 6 5M18 8v6M15 11h6" /></svg>
			</span>
			<strong class="nom">Nouveau groupe</strong>
		</a>

		{#if raccourcis}
			<h2>Pour vous</h2>
			<ul>
				{#each p.chefs as c (c.id)}
					<li>
						<a class="ligne grande" href={c.lien}>
							<Visage prenom={c.prenom} nom={c.nom} couleur={c.couleur} taille={48} />
							<span class="textes"><strong class="nom">{c.prenom} {c.nom}</strong><span class="sous">votre chef d’équipe</span></span>
						</a>
					</li>
				{/each}
				{#each p.equipes as e (e.id)}
					<li>
						<a class="ligne grande" href={e.lien}>
							<PastilleMur icone={null} couleur={e.couleur} numero={e.numero} />
							<span class="textes"><strong class="nom">Groupe avec l’équipe {e.numero}</strong><span class="sous">{membres(e.membres, e.membres > 1 ? ', ajoutés d’un coup' : ', ajouté d’un coup')}</span></span>
						</a>
					</li>
				{/each}
				{#each p.comites as c (c.id)}
					<li>
						<a class="ligne grande" href={c.lien}>
							<PastilleMur icone={c.icone} couleur={null} numero={null} />
							<span class="textes"><strong class="nom">Groupe avec {avecLeComite(c.nom)}</strong><span class="sous">{membres(c.membres, ' du comité')}</span></span>
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	{/if}

	{#if data.personnes.length === 0}
		<p class="aucune">Personne d’autre dans l’annuaire pour l’instant.</p>
	{:else}
		<h2>Tout le centre</h2>
		<!-- Toujours présent (masqué quand la recherche trouve), pour que le lecteur d'écran annonce une recherche sans résultat. -->
		<p class="aucune" class:masque={visibles.length > 0} role="status">{visibles.length === 0 ? 'Personne à ce nom.' : ''}</p>
		{#if visibles.length > 0}
			<ul>
				{#each visibles as a (a.id)}
					<li>
						<a class="ligne" href={a.lien}>
							<Visage prenom={a.prenom} nom={a.nom} couleur={a.couleur} taille={44} />
							<span class="textes"><strong class="nom">{a.prenom} {a.nom}</strong>{#if a.sous}<span class="sous">{a.sous}</span>{/if}</span>
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	{/if}
</div>

<style>
	/* À l'ordinateur, la page garde une largeur de lecture. */
	.page {
		max-width: 40rem;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.entete {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 8px;
		margin-bottom: 8px;
	}
	.annuler {
		min-height: var(--cible);
		display: flex;
		align-items: center;
		color: var(--encre);
		font-weight: 600;
		text-decoration: none;
	}
	.annuler:hover {
		text-decoration: underline;
	}
	h1 {
		grid-column: 2;
		margin: 0;
		text-align: center;
		font: 700 1.375rem var(--police-titre);
	}

	.recherche {
		position: relative;
		display: flex;
		margin-bottom: 8px;
	}
	.recherche svg {
		position: absolute;
		left: 14px;
		top: 13px;
		color: var(--doux);
	}
	input {
		flex: 1;
		min-height: var(--cible);
		padding: 0 16px 0 40px;
		border: 1px solid var(--trait);
		border-radius: 999px;
		background: var(--surface);
		color: var(--encre);
		font: inherit;
	}
	input::placeholder {
		color: var(--doux);
	}

	h2 {
		margin: 12px 8px 4px;
		color: var(--doux);
		font-size: 0.875rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}
	ul {
		list-style: none;
		margin: 0 -8px;
		padding: 0;
		display: flex;
		flex-direction: column;
	}
	.ligne {
		min-height: 60px;
		padding: 6px 8px;
		border-radius: var(--rayon-grand);
		display: flex;
		align-items: center;
		gap: 12px;
		color: var(--encre);
		text-decoration: none;
	}
	a.ligne.grande {
		min-height: 64px;
		padding: 8px;
	}
	/* « Nouveau groupe » est hors de la liste : il s'aligne sur elle. */
	.page > .ligne {
		margin: 0 -8px;
	}
	.ligne:hover {
		background: var(--surface);
		color: var(--encre);
	}
	.rond {
		flex: none;
		width: 48px;
		height: 48px;
		border-radius: 50%;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: var(--rouge);
		color: var(--sur-rouge);
	}
	.textes {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.nom {
		font-size: 1.0625rem;
		font-weight: 600;
	}
	.grande .nom {
		font-weight: 700;
	}
	.sous {
		color: var(--doux);
		font-size: 0.875rem;
	}
	.aucune {
		margin: 8px 16px 0;
		color: var(--doux);
		font-size: 0.875rem;
		text-align: center;
	}
	.masque {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
</style>
