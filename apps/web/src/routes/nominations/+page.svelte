<script lang="ts">
	import { enhance } from '$app/forms';
	import { tick } from 'svelte';
	import Bouton from '#lib/ui/Bouton.svelte';
	import Champ from '#lib/ui/Champ.svelte';
	import Choix from '#lib/ui/Choix.svelte';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';
	import IconeRole from '#lib/ui/IconeRole.svelte';
	import Pastille from '#lib/ui/Pastille.svelte';
	import Recherche from '#lib/ui/Recherche.svelte';
	import { aPourvoir } from '#lib/nominations.ts';
	import { pluriel } from '#lib/pluriel.ts';

	let { data, form } = $props();

	type Titulaire = (typeof data.roles)[number]['titulaires'][number];
	type Role = (typeof data.roles)[number];

	const date = (jour: string | null) => (jour ? jour.split('-').reverse().join('/') : '—');
	const periode = (t: Titulaire) => (t.fin ? `du ${date(t.debut)} au ${date(t.fin)}` : `depuis le ${date(t.debut)}`);
	const nomDe = (t: Titulaire) => `${t.personne.prenom} ${t.personne.nom}`;
	const intitule = (t: Titulaire) => (t.perimetre.nom ? `${nomDe(t)} — ${t.perimetre.nom}` : nomDe(t));
	const perimetreDe = (r: Role) => (r.portee === 'centre' ? 'Tout le centre' : r.perimetres.map((p) => p.nom).join(', '));
	const concerne = (cible: string) => form?.cible === cible;

	// Le panneau ouvert : celui d'un formulaire refusé (il reste ouvert avec ses erreurs), sinon celui de l'adresse.
	// Une réussite le ferme. Avec JavaScript, les boutons l'ouvrent et le ferment sans recharger.
	const refuse = (motif: RegExp) => {
		const trouve = form && !form.succes ? motif.exec(String(form.cible ?? '')) : null;
		return trouve ? Number(trouve[1]) : null;
	};
	let nommer = $derived(form?.succes ? null : (refuse(/^attribuer-(\d+)$/) ?? data.nommer));
	let retirer = $derived(form?.succes ? null : (refuse(/^(?:terminer|finir)-(\d+)$/) ?? data.retirer));

	// La réussite s'annonce dans la carte du rôle, même si le titulaire a quitté la liste.
	const annonce = (role: number) => (form?.succes && (form.role === role || concerne(`attribuer-${role}`)) ? form.message : null);

	const vides = $derived(aPourvoir(data.roles));
	const phrase = $derived(vides === 0 ? 'Chaque rôle a son titulaire.' : `${pluriel(vides, 'rôle')} à pourvoir.`);

	// Recherche d'un rôle ou d'un agent, sans accents ni majuscules.
	let recherche = $derived(data.recherche);
	const simple = (texte: string) => texte.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
	const visibles = $derived.by(() => {
		const cherche = simple(recherche);
		return cherche ? data.roles.filter((r) => [r.nom, ...r.titulaires.map(nomDe)].some((texte) => simple(texte).includes(cherche))) : data.roles;
	});

	// Annoncé à chaque frappe (RGAA 7.5) ; rien sans recherche.
	const resultat = $derived.by(() => {
		if (!simple(recherche)) return '';
		if (visibles.length === 0) return `Aucun rôle ni agent ne correspond à « ${recherche.trim()} ».`;
		return visibles.length === 1 ? '1 rôle correspond.' : `${visibles.length} rôles correspondent.`;
	});

	const agents = $derived(data.agents.map((a) => ({ valeur: String(a.id), libelle: `${a.nom} (${a.equipe})` })));
	// Rouvert par l'agent, le volet repart à neuf : la réponse déjà vue (erreurs, saisie) ne s'y affiche plus.
	let vue = $state.raw<typeof form>(null);
	const pourVolet = (cible: string) => concerne(cible) && form !== vue;
	// La saisie réaffichée ne vaut que pour le rôle qui l'a produite.
	const saisie = (cible: string, cle: string, defaut: string) => (pourVolet(cible) ? (form?.valeurs?.[cle] ?? defaut) : defaut);

	const focaliser = async (...ids: string[]) => {
		await tick();
		for (const id of ids) {
			const element = document.getElementById(id);
			if (element) return element.focus();
		}
	};

	const ouvrirNommer = async (e: MouseEvent, role: number) => {
		e.preventDefault();
		retirer = null;
		vue = form;
		// Fermé par Échap, le volet n'est retiré qu'à l'événement « close », qui arrive un peu après :
		// un appui entre les deux le recrée à neuf, et l'ancien, détaché, ne referme plus rien.
		if (nommer === role) {
			nommer = null;
			await tick();
		}
		nommer = role;
	};
	const fermerNommer = (role: number) => {
		nommer = null;
		focaliser(`nommer-${role}`);
	};
	// Le panneau rendu par le serveur (sans JavaScript) devient une fenêtre : focus dedans, Échap la ferme.
	const enFenetre = (fenetre: HTMLDialogElement) => {
		if (fenetre.open) fenetre.close();
		fenetre.showModal();
		fenetre.querySelector('select')?.focus();
	};

	const demanderRetrait = (e: MouseEvent, titulaire: number) => {
		e.preventDefault();
		nommer = null;
		retirer = titulaire;
		focaliser(`retrait-${titulaire}`);
	};
	const annulerRetrait = (e: MouseEvent, titulaire: number) => {
		e.preventDefault();
		retirer = null;
		focaliser(`titulaire-${titulaire}`);
	};

	// Après un refus, le focus va au premier champ en erreur de la zone, sinon à son message.
	const focaliserErreur = async (zone: string) => {
		await tick();
		const conteneur = document.getElementById(zone);
		(conteneur?.querySelector<HTMLElement>('[aria-invalid="true"]') ?? conteneur?.querySelector<HTMLElement>('[role="alert"]'))?.focus();
	};

	// Une seule soumission à la fois par formulaire ; après une réussite, le focus revient dans la carte.
	let envoi = $state<string | null>(null);
	const surEnvoi = (cible: string, apres: string[], zone: string) => () => {
		envoi = cible;
		return async ({ update, result }: { update: () => Promise<void>; result: { type: string } }) => {
			try {
				await update();
			} finally {
				envoi = null;
			}
			if (result.type === 'success') focaliser(...apres);
			else if (result.type === 'failure') focaliserErreur(zone);
		};
	};
