<script lang="ts">
	import type { Signalement } from '@gyro-caserne/socle';
	import { enhance, type SubmitFunction } from '$app/forms';
	import { tick } from 'svelte';
	import { jourEtHeure } from '#lib/murs/quand.ts';
	import Vide from '#lib/ui/Vide.svelte';

	let { data, form }: { data: { annonces: { id: number; cle: string; nomMur: string; titre: string }[]; evenements: { id: number; cle: string; nomMur: string; titre: string; demain: boolean; reponse: string | null; sondage: boolean }[]; sondages: { id: number; cle: string; nomMur: string; titre: string }[]; signalements: Signalement[] }; form?: { message?: string; succes?: string } | null } = $props();

	// « Événement demain, à répondre et sondage à voter », « Événement avec sondage, à voter »…
	const quoiEvenement = (e: { demain: boolean; reponse: string | null; sondage: boolean }) =>
		`Événement${e.demain ? ' demain' : ''}${e.reponse === null ? `, à répondre${e.sondage ? ' et sondage à voter' : ''}` : ' avec sondage, à voter'}`;
	// Ce qu'il faut faire est écrit, pas seulement montré.
	const elements = $derived([
		...data.annonces.map((a) => ({ ...a, quoi: 'Annonce à prendre en compte' })),
		...data.evenements.map((e) => ({ ...e, quoi: quoiEvenement(e) })),
		...data.sondages.map((s) => ({ ...s, quoi: 'Sondage à répondre' }))
	]);

	const nom = (p: { prenom: string; nom: string }) => `${p.prenom} ${p.nom}`.trim() || 'Un ancien agent';
	const photo = (s: Signalement, id: number) => `/notifications/signalements/${s.id}/photo/${id}`;

	// La phrase du dernier geste : réussite dite par la zone d'état, refus par l'alerte.
	const succes = $derived(form?.succes ?? '');
	const refus = $derived(form?.message ?? '');

	// Retirer est sans retour : une confirmation, avec JavaScript.
	let aRetirer = $state<Signalement | null>(null);
	let dialogue = $state<HTMLDialogElement>();
	$effect(() => {
		if (aRetirer && dialogue && !dialogue.open) dialogue.showModal();
	});
	function demanderRetrait(e: MouseEvent, s: Signalement) {
		e.preventDefault();
		aRetirer = s;
	}
	function fermer() {
		const s = aRetirer;
		dialogue?.close();
		aRetirer = null;
		if (s) document.getElementById(`retirer-${s.id}`)?.focus();
	}

	// Après le geste, le signalement disparaît : le focus va au titre de la section, ou à celui de la page.
	const apres: SubmitFunction = () => {
		return async ({ update }) => {
			dialogue?.close();
			aRetirer = null;
			await update();
			await tick();
			(document.getElementById('t-signalements') ?? document.querySelector<HTMLElement>('h1'))?.focus();
		};
	};
</script>

<svelte:head>
	<title>Notifications · Gyro Caserne</title>
</svelte:head>

<h1 tabindex="-1">Notifications</h1>
<p class="masque" role="status">{succes}</p>
<p class="erreur" class:masque={!refus} role="alert">{refus}</p>

