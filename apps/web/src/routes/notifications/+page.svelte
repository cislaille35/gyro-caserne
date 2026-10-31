<script lang="ts">
	import type { LigneFil, Signalement } from '@gyro-caserne/socle';
	import { enhance, type SubmitFunction } from '$app/forms';
	import { tick } from 'svelte';
	import { heure, jourEtHeure } from '#lib/murs/quand.ts';
	import { pluriel } from '#lib/pluriel.ts';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';
	import Vide from '#lib/ui/Vide.svelte';
	import Visage from '#lib/ui/Visage.svelte';

	let { data, form }: { data: { lignes: LigneFil[]; nonLues: number; aujourdhui: string; signalements: Signalement[]; confirmer: number | null }; form?: { message?: string; succes?: string } | null } = $props();

	// Le fil, du plus récent au plus ancien : « Aujourd'hui », puis « Plus tôt ».
	const groupes = $derived(
		[
			{ titre: 'Aujourd’hui', lignes: data.lignes.filter((l) => l.creeLe.slice(0, 10) === data.aujourdhui) },
			{ titre: 'Plus tôt', lignes: data.lignes.filter((l) => l.creeLe.slice(0, 10) !== data.aujourdhui) }
		].filter((g) => g.lignes.length > 0)
	);
	const phrase = $derived(data.nonLues > 0 ? `${pluriel(data.nonLues, 'notification')} non ${data.nonLues > 1 ? 'lues' : 'lue'}.` : data.lignes.length > 0 ? 'Tout est lu.' : undefined);
	const quoi = (l: LigneFil) => `${l.auteur.prenom} ${l.auteur.nom}`.trim() + (l.type === 'commentaire' ? ' a commenté votre publication' : ` a publié dans ${l.nomMur}`);
	const moment = (l: LigneFil) => (l.creeLe.slice(0, 10) === data.aujourdhui ? heure(l.creeLe) : jourEtHeure(l.creeLe));

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

<div class="page">
<EnTetePage titre="Notifications" {phrase}>
	{#snippet secondaire()}
		{#if data.nonLues > 0}
			<form method="POST" action="?/toutLu" use:enhance>
				<button type="submit" class="secondaire tout-lu">Tout marquer comme lu</button>
			</form>
		{/if}
	{/snippet}
</EnTetePage>
<p class="masque" role="status">{succes}</p>
<p class="erreur" class:masque={!refus} role="alert">{refus}</p>

{#if data.signalements.length > 0}
	<section class="signalements" aria-labelledby="t-signalements">
		<h2 id="t-signalements" class="rubrique" tabindex="-1">Messages signalés</h2>
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
					{#if s.retirable && data.confirmer === s.id}
						<div class="confirmer-ici">
							<h3>Retirer ce message ?</h3>
							<p>Il disparaît pour tous les membres : « Message retiré par la modération » reste à sa place. Le signalement est classé.</p>
							<div class="choix">
								<a class="bouton secondaire" href="/notifications">Annuler</a>
								<form method="POST" action="?/retirer" use:enhance={apres}>
									<input type="hidden" name="id" value={s.id} />
									<button type="submit" class="danger">Retirer</button>
								</form>
							</div>
						</div>
					{/if}
					<div class="actions">
						{#if s.retirable && data.confirmer !== s.id}
							<a class="bouton danger" href="?retirer={s.id}" id="retirer-{s.id}" onclick={(e) => demanderRetrait(e, s)}>Retirer le message<span class="masque">{` de ${nom(s.auteur)}`}</span></a>
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

{#each groupes as g (g.titre)}
	<section class="groupe" aria-labelledby="t-{g.titre === 'Plus tôt' ? 'avant' : 'jour'}">
		<h2 id="t-{g.titre === 'Plus tôt' ? 'avant' : 'jour'}" class="rubrique">{g.titre}</h2>
		<ul class="liste" role="list">
			{#each g.lignes as l (l.id)}
				<li>
					<a class="ligne" class:non-lue={!l.lue} href="/echanges/{l.cle}/{l.publicationId}">
						<Visage prenom={l.auteur.prenom} nom={l.auteur.nom} couleur={l.auteur.couleur} taille={44} />
						<span class="corps">
							<span class="quoi">{#if !l.lue}<span class="masque">{'Non lu, '}</span>{/if}{quoi(l)}</span>
							{#if l.extrait}<span class="extrait">{l.extrait}</span>{/if}
							<span class="moment">{moment(l)}</span>
						</span>
						{#if !l.lue}<span class="point" aria-hidden="true"></span>{/if}
					</a>
				</li>
			{/each}
		</ul>
	</section>
{:else}
	{#if data.signalements.length === 0}
		<Vide titre="Rien de nouveau pour vous." texte="Les publications de vos murs et les commentaires sous les vôtres arriveront ici." action={{ href: '/echanges', libelle: 'Voir les échanges' }} />
	{/if}
{/each}
</div>

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
	.page {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	h2:focus {
		outline: none;
	}
	.groupe {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.ligne {
		min-height: 64px;
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 12px;
		border: 1px solid var(--trait-doux);
		border-radius: 18px;
		background: var(--surface);
		color: var(--encre);
		text-decoration: none;
	}
	.ligne:hover {
		border-color: var(--trait);
		box-shadow: 0 2px 10px color-mix(in srgb, var(--encre) 8%, transparent);
	}
	.ligne:hover .quoi {
		text-decoration: underline;
	}
	/* Non lue : liseré, titre en gras et point, jamais la couleur seule. */
	.non-lue {
		box-shadow: inset 4px 0 0 var(--rouge);
	}
	.non-lue .quoi {
		font-weight: 700;
	}
	.corps {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.quoi {
		font-weight: 500;
		line-height: 1.3;
		overflow-wrap: anywhere;
	}
	.extrait {
		color: var(--doux);
		font-size: 0.9375rem;
		overflow: hidden;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow-wrap: anywhere;
	}
	.moment {
		color: var(--doux);
		font-size: 0.8125rem;
	}
	.point {
		flex: none;
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--rouge);
	}
	.tout-lu {
		min-height: var(--cible);
		padding: 0 14px;
		white-space: nowrap;
	}
	.liste {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 8px;
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
	button,
	.bouton {
		min-height: var(--cible);
		display: inline-flex;
		align-items: center;
		text-decoration: none;
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
	a.danger:hover {
		background: var(--rouge-survol);
		color: var(--sur-rouge);
	}
	a.secondaire:hover {
		color: var(--encre);
	}
	.confirmer-ici {
		padding: 12px 14px;
		border-radius: 12px;
		background: var(--statut-danger-fond);
		color: var(--statut-danger-texte);
	}
	.confirmer-ici h3 {
		margin: 0 0 6px;
		font: 700 1.125rem var(--police-titre);
	}
	.confirmer-ici p {
		margin: 0 0 12px;
	}
	.erreur {
		margin: 0;
		padding: 12px 14px;
		border: 1px solid var(--statut-danger-trait);
		border-radius: var(--rayon-grand);
		background: var(--statut-danger-fond);
		color: var(--statut-danger-texte);
		font-weight: 600;
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
		.page {
			max-width: 44rem;
		}
	}
</style>
