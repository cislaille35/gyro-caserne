<script lang="ts">
	import { enhance } from '$app/forms';
	import type { EquipePlanning, PropositionAnnee } from '@gyro-caserne/socle';
	import { duAu, finDeSemaine, momentLong } from '#lib/planning/dates.ts';
	import { etatEquipe, resumeProposition, texteCompromis } from '#lib/planning/preparer.ts';
	import { pluriel } from '#lib/pluriel.ts';
	import Bouton from '#lib/ui/Bouton.svelte';
	import Pastille from '#lib/ui/Pastille.svelte';

	// Ce que l'appli propose pour une année sans roulement. Rien n'est écrit avant « Accepter ».
	let { proposition: p, equipes, action, fermer }: { proposition: PropositionAnnee; equipes: EquipePlanning[]; action: string; fermer: string } = $props();

	let envoi = $state(false);
	const nom = (id: number | null) => (id === null ? 'personne' : (equipes.find((e) => e.id === id)?.nom ?? 'Équipe archivée'));
	const compromis = $derived(texteCompromis(p.fetes, equipes));
	const incompletes = $derived(p.equipes.some((e) => !e.arme));
	const ecartees = $derived([p.annulees ? pluriel(p.annulees, 'annulée non reprise', 'annulées non reprises') : '', p.passees ? pluriel(p.passees, 'date passée', 'dates passées') : '', p.deja ? `${p.deja} au même moment qu’une autre` : ''].filter(Boolean).join(', '));
	const LIGNES_FETES = [
		{ libelle: 'Noël', cle: 'noel' },
		{ libelle: 'Nouvel An', cle: 'nouvelAn' }
	] as const;
</script>