{#if data.signalements.length > 0}
	<section class="signalements" aria-labelledby="t-signalements">
		<h2 id="t-signalements" tabindex="-1">Messages signalés</h2>
		<p class="doux">Seul le message signalé vous est transmis, jamais le reste de la conversation.</p>
		<ul class="liste" role="list">
			{#each data.signalements as s (s.id)}
				<li class="signalement">
					<p class="auteur"><strong>{nom(s.auteur)}</strong> <span class="doux">· {jourEtHeure(s.envoye_le)}</span></p>
					<blockquote class:vide={!s.texte}>{s.texte || 'Sans texte'}</blockquote>
					{#if s.photos.length > 0}
						<div class="photos">
							{#each s.photos as id, i (id)}
								<img src={photo(s, id)} alt="Photo {i + 1} sur {s.photos.length} du message signalé" loading="lazy" />
							{/each}
						</div>
					{/if}
					<p class="doux">Signalé par {nom(s.par)}, {jourEtHeure(s.le)}</p>
					{#if !s.retirable}<p class="note">Ce message n’est plus dans la conversation : il ne reste qu’à classer le signalement.</p>{/if}
					<div class="actions">
						{#if s.retirable}
							<form method="POST" action="?/retirer" use:enhance={apres}>
								<input type="hidden" name="id" value={s.id} />
								<button type="submit" class="danger" id="retirer-{s.id}" onclick={(e) => demanderRetrait(e, s)}>Retirer le message<span class="masque">{` de ${nom(s.auteur)}`}</span></button>
							</form>
						{/if}
						<form method="POST" action="?/classer" use:enhance={apres}>
							<input type="hidden" name="id" value={s.id} />
							<button type="submit" class="secondaire">Classer<span class="masque">{` le signalement du message de ${nom(s.auteur)}`}</span></button>
						</form>
					</div>
				</li>
			{/each}
		</ul>
	</section>
{/if}

{#if elements.length > 0}
	{#if data.signalements.length > 0}<h2 class="rubrique">À faire</h2>{/if}
	<ul class="liste" role="list">
		{#each elements as e (`${e.quoi}:${e.id}`)}
			<li>
				<a class="ligne" href="/echanges/{e.cle}/{e.id}">
					<span class="texte"><span class="titre">{e.titre}</span><span class="doux">{e.quoi} · {e.nomMur}</span></span>
					<span aria-hidden="true">›</span>
				</a>
			</li>
		{/each}
	</ul>
{:else if data.signalements.length === 0}
	<Vide texte="Rien de nouveau pour vous." />
{/if}

{#if aRetirer}
	{@const s = aRetirer}
	<dialog class="confirmation" bind:this={dialogue} aria-labelledby="confirmation-titre" aria-describedby="confirmation-texte" onclose={() => aRetirer && fermer()}>
		<form method="POST" action="?/retirer" use:enhance={apres}>
			<input type="hidden" name="id" value={s.id} />
			<h2 id="confirmation-titre">Retirer ce message ?</h2>
			<p id="confirmation-texte">Il disparaît pour tous les membres : « Message retiré par la modération » reste à sa place. Le signalement est classé.</p>
			<div class="choix">
				<!-- svelte-ignore a11y_autofocus -->
				<button type="button" class="secondaire" autofocus onclick={fermer}>Annuler</button>
				<button type="submit" class="danger">Retirer</button>
			</div>
		</form>
	</dialog>
{/if}

<style>
	h1 {
		margin: 0 0 16px;
	}
	h1:focus,
	h2:focus {
		outline: none;
	}
	.liste {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.ligne {
		min-height: var(--cible);
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 10px 14px;
		background: var(--surface);
		border: 1px solid var(--trait-doux);
		border-radius: 12px;
		color: var(--encre);
		text-decoration: none;
	}
	.ligne:hover .titre {
		text-decoration: underline;
	}
	.texte {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.titre {
		font-weight: 700;
		overflow-wrap: anywhere;
	}
	.doux {
		margin: 0;
		color: var(--doux);
	}
	.rubrique,
	.signalements h2 {
		margin: 0;
		font: 700 1.25rem var(--police-titre);
	}
	.rubrique {
		margin: 24px 0 10px;
	}

	/* Messages signalés */
	.signalements {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.signalement {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 14px 16px;
		background: var(--surface);
		border: 1px solid var(--statut-danger-trait);
		border-left-width: 4px;
		border-radius: var(--rayon-grand);
	}
	.signalement p {
		margin: 0;
	}
	.auteur {
		overflow-wrap: anywhere;
	}
	blockquote {
		margin: 0;
		padding: 10px 14px;
		border-radius: 4px 16px 16px 16px;
		background: var(--fond);
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	blockquote.vide {
		color: var(--doux);
		font-style: italic;
	}
	.photos {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.photos img {
		width: 160px;
		max-width: 100%;
		aspect-ratio: 1;
		object-fit: cover;
		border-radius: 12px;
		border: 1px solid var(--trait-doux);
	}
	.note {
		color: var(--statut-alerte-texte);
		font-weight: 600;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	button {
		min-height: var(--cible);
		padding: 0 18px;
		border-radius: 999px;
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}
	.secondaire {
		border: 1px solid var(--trait);
		background: var(--surface);
		color: var(--encre);
	}
	.danger {
		border: 0;
		background: var(--rouge);
		color: var(--sur-rouge);
	}
	.erreur {
		margin: 0 0 12px;
		padding: 12px 14px;
		border: 1px solid var(--statut-danger-trait);
		border-radius: var(--rayon-grand);
		background: var(--statut-danger-fond);
		color: var(--statut-danger-texte);
		font-weight: 600;
	}
	.masque {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: 0;
		padding: 0;
		border: 0;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	.confirmation {
		max-width: min(24rem, calc(100vw - 32px));
		padding: 20px;
		border: 0;
		border-radius: 20px;
		background: var(--surface);
		color: var(--encre);
	}
	.confirmation::backdrop {
		background: color-mix(in srgb, #000 45%, transparent);
	}
	.confirmation h2 {
		margin: 0 0 8px;
		font: 700 1.25rem var(--police-titre);
	}
	.confirmation p {
		margin: 0 0 16px;
		color: var(--doux);
	}
	.choix {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
	}

	@media (min-width: 1024px) {
		h1,
		.signalements,
		.liste,
		.rubrique,
		.erreur {
			max-width: 44rem;
		}
	}
</style>
