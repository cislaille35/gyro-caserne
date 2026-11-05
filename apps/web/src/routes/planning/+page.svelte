<script lang="ts">
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import type { Astreinte } from '@gyro-caserne/socle';
	import TirerPourActualiser from '#lib/animations/TirerPourActualiser.svelte';
	import CarteAstreinte from '#lib/planning/CarteAstreinte.svelte';
	import VueAnnee from '#lib/planning/VueAnnee.svelte';
	import VueMois from '#lib/planning/VueMois.svelte';
	import VueSemaine from '#lib/planning/VueSemaine.svelte';
	import { avecGroupe, phraseAstreinte } from '#lib/planning/astreinte.ts';
	import { jourLong, momentLong } from '#lib/planning/dates.ts';
	import { ETATS, titreDemande } from '#lib/remplacements/textes.ts';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';
	import ListeRangees from '#lib/ui/ListeRangees.svelte';
	import Pastille from '#lib/ui/Pastille.svelte';
	import Rangee from '#lib/ui/Rangee.svelte';
	import TuileDate from '#lib/ui/TuileDate.svelte';
	import Vide from '#lib/ui/Vide.svelte';
	import { DESSINS } from '#lib/ui/icones-roles.ts';

	let { data, form } = $props();

	const p = $derived(data.planning);
	const m = $derived(data.maintenant);
	const CALENDRIER = 'M4 6h16v14H4z M4 10h16 M8 3v4 M16 3v4';
	const action = $derived(p.peutPreparer ? { href: `/planning/preparer?annee=${p.annee}`, libelle: 'Préparer l’année', dessin: CALENDRIER } : undefined);
	const equipe = (id: number) => (p.publiee ? p.equipes.find((e) => e.id === id) : undefined) ?? { id, nom: 'Équipe archivée', couleur: '#8a949e' };
	const FETES = { noel: 'de Noël', nouvel_an: 'du Nouvel An' } as const;
	const VUES = [
		['semaine', 'Semaine'],
		['mois', 'Mois'],
		['annee', 'Année'],
		['equipes', 'Équipes']
	] as const;
	const REPONSES = [
		['present', 'Présent'],
		['absent', 'Absent'],
		['incertain', 'Incertain']
	] as const;
	const MEMOIRE = 'planning-vue';
	const lien = (params: Record<string, string | number>) => `?${new URLSearchParams(Object.entries({ annee: p.annee, ...params }).map(([k, v]) => [k, String(v)]))}`;

	const mode = $derived(p.publiee && (p.monEquipe !== null || p.semaines.some((s) => s.mienne)) ? ('moi' as const) : ('equipes' as const));
	// La carte : ma semaine en cours ou la prochaine ; sans équipe, l'équipe de la semaine.
	const carte = $derived.by((): Astreinte | null => {
		if (!p.publiee) return null;
		const a = p.prochaine.astreinte;
		if (a) return { ...a, equipe: avecGroupe(equipe(a.equipeId), a), mienne: true };
		// Avec une équipe et sans prochaine astreinte : l'année suivante n'est pas publiée.
		if (mode === 'moi') return null;
		const s = p.semaines.find((x) => x.periodes[0]!.debut <= m && m < x.periodes.at(-1)!.fin);
		return s ? { debut: s.periodes[0]!.debut, fin: s.periodes.at(-1)!.fin, periodes: s.periodes, equipe: avecGroupe(equipe(s.equipeId), s), enCours: true, mienne: false } : null;
	});
	const phrase = $derived(
		!p.publiee
			? `Le planning ${p.annee} n’est pas encore publié.`
			: carte
				? `${phraseAstreinte(carte, m).titre}.`
				: mode === 'moi'
					? `Le planning ${Number(m.slice(0, 4)) + 1} n’est pas encore publié.`
					: 'Les astreintes et les manœuvres de l’année.'
	);

	const donnees = $derived(p.publiee ? { annee: p.annee, feries: p.feries, vacances: p.vacances, manoeuvres: p.manoeuvres, remplacements: p.remplacements } : null);
	const indexSemaine = $derived(p.publiee ? p.semaines.findIndex((s) => s.debut === data.semaine) : -1);
	const semaine = $derived(p.publiee && indexSemaine >= 0 ? p.semaines[indexSemaine]! : null);
	const precedente = $derived(indexSemaine > 0 && p.publiee ? lien({ vue: 'semaine', semaine: p.semaines[indexSemaine - 1]!.debut }) : `?annee=${p.annee - 1}&vue=semaine&semaine=derniere`);
	const suivante = $derived(p.publiee && indexSemaine < p.semaines.length - 1 ? lien({ vue: 'semaine', semaine: p.semaines[indexSemaine + 1]!.debut }) : `?annee=${p.annee + 1}&vue=semaine`);
	const moisPrecedent = $derived(data.mois > 1 ? lien({ vue: 'mois', mois: data.mois - 1 }) : `?annee=${p.annee - 1}&vue=mois&mois=12`);
	const moisSuivant = $derived(data.mois < 12 ? lien({ vue: 'mois', mois: data.mois + 1 }) : `?annee=${p.annee + 1}&vue=mois&mois=1`);

	const manoeuvre = $derived(p.publiee ? p.prochaine.manoeuvre : null);
	const fete = $derived(p.publiee ? p.prochaine.fete : null);
	const demandes = $derived([
		...data.remplacements.pourMoi.map((v) => ({ v, alerte: true, sous: 'Accepter ou refuser' })),
		...data.remplacements.aValider.filter((v) => !data.remplacements.pourMoi.some((x) => x.id === v.id)).map((v) => ({ v, alerte: true, sous: 'À valider' })),
		...data.remplacements.miennes.map((v) => ({ v, alerte: false, sous: ETATS[v.etat].libelle }))
	]);
	const reussite = $derived(form && 'succes' in form ? String(form.succes) : '');
	const echec = $derived(form && 'message' in form && !('succes' in form) ? String(form.message) : '');

	// La dernière vue choisie est retenue sur l'appareil.
	const retenir = (vue: string) => {
		try {
			localStorage.setItem(MEMOIRE, vue);
		} catch {
			// Stockage indisponible : la vue par défaut suffit.
		}
	};
	onMount(() => {
		if (data.vueDemandee || !p.publiee) return;
		let retenue: string | null = null;
		try {
			retenue = localStorage.getItem(MEMOIRE);
		} catch {
			return;
		}
		if (retenue && retenue !== data.vue && VUES.some(([v]) => v === retenue)) goto(lien({ vue: retenue }), { replace: true, reset: false });
	});
