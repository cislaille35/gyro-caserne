<script lang="ts">
	import centre from '$centre';
	import GyroAccueil from '#lib/gyro/GyroAccueil.svelte';
	import { lireAffichageContexte } from '#lib/gyro/niveau.ts';
	import Carte from '#lib/ui/Carte.svelte';
	import Casquettes from '#lib/ui/Casquettes.svelte';
	import Initiales from '#lib/ui/Initiales.svelte';
	import Vide from '#lib/ui/Vide.svelte';

	let { data } = $props();

	const affichage = lireAffichageContexte();
	const phrase = $derived(
		affichage.niveau === 'vivant' ? 'Gyro a fait le plein de café.' : affichage.niveau === 'equilibre' ? 'Bienvenue sur Gyro Caserne.' : ''
	);
	const rangee = $derived(data.casquettes.length >= 2);
	const gerer = $derived([
		{ href: '/agents', titre: 'Agents', texte: 'L’équipe et les fiches des agents.' },
		...(data.peutNominations ? [{ href: '/nominations', titre: 'Nominations', texte: 'Qui tient quel rôle.' }] : []),
		...(data.peutReglages ? [{ href: '/reglages', titre: 'Réglages', texte: 'Les rôles et les comités.' }] : [])
	]);
</script>

<svelte:head>
	<title>Accueil · Gyro Caserne</title>
</svelte:head>

<div class="page">
	<div class="tete">
		<GyroAccueil taille={96} />
		<div>
			<h1>{data.prenom ? `Bonjour ${data.prenom}` : 'Bonjour'}</h1>
			<p class="centre">{centre.nom}</p>
			{#if phrase}<p class="phrase">{phrase}</p>{/if}
		</div>
	</div>

	{#if rangee}<Casquettes casquettes={data.casquettes} choisie={data.choisie} />{/if}

	<div class="contenu">
		{#if data.contenu.type === 'centre'}
			<Carte titre="À décider">
				{#if data.contenu.aDecider.length > 0}
					<ul class="liste">
						{#each data.contenu.aDecider as element (element.texte)}
							<li><a class="ligne alerte" href={element.lien}><span>{element.texte}</span><span aria-hidden="true">›</span></a></li>
						{/each}
					</ul>
				{:else}
					<p>Rien à décider pour le moment.</p>
				{/if}
			</Carte>
			<Carte titre="Gérer">
				<ul class="liste">
					{#each gerer as lien (lien.href)}
						<li>
							<a class="ligne" href={lien.href}>
								<span class="texte"><span class="titre">{lien.titre}</span><span class="doux">{lien.texte}</span></span><span aria-hidden="true">›</span>
							</a>
						</li>
					{/each}
				</ul>
			</Carte>
		{:else if data.contenu.type === 'astreinte' || data.contenu.type === 'equipe'}
			<Vide texte="Votre astreinte s’affichera ici avec le planning." />
		{:else if data.contenu.type === 'role'}
			<Carte titre="Ce que ce rôle permet">
				{#if data.contenu.permet.length > 0}
					<ul class="phrases">
						{#each data.contenu.permet as permis (permis)}<li>{permis}</li>{/each}
					</ul>
				{:else}
					<p>Ce rôle n’ajoute rien à ce que fait tout agent.</p>
				{/if}
			</Carte>
		{:else if data.contenu.type === 'comite'}
			<Carte titre="Membres">
				{#if data.contenu.membres.length > 0}
					<ul class="liste">
						{#each data.contenu.membres as membre (membre.personneId)}
							<li class="membre">
								<Initiales prenom={membre.prenom} nom={membre.nom} />
								<span class="texte"><span>{membre.prenom} {membre.nom}</span><span class="doux">{membre.role}</span></span>
							</li>
						{/each}
					</ul>
				{:else}
					<p>Aucun membre pour le moment.</p>
				{/if}
			</Carte>
		{/if}
	</div>
</div>

<style>
	.page,
	.contenu {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.tete {
		display: flex;
		align-items: center;
		gap: 16px;
		flex-wrap: wrap;
	}
	h1 {
		margin: 0;
	}
	p {
		margin: 4px 0 0;
	}
	.centre,
	.phrase,
	.doux {
		color: var(--doux);
	}
	.liste {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.phrases {
		margin: 0;
		padding-left: 1.25rem;
	}
	.ligne {
		min-height: var(--cible);
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 10px 14px;
		border: 1px solid var(--trait-doux);
		border-radius: 12px;
		color: var(--encre);
		text-decoration: none;
	}
	.ligne:hover > span:first-child {
		text-decoration: underline;
	}
	/* À faire : orange, avec le texte qui dit quoi. */
	.alerte {
		background: var(--statut-alerte-fond);
		border-color: var(--statut-alerte-trait);
		color: var(--statut-alerte-texte);
		font-weight: 600;
	}
	.texte {
		display: flex;
		flex-direction: column;
	}
	.titre {
		font-weight: 700;
	}
	.membre {
		display: flex;
		align-items: center;
		gap: 12px;
	}
</style>
