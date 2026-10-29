<script lang="ts">
	import { enhance, type SubmitFunction } from '$app/forms';
	import { onMount, tick, untrack } from 'svelte';
	import { plat } from '#lib/messagerie/recherche.ts';
	import Bouton from '#lib/ui/Bouton.svelte';
	import Champ from '#lib/ui/Champ.svelte';
	import type { IconeRole } from '#lib/ui/icones-roles.ts';
	import Visage from '#lib/ui/Visage.svelte';
	import ChoixIcone from '../../../../reglages/ChoixIcone.svelte';

	let { data, form } = $props();

	// Après un refus de création, on reste sur l'étape du nom avec ce qui a été saisi.
	const etape = $derived(form ? 'nom' : data.etape);
	const valeurs = $derived(form?.valeurs ?? { nom: data.nom, icone: data.icone, membres: data.coches });
	const erreurs = $derived<Record<string, string>>(form?.erreurs ?? {});

	// Étape 1 : les cases cochées, et la recherche qui masque les autres sans les décocher.
	let choisis = $state<number[]>(untrack(() => [...data.coches]));
	let recherche = $state('');
	let erreurLocale = $state<string | null>(null);
	const erreurMembres = $derived(erreurLocale ?? data.erreur);
	const trouve = (a: { prenom: string; nom: string; surnom: string | null }) => plat(`${a.prenom} ${a.nom} ${a.surnom ?? ''}`).includes(plat(recherche));
	const aucune = $derived(recherche.trim() !== '' && !data.personnes.some(trouve));
	const personnesEnTexte = (n: number) => (n === 0 ? 'Aucune personne choisie' : `${n} ${n > 1 ? 'personnes choisies' : 'personne choisie'}`);

	// Sans JavaScript, la recherche ne filtrerait rien : elle n'apparaît qu'avec lui.
	let js = $state(false);
	onMount(() => (js = true));

	let liste = $state<HTMLElement>();
	const verifier = async (e: SubmitEvent) => {
		if (choisis.length > 0) return;
		e.preventDefault();
		erreurLocale = 'Choisissez au moins une personne.';
		await tick();
		liste?.querySelector<HTMLInputElement>('input[name="membres"]')?.focus();
	};

	// Étape 2 : les membres rappelés, et le retour à l'étape 1 qui garde tout.
	const membres = $derived(data.personnes.filter((a) => valeurs.membres.includes(a.id)));
	const modifier = $derived(`/echanges/messages/nouveau/groupe?${new URLSearchParams([...valeurs.membres.map((id) => ['membres', String(id)]), ['nom', valeurs.nom], ['icone', valeurs.icone]])}`);
	let envoi = $state(false);
	// Refusé : le premier champ en erreur prend le focus.
	const surEnvoi: SubmitFunction = () => {
		envoi = true;
		return async ({ update, result, formElement }) => {
			await update({ reset: false });
			envoi = false;
			await tick();
			if (result.type !== 'failure') return;
			// Le premier champ en erreur, dans l'ordre de la page ; pour les membres, le lien qui permet de les corriger.
			const selecteurs = [erreurs.nom && '[aria-invalid="true"]', erreurs.icone && '.icones input:checked', erreurs.icone && '.icones input', erreurs.membres && '.modifier'];
			for (const selecteur of selecteurs) {
				const cible = selecteur ? formElement.querySelector<HTMLElement>(selecteur) : null;
				if (cible) return cible.focus();
			}
		};
	};
	const annonce = $derived(form ? 'Le groupe n’a pas été créé : corrigez les erreurs.' : '');
</script>

<svelte:head>
	<title>{etape === 'nom' ? 'Nom et icône' : 'Membres'} · Nouveau groupe · Gyro Caserne</title>
</svelte:head>