<div class="proposition">
	<section aria-labelledby="etat-equipes">
		<h3 id="etat-equipes">État des équipes</h3>
		<p class="doux">Au 1er janvier {p.annee}, avec le calcul d’armement du FPT.</p>
		<ul role="list" class="equipes">
			{#each p.equipes as e (e.id)}
				<li style:--equipe={e.couleur}>
					<span>{etatEquipe(e)}</span>
					{#if e.arme}<Pastille ton="ok">Complète</Pastille>{:else}<Pastille ton="alerte">Incomplète</Pastille>{/if}
				</li>
			{/each}
		</ul>
		{#if incompletes}
			<p class="doux">L’appli signale seulement : aucun agent n’est déplacé. Pour ajuster : <a href="/agents">Agents</a> ou <a href="/nominations">Nominations</a>.</p>
		{/if}
	</section>

	<section aria-labelledby="roulement-fetes">
		<h3 id="roulement-fetes">Roulement et fêtes</h3>
		{#if p.precedente}
			<p>Continue le roulement de {p.annee - 1} : {nom(p.ordre[0] ?? null)} prend la relève de janvier.</p>
		{:else}
			<p>{p.annee - 1} n’a pas de planning : le roulement de base du centre, {nom(p.ordre[0] ?? null)} en premier.</p>
		{/if}
		<ul role="list" class="fetes">
			{#each LIGNES_FETES as f (f.cle)}
				{@const fete = p.fetes[f.cle]}
				<li><strong>{f.libelle}</strong> : {nom(fete.equipeId)}{#if fete.equipeId !== null} <span class="doux">({fete.dansLeTour ? 'dans son tour' : 'hors de son tour'})</span>{/if}</li>
			{/each}
		</ul>
		{#if compromis}<p class="encadre">{compromis}</p>{/if}
		{#each p.fetes.deSuite as id (id)}<p class="encadre">{nom(id)} tient deux semaines de suite en fin d’année.</p>{/each}
		{#if p.changees.length}
			<details class="repli">
				<summary>{pluriel(p.changees.length, 'semaine changée', 'semaines changées')}</summary>
				<ul role="list" class="lignes">
					{#each p.changees as c (c.debut)}
						<li><span class="doux">S{c.numero}, {duAu(c.debut, finDeSemaine(c.debut))}</span><span>{nom(c.avant)} devient {nom(c.apres)}</span></li>
					{/each}
				</ul>
			</details>
		{:else}
			<p class="doux">Aucune semaine à changer.</p>
		{/if}
	</section>

	<section aria-labelledby="manoeuvres-reprises">
		<h3 id="manoeuvres-reprises">Manœuvres</h3>
		{#if p.manoeuvres.length}
			<details class="repli">
				<summary>{pluriel(p.manoeuvres.length, 'manœuvre reprise', 'manœuvres reprises')}</summary>
				<ul role="list" class="lignes">
					{#each p.manoeuvres as m (`${m.debut}-${m.theme}`)}
						<li><span><strong>{m.theme}</strong>, {m.lieu}</span><span class="doux">{momentLong(m.debut)}, {m.convoques === 'tous' ? 'tout le centre' : m.convoques.map(nom).join(', ')}{m.petitDejeuner ? ', petit-déjeuner' : ''}</span></li>
					{/each}
				</ul>
			</details>
			<p class="doux">À la même place dans le mois. {p.tourDeRole ? 'Le tour de rôle continue. ' : ''}Rien n’est annoncé avant la publication de l’année.</p>
		{:else}
			<p class="doux">Aucune manœuvre à reprendre.</p>
		{/if}
		{#if ecartees}<p class="doux">Écartées : {ecartees}.</p>{/if}
	</section>

	<section class="resume" aria-labelledby="resume-proposition">
		<h3 id="resume-proposition">Résumé</h3>
		<p>{resumeProposition(p, equipes)}</p>
		{#if !p.vacances}<p class="doux">Les vacances scolaires ne sont pas reprises : saisissez-les ou importez-les à l’étape Repères.</p>{/if}
		<form
			method="POST"
			{action}
			class="gestes"
			use:enhance={() => {
				envoi = true;
				return async ({ update }) => {
					await update();
					envoi = false;
				};
			}}
		>
			<Bouton type="submit" desactive={envoi}>Accepter et écrire le brouillon</Bouton>
			<a class="non" href={fermer} data-sveltekit-reset="false">Non merci</a>
		</form>
	</section>
</div>

<style>
	.proposition,
	section {
		display: flex;
		flex-direction: column;
	}
	.proposition {
		gap: var(--espace-20);
		margin-top: var(--espace-8);
	}
	section {
		gap: var(--espace-8);
	}
	h3,
	p,
	ul {
		margin: 0;
	}
	h3 {
		font: 700 var(--texte-18) var(--police-titre);
	}
	ul {
		padding: 0;
		list-style: none;
	}
	.doux {
		color: var(--doux);
	}
	.doux a {
		color: var(--encre);
		font-weight: 600;
	}
	.equipes {
		display: flex;
		flex-direction: column;
		gap: var(--espace-6);
	}
	.equipes li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--espace-6) var(--espace-12);
		padding: var(--espace-8) var(--espace-12);
		border-left: 6px solid var(--equipe);
		border-radius: var(--rayon-petit);
		background: color-mix(in srgb, var(--equipe) 10%, var(--surface));
	}
	.encadre {
		padding: var(--espace-12) var(--espace-16);
		border: 1px solid var(--statut-alerte-trait);
		border-radius: var(--rayon-petit);
		background: var(--statut-alerte-fond);
		color: var(--statut-alerte-texte);
		font-weight: 600;
	}
	.repli {
		border: 1px solid var(--trait-doux);
		border-radius: var(--rayon-grand);
		padding: 0 var(--espace-12);
	}
	.repli[open] {
		padding-bottom: var(--espace-12);
	}
	.repli summary {
		min-height: var(--cible);
		display: flex;
		align-items: center;
		gap: var(--espace-12);
		font-weight: 600;
		cursor: pointer;
		list-style: none;
	}
	.repli summary::-webkit-details-marker {
		display: none;
	}
	.repli summary::before {
		content: '';
		width: 8px;
		height: 8px;
		border-right: 2px solid currentColor;
		border-bottom: 2px solid currentColor;
		transform: rotate(-45deg);
	}
	.repli[open] summary::before {
		transform: rotate(45deg);
	}
	.lignes {
		display: flex;
		flex-direction: column;
		gap: var(--espace-8);
	}
	.lignes li {
		display: flex;
		flex-direction: column;
	}
	.resume {
		padding: var(--espace-12) var(--espace-16);
		border: 1px solid var(--trait);
		border-radius: var(--rayon-grand);
	}
	.gestes {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--espace-8) var(--espace-16);
		margin-top: var(--espace-4);
	}
	.non {
		min-height: var(--cible);
		display: inline-flex;
		align-items: center;
		font-weight: 600;
		color: var(--encre);
	}
</style>