</script>

<svelte:head>
	<title>Planning {p.annee} · Gyro Caserne</title>
</svelte:head>

<div class="page">
	<TirerPourActualiser />
	<EnTetePage titre="Planning" {phrase} {action} />
	<p class="masque" role="status">{reussite}</p>
	<p class="masque" role="alert">{echec}</p>

	{#if !p.publiee}
		<Vide titre="Le planning {p.annee} n’est pas encore publié." texte="Le chef de centre le prépare : il apparaîtra ici dès sa publication, avec vos semaines d’astreinte et les manœuvres." />
		<nav class="annees" aria-label="Années">
			<a href="?annee={p.annee - 1}">‹ {p.annee - 1}</a>
			<a href="?annee={p.annee + 1}">{p.annee + 1} ›</a>
		</nav>
	{:else if donnees}
		<div class="colonnes">
			<div class="gauche">
				{#if carte}<CarteAstreinte a={carte} maintenant={m} />{/if}

				<ListeRangees titre="À venir">
					{#if manoeuvre}
						<li>
							<Rangee titre={manoeuvre.theme} sous="Manœuvre · {momentLong(manoeuvre.debut)} · {manoeuvre.lieu}{manoeuvre.petitDejeuner ? ' · petit-déjeuner' : ''}">
								{#snippet tete()}<TuileDate iso={manoeuvre.debut} />{/snippet}
								{#if manoeuvre.publicationId}
									<form method="POST" action="?/repondre&{new URLSearchParams({ annee: String(p.annee), vue: data.vue, semaine: data.semaine ?? '', mois: String(data.mois) })}" use:enhance={() => async ({ update }) => update({ reset: false })}>
										<input type="hidden" name="id" value={manoeuvre.publicationId} />
										<p id="reponse-manoeuvre" class="masque">Votre réponse : {manoeuvre.theme}</p>
										<div role="group" aria-labelledby="reponse-manoeuvre" class="boutons">
											{#each REPONSES as [valeur, libelle] (valeur)}
												<button type="submit" class="bascule" name="reponse" value={valeur} aria-pressed={manoeuvre.reponse === valeur}>{libelle}</button>
											{/each}
										</div>
									</form>
								{:else}
									<span class="note">Annoncée deux semaines avant : vous pourrez répondre ici.</span>
								{/if}
								{#if manoeuvre.convocation !== 'tous'}
									<a class="echanger" href="/remplacements/manoeuvre?mienne={manoeuvre.id}&depuis=planning">Je ne peux pas : échanger ma place<span class="masque">{` à « ${manoeuvre.theme} »`}</span></a>
								{/if}
							</Rangee>
						</li>
					{/if}
					{#if fete}
						<li><Rangee titre="Garde {FETES[fete.fete]}" sous="Votre équipe la tient, le {jourLong(fete.date)}{fete.date.slice(0, 4) === m.slice(0, 4) ? '' : ` ${fete.date.slice(0, 4)}`}." icone="etoile" /></li>
					{/if}
					{#each demandes as d (d.v.id)}
						<li>
							<Rangee href="/remplacements/{d.v.id}" titre={titreDemande(d.v)} sous="{d.v.texte} · {d.sous}" alerte={d.alerte}>
								{#snippet droite()}<Pastille ton={ETATS[d.v.etat].ton}>{ETATS[d.v.etat].libelle}</Pastille>{/snippet}
							</Rangee>
						</li>
					{/each}
					<li><Rangee href="/remplacements" titre="Remplacements" sous="Me faire remplacer, échanger, répondre aux collègues" icone="groupe" dessin={DESSINS.echanges} /></li>
				</ListeRangees>
			</div>

			<div class="droite">
				<nav class="vues" aria-label="Vue du planning">
					{#each VUES as [vue, libelle] (vue)}
						<a href={lien({ vue })} aria-current={data.vue === vue ? 'page' : undefined} onclick={() => retenir(vue)} data-sveltekit-reset="false">{libelle}</a>
					{/each}
				</nav>

				{#if data.vue === 'semaine' && semaine}
					<VueSemaine {semaine} equipe={avecGroupe(equipe(semaine.equipeId), semaine)} {donnees} {mode} {precedente} {suivante} maintenant={m} />
				{:else if data.vue === 'mois'}
					<VueMois mois={data.mois} semaines={p.semaines} equipes={p.equipes} {donnees} {mode} precedent={moisPrecedent} suivant={moisSuivant} lienJour={(s, j) => `${lien({ vue: 'semaine', semaine: s })}#jour-${j}`} maintenant={m} />
				{:else}
					<section aria-labelledby="titre-annee">
						<h2 id="titre-annee" class="titre-vue">{data.vue === 'equipes' ? `Les équipes en ${p.annee}` : `Mon année ${p.annee}`}</h2>
						<VueAnnee mode={data.vue === 'equipes' ? 'equipes' : mode} semaines={p.semaines} equipes={p.equipes} {donnees} moisOuvert={data.moisCourant} maintenant={m} />
					</section>
				{/if}

				<nav class="annees" aria-label="Années">
					<a href={lien({ annee: p.annee - 1, vue: data.vue })}>‹ {p.annee - 1}</a>
					<a href={lien({ annee: p.annee + 1, vue: data.vue })}>{p.annee + 1} ›</a>
				</nav>
			</div>
		</div>
	{/if}
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 16px;
		max-width: 76rem;
	}
	.colonnes,
	.gauche,
	.droite {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}
	@media (min-width: 1024px) {
		.colonnes {
			display: grid;
			grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
			align-items: start;
			gap: 28px;
		}
		.gauche {
			position: sticky;
			top: calc(var(--hauteur-entete) + 16px);
		}
	}
	.vues {
		display: flex;
		gap: 6px;
	}
	.vues a {
		flex: 1;
		justify-content: center;
		min-height: var(--cible);
		padding: 0 8px;
		border-radius: 999px;
		display: inline-flex;
		align-items: center;
		border: 1px solid var(--trait-doux);
		background: var(--surface);
		color: var(--encre);
		font-weight: 600;
		text-decoration: none;
	}
	.vues a:hover {
		border-color: var(--trait);
	}
	.vues a[aria-current='page'] {
		border-color: var(--encre);
		background: var(--encre);
		color: var(--surface);
	}
	.titre-vue {
		margin: 0 0 10px;
		font: 700 1.375rem var(--police-titre);
	}
	.annees {
		display: flex;
		justify-content: space-between;
		gap: 8px;
	}
	.annees a {
		min-height: var(--cible);
		display: inline-flex;
		align-items: center;
		padding: 0 6px;
		color: var(--doux);
		font-weight: 600;
	}
	.echanger {
		min-height: var(--cible);
		display: inline-flex;
		align-items: center;
		color: var(--encre);
		font-size: 0.9375rem;
		font-weight: 600;
	}
	.note {
		color: var(--doux);
		font-size: 0.875rem;
	}
	form {
		margin-top: 6px;
	}
	.boutons {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.bascule {
		min-height: var(--cible);
		padding: 0 14px;
		border: 1px solid var(--trait);
		border-radius: 999px;
		background: var(--surface);
		color: var(--encre);
		font: 600 0.9375rem var(--police);
		cursor: pointer;
	}
	.bascule[aria-pressed='true'] {
		border-color: var(--encre);
		background: var(--encre);
		color: var(--surface);
	}
</style>
