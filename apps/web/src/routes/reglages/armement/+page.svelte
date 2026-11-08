<script lang="ts">
	import Choix from '#lib/ui/Choix.svelte';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { LIBELLES_NIVEAU, LIBELLES_POSTE, NIVEAUX, POSTES, type Poste, type Postes } from '@gyro-caserne/socle';
	import Panneau from '#lib/planning/Panneau.svelte';
	import { texteEngin } from '#lib/planning/ete.ts';
	import Bouton from '#lib/ui/Bouton.svelte';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';

	let { data, form } = $props();
	const r = $derived(data.armement);
	const LIBELLES_POSTES: Record<Poste, string> = { ...LIBELLES_POSTE, ca2: 'CA tout engins', cod1: 'Conducteur (COD1 au moins)', ce: 'CE', agent: 'Agent' };
	const POSTES_MAX = 8;
	const ouvert = $derived(r.engins.find((e) => e.nom === data.engin) ?? null);
	// Les postes de l'engin ouvert, modifiés par − et + avant d'enregistrer.
	const depart = (): Postes => ({ ...(data.armement.engins.find((e) => e.nom === data.engin)?.postes ?? { ca2: 0, ca1: 0, ce: 0, cod1: 0, agent: 0 }) });
	let postes = $state<Postes>(depart());
	let annonce = $state('');
	$effect.pre(() => {
		if (ouvert) postes = { ...ouvert.postes };
	});
	const total = $derived(POSTES.reduce((n, p) => n + postes[p], 0));
	// Le − s'arrête à zéro et à un poste en tout ; le + à huit en tout. Les boutons restent focalisables (aria-disabled).
	const bloque = (p: Poste, de: number) => (de < 0 ? postes[p] === 0 || total <= 1 : total >= POSTES_MAX);
	const changer = (p: Poste, de: number) => {
		if (bloque(p, de)) return;
		postes[p] += de;
		annonce = `${LIBELLES_POSTES[p]} : ${postes[p]}`;
	};
	// Le panneau se ferme une fois enregistré.
	// Le message de réussite est gardé : la navigation qui ferme le panneau efface `form`.
	let reussite = $state('');
	const fermer = () => async ({ update, result }: { update: (o?: { reset?: boolean }) => Promise<void>; result: { type: string; data?: Record<string, unknown> } }) => {
		reussite = '';
		await update({ reset: false });
		if (result.type === 'success') {
			await goto('?', { replaceState: true });
			reussite = String(result.data?.succes ?? '');
		}
	};
	const garder = () => async ({ update }: { update: (o?: { reset?: boolean }) => Promise<void> }) => update({ reset: false });
</script>

<svelte:head>
	<title>Armement des engins · Réglages · Gyro Caserne</title>
</svelte:head>

