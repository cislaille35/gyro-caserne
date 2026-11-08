<script lang="ts">
	import { enhance, type SubmitFunction } from '$app/forms';
	import type { Astreinte } from '@gyro-caserne/socle';
	import TirerPourActualiser from '#lib/animations/TirerPourActualiser.svelte';
	import CarteAstreinte from '#lib/planning/CarteAstreinte.svelte';
	import { MEMOIRE_VUE } from '#lib/planning/memoire.ts';
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
					: undefined
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
	const aTraiter = $derived(demandes.filter((d) => d.alerte).length);
	const aVenir = $derived(manoeuvre !== null || fete !== null || demandes.length > 0);
	const reussite = $derived(form && 'succes' in form ? String(form.succes) : '');
	const echec = $derived(form && 'message' in form && !('succes' in form) ? String(form.message) : '');

	// Après une réponse, SvelteKit remet le focus en haut de la page : on le rend au bouton, sous le calendrier au téléphone.
	const garderFocus: SubmitFunction = ({ submitter }) => async ({ update }) => {
		await update({ reset: false });
		if (submitter instanceof HTMLElement && submitter.isConnected) submitter.focus();
	};

	// La dernière vue choisie est retenue sur l'appareil, pour l'onglet Planning (lue par le serveur).
	const retenir = (vue: string) => {
		document.cookie = `${MEMOIRE_VUE}=${vue}; path=/planning; max-age=31536000; samesite=lax`;
	};
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
		<nav class="segments vues" aria-label="Vue du planning">
			{#each VUES as [vue, libelle] (vue)}
				<a href={lien({ vue })} aria-current={data.vue === vue ? 'page' : undefined} onclick={() => retenir(vue)} data-sveltekit-reset="false">{libelle}</a>
			{/each}
		</nav>

		<!-- Au-dessus du calendrier : la vue Année est longue, et les remplacements restent à portée, avec ou sans astreinte. -->
		<div class="acces">
			{#if carte}<CarteAstreinte a={carte} maintenant={m} />{/if}
			<a class="remplacements" href="/remplacements"
				><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d={DESSINS.echanges} /></svg>Remplacements{#if aTraiter > 0}{' '}<Pastille ton="alerte">{aTraiter} à traiter</Pastille>{/if}</a
			>
		</div>

		<div class="colonnes" class:seule={!aVenir}>
			<div class="calendrier">
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

			{#if aVenir}
				<div class="a-cote">
					<ListeRangees titre="À venir">
						{#if manoeuvre}
							<li>
								<Rangee titre={manoeuvre.theme} sous="Manœuvre, {momentLong(manoeuvre.debut)}, {manoeuvre.lieu}{manoeuvre.petitDejeuner ? ', petit-déjeuner' : ''}">
									{#snippet tete()}<TuileDate iso={manoeuvre.debut} />{/snippet}
									<!-- Commencée, on n'y répond plus et on n'échange plus sa place (le serveur refuse). -->
									{#if manoeuvre.enCours}
										<span class="en-cours"><Pastille ton="ok">En cours</Pastille></span>
									{:else if manoeuvre.publicationId}
										<form method="POST" action="?/repondre&{new URLSearchParams({ annee: String(p.annee), vue: data.vue, semaine: data.semaine ?? '', mois: String(data.mois) })}" use:enhance={garderFocus}>
											<input type="hidden" name="id" value={manoeuvre.publicationId} />
											<p id="reponse-manoeuvre" class="masque">Votre réponse : {manoeuvre.theme}</p>
											<div role="group" aria-labelledby="reponse-manoeuvre" class="segments boutons">
												{#each REPONSES as [valeur, libelle] (valeur)}
													<button type="submit" name="reponse" value={valeur} aria-pressed={manoeuvre.reponse === valeur}>{libelle}</button>
												{/each}
											</div>
										</form>
									{:else}
										<span class="note">Annoncée deux semaines avant : vous pourrez répondre ici.</span>
									{/if}
									{#if manoeuvre.convocation !== 'tous' && !manoeuvre.enCours}
										<a class="echanger" href="/remplacements/manoeuvre?mienne={manoeuvre.id}&depuis=planning">Je ne peux pas : échanger ma place<span class="masque">{` à « ${manoeuvre.theme} »`}</span></a>
									{/if}
								</Rangee>
							</li>
						{/if}
						{#if fete}
							<li><Rangee titre="Garde {FETES[fete.fete]}" sous="Votre équipe la tient, le {jourLong(fete.date)}{fete.date.slice(0, 4) === m.slice(0, 4) ? '' : ` ${fete.date.slice(0, 4)}`}." /></li>
						{/if}
						{#each demandes as d (d.v.id)}
							<li>
								<Rangee href="/remplacements/{d.v.id}" titre={titreDemande(d.v)} sous="{d.v.texte} · {d.sous}" alerte={d.alerte}>
									{#snippet droite()}<Pastille ton={ETATS[d.v.etat].ton}>{ETATS[d.v.etat].libelle}</Pastille>{/snippet}
								</Rangee>
							</li>
						{/each}
					</ListeRangees>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.en-cours {
		display: block;
		margin-top: var(--espace-4);
	}
	/* Les trois réponses, à parts égales, sur une ligne à 390 px. */
	.boutons {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}
	.boutons button {
		padding: 0 var(--espace-4);
	}
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--espace-16);
		max-width: 76rem;
	}
	.colonnes,
	.calendrier {
		display: flex;
		flex-direction: column;
		gap: var(--espace-20);
	}
	.acces {
		display: grid;
		gap: var(--espace-8);
	}
	.remplacements {
		justify-self: start;
		min-height: var(--cible);
		display: inline-flex;
		align-items: center;
		gap: var(--espace-8);
		padding: 0 var(--espace-12);
		border: 1px solid var(--trait);
		border-radius: var(--rayon-bouton);
		background: var(--surface);
		color: var(--encre);
		font-size: var(--texte-15);
		font-weight: 600;
		text-decoration: none;
	}
	.remplacements:hover {
		border-color: var(--encre);
	}
	@media (min-width: 1024px) {
		.vues {
			max-width: 32rem;
		}
		.acces {
			grid-template-columns: minmax(0, 1fr) auto;
			align-items: center;
			gap: var(--espace-12);
		}
		.colonnes {
			display: grid;
			grid-template-columns: minmax(0, 8fr) minmax(0, 5fr);
			align-items: start;
			gap: var(--espace-32);
		}
		.colonnes.seule {
			grid-template-columns: minmax(0, 1fr);
		}
		.a-cote {
			position: sticky;
			top: 16px;
		}
	}
	.titre-vue {
		margin: 0 0 var(--espace-12);
		font: 700 var(--texte-20) var(--police-titre);
	}
	.annees {
		display: flex;
		justify-content: space-between;
		gap: var(--espace-8);
	}
	.annees a {
		min-height: var(--cible);
		display: inline-flex;
		align-items: center;
		padding: 0 var(--espace-6);
		color: var(--doux);
		font-weight: 600;
	}
	.echanger {
		min-height: var(--cible);
		display: inline-flex;
		align-items: center;
		color: var(--encre);
		font-size: var(--texte-15);
		font-weight: 600;
	}
	.note {
		color: var(--doux);
		font-size: var(--texte-14);
	}
	form {
		margin-top: var(--espace-6);
	}
</style>