<div class="page">
	<header class="entete">
		<a class="annuler" href="/echanges/messages/nouveau">Annuler</a>
		<h1>Nouveau groupe</h1>
	</header>
	<p class="etape">{etape === 'nom' ? 'Étape 2 sur 2 : nom et icône' : 'Étape 1 sur 2 : les membres'}</p>
	<div class="masque" role="alert">{annonce}</div>

	{#if etape === 'membres'}
		<div class="recherche" role="search" hidden={!js}>
			<label for="recherche" class="masque">Chercher un collègue</label>
			<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
			<input id="recherche" type="search" bind:value={recherche} placeholder="Nom, prénom ou surnom" autocomplete="off" />
		</div>

		<form method="get" onsubmit={verifier}>
			<input type="hidden" name="etape" value="nom" />
			<input type="hidden" name="nom" value={data.nom} />
			<input type="hidden" name="icone" value={data.icone} />
			<fieldset class="membres" aria-describedby={erreurMembres ? 'membres-erreur' : undefined} bind:this={liste}>
				<legend>Membres du groupe</legend>
				{#if erreurMembres}<p class="erreur" id="membres-erreur">{erreurMembres}</p>{/if}
				<p class="aucune" class:masque={!aucune} role="status">{aucune ? 'Personne à ce nom.' : ''}</p>
				<ul>
					{#each data.personnes as a (a.id)}
						<li hidden={!trouve(a)}>
							<label class="ligne">
								<Visage prenom={a.prenom} nom={a.nom} couleur={a.couleur} taille={44} />
								<span class="textes"><strong class="nom">{a.prenom} {a.nom}</strong>{#if a.sous}<span class="sous">{a.sous}</span>{/if}</span>
								<input type="checkbox" name="membres" value={a.id} bind:group={choisis} onchange={() => (erreurLocale = null)} />
								<span class="coche" aria-hidden="true"></span>
							</label>
						</li>
					{/each}
				</ul>
			</fieldset>
			<div class="barre">
				<span class="compte" aria-live="polite">{personnesEnTexte(choisis.length)}</span>
				<Bouton type="submit">Suivant</Bouton>
			</div>
		</form>
	{:else}
		<form method="POST" action="?/creer" class="formulaire" use:enhance={surEnvoi}>
			{#each valeurs.membres as id (id)}<input type="hidden" name="membres" value={id} />{/each}
			<Champ id="groupe-nom" name="nom" libelle="Nom du groupe" valeur={valeurs.nom} erreur={erreurs.nom} requis maxlength={60} aide="60 caractères au plus." />
			<ChoixIcone valeur={valeurs.icone as IconeRole} erreur={erreurs.icone} legende="Icône du groupe" />

			<section class="rappel" aria-labelledby="rappel-titre">
				<h2 id="rappel-titre">{valeurs.membres.length + 1} membres, vous compris</h2>
				<div class="visages" aria-hidden="true">
					{#each membres.slice(0, 8) as a (a.id)}<Visage prenom={a.prenom} nom={a.nom} couleur={a.couleur} taille={30} />{/each}
				</div>
				<p class="noms">{membres.map((a) => `${a.prenom} ${a.nom}`).join(', ')}</p>
				{#if erreurs.membres}<p class="erreur" id="rappel-erreur">{erreurs.membres}</p>{/if}
				<a class="modifier" href={modifier} aria-describedby={erreurs.membres ? 'rappel-erreur' : undefined}>Modifier les membres</a>
			</section>

			<div class="barre">
				<span class="compte">{valeurs.membres.length + 1} membres</span>
				<Bouton type="submit" desactive={envoi}>Créer</Bouton>
			</div>
		</form>
	{/if}
</div>

<style>
	/* À l'ordinateur, la page garde une largeur de lecture. */
	.page {
		max-width: 40rem;
		margin: 0 auto;
	}
	.entete {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 8px;
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
	.etape {
		margin: 0 0 12px;
		text-align: center;
		color: var(--doux);
		font-size: 0.875rem;
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
	.recherche input {
		flex: 1;
		min-height: var(--cible);
		padding: 0 16px 0 40px;
		border: 1px solid var(--trait);
		border-radius: 999px;
		background: var(--surface);
		color: var(--encre);
		font: inherit;
	}
	.recherche input::placeholder {
		color: var(--doux);
	}

	.membres {
		border: none;
		margin: 0;
		padding: 0;
		min-width: 0;
	}
	legend {
		padding: 0;
		margin: 12px 0 4px;
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
	li[hidden],
	.recherche[hidden] {
		display: none;
	}
	.ligne {
		position: relative;
		min-height: 60px;
		padding: 6px 8px;
		border-radius: var(--rayon-grand);
		display: flex;
		align-items: center;
		gap: 12px;
		cursor: pointer;
	}
	.ligne:hover {
		background: var(--surface);
	}
	.ligne:has(input:focus-visible) {
		outline: 3px solid var(--focus);
		outline-offset: -3px;
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
	.sous {
		color: var(--doux);
		font-size: 0.875rem;
	}
	/* La vraie case reste là pour le clavier et le lecteur d'écran ; on dessine une coche ronde par-dessus. */
	.ligne input {
		position: absolute;
		inset: 0;
		margin: 0;
		opacity: 0;
		cursor: pointer;
	}
	.coche {
		flex: none;
		width: 26px;
		height: 26px;
		border: 2px solid var(--doux);
		border-radius: 50%;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}
	/* Cochée : pleine, avec la coche, pas seulement une couleur. */
	.ligne:has(input:checked) .coche {
		border-color: var(--rouge);
		background: var(--rouge);
	}
	.ligne:has(input:checked) .coche::after {
		content: '';
		width: 12px;
		height: 7px;
		margin-top: -3px;
		border-left: 2.5px solid var(--sur-rouge);
		border-bottom: 2.5px solid var(--sur-rouge);
		transform: rotate(-45deg);
	}

	/* La barre reste en vue au-dessus de la barre de navigation, au téléphone. */
	.barre {
		position: sticky;
		bottom: calc(4.5rem + env(safe-area-inset-bottom));
		margin: 12px -8px 0;
		padding: 10px 12px;
		border: 1px solid var(--trait-doux);
		border-radius: var(--rayon-grand);
		background: var(--surface);
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		box-shadow: 0 4px 14px color-mix(in srgb, var(--encre) 12%, transparent);
	}
	.compte {
		font-weight: 600;
	}

	.formulaire {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}
	.rappel {
		padding: 14px 16px;
		border: 1px solid var(--trait-doux);
		border-radius: var(--rayon-grand);
		background: var(--surface);
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.rappel h2 {
		margin: 0;
		font-size: 1rem;
		font-weight: 700;
	}
	.visages {
		display: flex;
		padding-left: 6px;
	}
	.visages > :global(*) {
		margin-left: -6px;
	}
	.noms {
		margin: 0;
		color: var(--doux);
		font-size: 0.9375rem;
	}
	.modifier {
		align-self: flex-start;
		min-height: var(--cible);
		display: inline-flex;
		align-items: center;
		color: var(--encre);
		font-weight: 600;
	}

	.erreur {
		margin: 0 0 4px;
		color: var(--accent);
		font-weight: 600;
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

	@media (min-width: 1024px) {
		.barre {
			bottom: 16px;
		}
	}
</style>