{#snippet retours()}
	<div role="status" class="masque">{form?.succes ?? reussite}</div>
	{#if form?.succes ?? reussite}<p class="succes">{form?.succes ?? reussite}</p>{/if}
	{#if form?.message}<p class="echec" role="alert">{form.message}</p>{/if}
{/snippet}

<div class="page">
	<EnTetePage titre="Armement des engins" phrase="L’équipage de chaque engin. Une personne tient un seul poste ; un agent plus qualifié peut tenir un poste en dessous. Le planning d’été vise le FPT : s’il est armé, les autres le sont." />

	{#if !ouvert}{@render retours()}{/if}

	<ul class="rangees" role="list">
		{#each r.engins as e (e.nom)}
			<li>
				<div class="texte">
					<p class="titre">{e.nom}{#if e.nom === 'FPT'}<span class="doux">{' '}· calculé pour l’été</span>{/if}</p>
					<p class="doux">{texteEngin(e.postes)}</p>
				</div>
				<a class="lien-bouton" href="?engin={e.nom}" data-sveltekit-reset="false">Modifier<span class="masque">{' '}le {e.nom}</span></a>
			</li>
		{/each}
	</ul>

	<details class="repli">
		<summary>Correspondance des aptitudes</summary>
		<form method="POST" action="?/enregistrer" use:enhance={garder}>
			<p class="doux">Quelle aptitude du centre donne chaque niveau. Un CA tout engins tient aussi les postes CA 1 agrès et CE ; un CA 1 agrès, le poste CE ; un COD2, le poste de conducteur COD1.</p>
			<div class="niveaux">
				{#each NIVEAUX as n (n)}
					<Choix id="niveau-{n}" name="niveau-{n}" libelle={LIBELLES_NIVEAU[n]} valeur={r.niveaux[n] === null ? '' : String(r.niveaux[n])} options={[{ valeur: '', libelle: 'Aucune' }, ...data.aptitudes.map((a) => ({ valeur: String(a.id), libelle: a.nom }))]} />
				{/each}
			</div>
			<div><Bouton type="submit" variante="secondaire">Enregistrer la correspondance</Bouton></div>
		</form>
	</details>
</div>

{#if ouvert}
	<Panneau titre={ouvert.nom} fermer="?">
		<form method="POST" action="?/enregistrer&engin={ouvert.nom}" use:enhance={fermer} class="formulaire">
			<p class="doux">De 1 à {POSTES_MAX} postes ({total} aujourd’hui).</p>
			<ul class="compteurs" role="list">
				{#each POSTES as p (p)}
					<li>
						<span class="nom" id="poste-{p}">{LIBELLES_POSTES[p]}</span>
						<span class="reglage" role="group" aria-labelledby="poste-{p}">
							<button type="button" class="pas" aria-label="Un poste {LIBELLES_POSTES[p]} de moins ({postes[p]} actuellement)" aria-disabled={bloque(p, -1)} onclick={() => changer(p, -1)}>−</button>
							<output class="valeur" aria-hidden="true">{postes[p]}</output>
							<button type="button" class="pas" aria-label="Un poste {LIBELLES_POSTES[p]} de plus ({postes[p]} actuellement)" aria-disabled={bloque(p, 1)} onclick={() => changer(p, 1)}>+</button>
						</span>
						<input type="hidden" name="{ouvert.nom}-{p}" value={postes[p]} />
					</li>
				{/each}
			</ul>
			<p role="status" class="masque">{annonce}</p>
			{@render retours()}
			<Bouton type="submit">Enregistrer</Bouton>
		</form>
	</Panneau>
{/if}

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--espace-16);
		max-width: var(--largeur-liste);
		margin-inline: auto;
	}
	p {
		margin: 0;
	}
	.doux {
		color: var(--doux);
	}
	.rangees {
		margin: 0;
		padding: 0;
		list-style: none;
		background: var(--surface);
		border: 1px solid transparent;
		box-shadow: var(--ombre-carte);
		border-radius: var(--rayon-grand);
	}
	.rangees li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--espace-12);
		padding: var(--espace-12) var(--espace-16);
	}
	.rangees li + li {
		border-top: 1px solid var(--trait-doux);
	}
	.texte {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.titre {
		font: 700 var(--texte-18) var(--police-titre);
	}
	.lien-bouton {
		flex: none;
		min-height: var(--cible);
		display: inline-flex;
		align-items: center;
		padding: 0 var(--espace-16);
		border: 1px solid var(--trait);
		border-radius: var(--rayon-bouton);
		background: var(--surface);
		color: var(--encre);
		font-weight: 600;
		text-decoration: none;
	}
	.repli {
		padding: 0 var(--espace-16);
		background: var(--surface);
		border: 1px solid transparent;
		box-shadow: var(--ombre-carte);
		border-radius: var(--rayon-grand);
	}
	.repli summary {
		min-height: var(--cible);
		display: flex;
		align-items: center;
		font-weight: 700;
		cursor: pointer;
	}
	.repli form {
		display: flex;
		flex-direction: column;
		gap: var(--espace-12);
		padding-bottom: var(--espace-16);
	}
	.niveaux {
		display: grid;
		grid-template-columns: 1fr;
		gap: var(--espace-8);
	}
	.formulaire {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: var(--espace-12);
	}
	.compteurs {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.compteurs li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--espace-12);
		min-height: var(--cible);
		padding: var(--espace-6) 0;
	}
	.compteurs li + li {
		border-top: 1px solid var(--trait-doux);
	}
	.nom {
		font-weight: 600;
	}
	.reglage {
		display: inline-flex;
		align-items: center;
		gap: var(--espace-4);
	}
	.pas {
		width: var(--cible);
		height: var(--cible);
		border-radius: var(--rayon-bouton);
		border: 1px solid var(--trait);
		background: var(--surface);
		color: var(--encre);
		font: 700 var(--texte-20)/1 var(--police-titre);
		cursor: pointer;
	}
	.pas[aria-disabled='true'] {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.valeur {
		min-width: 2rem;
		text-align: center;
		font-weight: 700;
		font-size: var(--texte-18);
	}
	.succes {
		padding: var(--espace-12) var(--espace-16);
		border-radius: var(--rayon-petit);
		background: var(--statut-ok-fond);
		color: var(--statut-ok-texte);
		border: 1px solid var(--statut-ok-trait);
		font-weight: 600;
	}
	.echec {
		padding: var(--espace-12) var(--espace-16);
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
		.niveaux {
			grid-template-columns: 1fr 1fr;
			column-gap: var(--espace-24);
		}
	}
</style>