</script>

<svelte:head>
	<title>Nominations · Gyro Caserne</title>
</svelte:head>

<div class="page">
	<EnTetePage titre="Nominations" phrase={phrase} retour={{ href: '/caserne', libelle: 'Caserne' }} />

	<!-- Sans JavaScript, ce formulaire porte la recherche et les boutons « Nommer » et « Retirer » (par l'adresse). -->
	<form id="choix" method="GET" role="search" onsubmit={(e) => e.preventDefault()}>
		<Recherche id="q" name="q" valeur={recherche} libelle="Rechercher un rôle ou un agent" aide="Un rôle ou un agent : pharmacie, Martin…" oninput={(v) => (recherche = v)} />
	</form>

	<p role="status" class="resultat">{resultat}</p>

	<div class="roles pile">
		{#each visibles as r (r.responsabiliteId)}
			{@const id = r.responsabiliteId}
			{@const cible = `attribuer-${id}`}
			{@const erreurs = pourVolet(cible) ? (form?.erreurs ?? {}) : {}}
			{@const message = annonce(id)}
			<section class="role" aria-labelledby="role-{id}">
				<div class="tete">
					<IconeRole icone={r.icone} />
					<div class="textes">
						<h2 id="role-{id}" tabindex="-1">{r.nom}</h2>
						<p class="note">{perimetreDe(r)}</p>
					</div>
					<button id="nommer-{id}" form="choix" name="nommer" value={id} class="nommer" aria-describedby="role-{id}" onclick={(e) => ouvrirNommer(e, id)}>Nommer</button>
					{#if r.titulaires.length === 0}
						<div class="titulaires"><Pastille ton="alerte">À pourvoir</Pastille></div>
					{:else}
						<ul class="titulaires" aria-label="Titulaires">
							{#each r.titulaires as t (t.id)}
								<li>
									<button
										id="titulaire-{t.id}"
										form="choix"
										name="retirer"
										value={t.id}
										class="titulaire"
										aria-label="Retirer {intitule(t)}"
										aria-expanded={retirer === t.id ? 'true' : 'false'}
										onclick={(e) => demanderRetrait(e, t.id)}>{intitule(t)}<span class="croix" aria-hidden="true">×</span></button
									>
								</li>
							{/each}
						</ul>
					{/if}
				</div>

				<div role="status">{#if message}<p class="succes">{message}</p>{/if}</div>

				{#each r.titulaires.filter((t) => t.id === retirer) as t (t.id)}
					{@const terminer = `terminer-${t.id}`}
					{@const finir = `finir-${t.id}`}
					{@const refus = (concerne(terminer) || concerne(finir)) && !form?.succes ? (form?.erreurs?.confirmation ?? form?.message) : null}
					<div id="etape-{t.id}" class="etape" role="group" aria-labelledby="retrait-{t.id}">
						<p id="retrait-{t.id}" tabindex="-1"><strong>Retirer {intitule(t)} ?</strong> <span class="note">Rôle tenu {periode(t)}.</span></p>
						{#if refus}<p class="echec" role="alert" tabindex="-1">{refus}</p>{/if}
						<form method="POST" action="?/terminer" use:enhance={surEnvoi(terminer, [`role-${id}`], `etape-${t.id}`)}>
							<input type="hidden" name="attributionId" value={t.id} />
							<input type="hidden" name="responsabiliteId" value={id} />
							<input type="hidden" name="confirmation" value="oui" />
							<Bouton type="submit" desactive={envoi === terminer}>Confirmer le retrait</Bouton>
						</form>
						<form method="POST" action="?/finir" class="finir" use:enhance={surEnvoi(finir, [`titulaire-${t.id}`, `role-${id}`], `etape-${t.id}`)}>
							<input type="hidden" name="attributionId" value={t.id} />
							<input type="hidden" name="responsabiliteId" value={id} />
							<Champ
								id="nouvelle-fin-{t.id}"
								name="fin"
								type="date"
								libelle="Ou choisir la date de fin"
								valeur={concerne(finir) ? (form?.valeurs?.fin ?? t.fin ?? '') : (t.fin ?? '')}
								erreur={concerne(finir) ? form?.erreurs?.fin : undefined}
							/>
							<Bouton type="submit" variante="secondaire" desactive={envoi === finir}>Changer la date de fin</Bouton>
						</form>
						<button form="choix" class="bouton secondaire" onclick={(e) => annulerRetrait(e, t.id)}>Annuler</button>
					</div>
				{/each}

				{#if nommer === id}
					{@const datesEnCause = Boolean(erreurs.debut || erreurs.fin)}
					<dialog
						id="volet-{id}"
						class="volet"
						open
						aria-labelledby="titre-nommer-{id}"
						onclose={(e) => {
							if (!e.currentTarget.open && e.currentTarget.isConnected) fermerNommer(id);
						}}
						{@attach enFenetre}
					>
						<h3 id="titre-nommer-{id}">Nommer : {r.nom}</h3>
						<div role="alert" tabindex="-1">
							{#if pourVolet(cible) && !form?.succes && (form?.message || form?.erreurs)}<p class="echec">{form?.message ?? 'Le formulaire contient des erreurs.'}</p>{/if}
						</div>
						<form method="POST" action="?/attribuer" use:enhance={surEnvoi(cible, [`nommer-${id}`], `volet-${id}`)}>
							<input type="hidden" name="responsabiliteId" value={id} />
							<Choix id="agent-{id}" name="personneId" libelle="Agent" valeur={saisie(cible, 'personneId', '')} options={[{ valeur: '', libelle: 'Choisissez un agent' }, ...agents]} erreur={erreurs.personneId} />
							{#if r.portee === 'centre'}
								<input type="hidden" name="perimetre" value="centre" />
							{:else if r.perimetres.length === 1}
								<input type="hidden" name="perimetre" value={r.perimetres[0]!.id} />
							{:else}
								<Choix
									id="perimetre-{id}"
									name="perimetre"
									libelle={r.portee === 'equipe' ? 'Équipe' : 'Comité'}
									valeur={saisie(cible, 'perimetre', String(r.perimetres[0]?.id ?? ''))}
									erreur={erreurs.perimetreId}
									options={r.perimetres.map((p) => ({ valeur: String(p.id), libelle: p.nom }))}
								/>
							{/if}
							{#if r.perimetres.length === 1 && erreurs.perimetreId}<p class="echec">{erreurs.perimetreId}</p>{/if}
							<p class="note">À partir d’aujourd’hui, sans date de fin.</p>
							<details class="repli" open={datesEnCause}>
								<summary>Changer les dates</summary>
								<div class="dates">
									<Champ id="debut-{id}" name="debut" type="date" libelle="Début" requis valeur={saisie(cible, 'debut', data.aujourdhui)} erreur={erreurs.debut} />
									<Champ id="fin-{id}" name="fin" type="date" libelle="Fin" aide="Facultative : sans date, le rôle dure jusqu'à ce qu'on le termine." valeur={saisie(cible, 'fin', '')} erreur={erreurs.fin} />
								</div>
							</details>
							<div class="boutons">
								<Bouton type="submit" desactive={envoi === cible}>Nommer</Bouton>
								<button form="choix" class="bouton secondaire" onclick={(e) => (e.preventDefault(), fermerNommer(id))}>Annuler</button>
							</div>
						</form>
					</dialog>
				{/if}
			</section>
		{/each}
	</div>
</div>

<style>
	.page,
	form,
	.etape,
	.dates {
		display: flex;
		flex-direction: column;
		gap: var(--espace-12);
	}
	.page {
		gap: var(--espace-16);
	}
	h2,
	h3,
	p {
		margin: 0;
	}
	.note {
		color: var(--doux);
		font-size: var(--texte-15);
	}
	.page {
		max-width: 60rem;
	}
	/* Les zones d'annonce vides ne creusent pas d'écart. */
	.resultat:empty {
		margin-top: -16px;
	}
	.role > div[role='status']:empty {
		margin-top: -10px;
	}
	.role {
		display: flex;
		flex-direction: column;
		gap: var(--espace-12);
		padding: var(--espace-12) var(--espace-16);
		background: var(--surface);
		border: 1px solid transparent;
		box-shadow: var(--ombre-carte);
		border-radius: var(--rayon-grand);
	}
	/* Icône, nom, « Nommer » ; les titulaires dessous, dans l'ordre du code (lecteurs d'écran, clavier). */
	.tete {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		grid-template-areas: 'icone textes nommer' '. titulaires titulaires';
		align-items: center;
		gap: var(--espace-8) var(--espace-12);
	}
	.tete > :global(.tuile) {
		grid-area: icone;
	}
	.textes {
		grid-area: textes;
	}
	.titulaires {
		grid-area: titulaires;
	}
	.nommer {
		grid-area: nommer;
		min-height: var(--cible);
		padding: 0 var(--espace-16);
		border: 1px solid var(--trait);
		border-radius: var(--rayon-bouton);
		background: var(--surface);
		color: var(--encre);
		font: 600 var(--texte-16) var(--police);
		cursor: pointer;
	}
	@media (hover: hover) and (pointer: fine) {
		.nommer:hover {
			border-color: var(--encre);
		}
	}
	h2 {
		font: 600 var(--texte-16)/1.3 var(--police);
		overflow-wrap: anywhere;
	}
	h3 {
		font: 700 var(--texte-20) var(--police-titre);
	}
	.bouton {
		min-height: var(--cible);
		padding: 0 var(--espace-16);
		border-radius: var(--rayon-petit);
		font: 700 var(--texte-16) var(--police);
		cursor: pointer;
	}
	.secondaire {
		background: transparent;
		color: var(--encre);
		border: 1px solid var(--trait);
		font-weight: 600;
	}
	.titulaires {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: var(--espace-8);
	}
	.titulaire {
		display: inline-flex;
		align-items: center;
		gap: var(--espace-6);
		min-height: var(--cible);
		padding: 0 var(--espace-8) 0 var(--espace-16);
		border: 1px solid var(--statut-info-trait);
		border-radius: 999px;
		background: var(--statut-info-fond);
		color: var(--statut-info-texte);
		font: 600 var(--texte-16) var(--police);
		text-align: left;
		cursor: pointer;
	}
	.croix {
		font-size: var(--texte-20);
		line-height: 1;
	}
	.etape {
		padding-top: var(--espace-12);
		border-top: 1px solid var(--trait-doux);
	}
	.etape :global(button),
	.boutons :global(button) {
		align-self: flex-start;
	}
	.boutons {
		display: flex;
		flex-wrap: wrap;
		gap: var(--espace-12);
	}
	.succes,
	.echec {
		padding: var(--espace-12) var(--espace-16);
		border-radius: var(--rayon-petit);
		border: 1px solid var(--trait);
		font-weight: 600;
	}
	.echec {
		border-color: var(--accent);
	}
	summary {
		display: flex;
		align-items: center;
		min-height: var(--cible);
		font-weight: 600;
		color: var(--statut-info-texte);
		cursor: pointer;
	}
	/* Sans JavaScript, le panneau s'ouvre dans la carte ; avec, c'est un volet qui monte du bas de l'écran. */
	.volet {
		position: static;
		margin: 0;
		padding: var(--espace-16);
		border: 1px solid var(--trait-doux);
		border-radius: var(--rayon-bouton);
		background: var(--surface);
		color: var(--encre);
	}
	.volet:modal {
		position: fixed;
		inset: auto 0 0 0;
		box-sizing: border-box;
		width: 100%;
		max-width: 560px;
		max-height: 90dvh;
		margin: 0 auto;
		overflow: auto;
		border-radius: var(--rayon-grand) var(--rayon-grand) 0 0;
	}
	.volet::backdrop {
		background: rgb(17 23 31 / 0.45);
	}
	.volet h3 {
		margin-bottom: var(--espace-12);
	}
	@media (min-width: 900px) {
		.volet:modal {
			inset: 0;
			margin: auto;
			height: fit-content;
			border-radius: var(--rayon-grand);
		}
	}
</style>
