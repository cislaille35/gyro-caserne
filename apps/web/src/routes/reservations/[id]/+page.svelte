<script lang="ts">
	import { periodeCourte, restantParJour, type Ressource, type VueReservation } from '@gyro-caserne/socle';
	import { ceJour, decaler, etatAffiche, grilleDuMois, horaire, jourLong, moisDe, premierDuMois } from '#lib/reservations.ts';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';
	import Pastille from '#lib/ui/Pastille.svelte';

	let { data }: { data: { ressource: Ressource; reservations: VueReservation[]; peutReserver: boolean; reserveCitoyenne: boolean; jour: string; aujourdhui: string } } = $props();

	const r = $derived(data.ressource);
	const phrase = $derived(r.forme === 'creneau' ? `Gérée par ${r.gestionnaire.nom}. Un créneau libre est à vous tout de suite ; un créneau déjà pris attend sa décision.` : `${r.stock} en stock, gérés par ${r.gestionnaire.nom}. Chaque demande attend leur accord.`);

	// Au téléphone : les sept jours à partir du jour choisi (aujourd'hui par défaut).
	const jours = $derived(Array.from({ length: 7 }, (_, i) => decaler(data.jour, i)));
	const grille = $derived(grilleDuMois(data.jour));
	const mois = $derived(data.jour.slice(0, 7));
	const titreSemaine = $derived(`D${periodeCourte('jours', jours[0]!, jours[6]!).slice(1)}`);
	const restant = (jour: string) => (r.stock === null ? null : (restantParJour(r.stock, data.reservations, jour, jour)[0]?.restant ?? r.stock));
	const quoi = (x: VueReservation, jour: string) => `${r.forme === 'creneau' ? horaire(x, jour) : x.quantite} · ${x.demandeur}${x.mienne && !x.nomDemandeur ? ' (vous)' : ''}`;
	const COLONNES = [
		['lundi', 'lun.'],
		['mardi', 'mar.'],
		['mercredi', 'mer.'],
		['jeudi', 'jeu.'],
		['vendredi', 'ven.'],
		['samedi', 'sam.'],
		['dimanche', 'dim.']
	];
	const PAR_CASE = 3;
	const lienReserver = (jour: string) => `/reservations/${r.id}/reserver?jour=${jour < data.aujourdhui ? data.aujourdhui : jour}`;
</script>

<svelte:head>
	<title>{r.nom} · Réservations · Gyro Caserne</title>
</svelte:head>

{#snippet etat(x: VueReservation)}{@const e = etatAffiche(x, data.aujourdhui)}<Pastille ton={e.ton}>{e.libelle}</Pastille>{/snippet}

<div class="page">
	<EnTetePage titre={r.nom} {phrase} retour={{ href: '/reservations', libelle: 'Réservations' }} action={data.peutReserver ? { href: lienReserver(data.jour), libelle: 'Réserver' } : undefined} />

	<section class="semaine" aria-labelledby="t-semaine">
		<div class="navigation">
			<a class="lien-secondaire" href="?jour={decaler(data.jour, -7)}" rel="nofollow"><span aria-hidden="true">‹</span> <span class="masque">Sept jours plus tôt</span></a>
			<h2 id="t-semaine" class="rubrique">{titreSemaine}</h2>
			<a class="lien-secondaire" href="?jour={decaler(data.jour, 7)}" rel="nofollow"><span class="masque">Sept jours plus tard</span> <span aria-hidden="true">›</span></a>
		</div>
		<ul class="jours" role="list">
			{#each jours as jour (jour)}
				{@const pris = ceJour(data.reservations, jour)}
				{@const reste = restant(jour)}
				<li class="jour" class:passe={jour < data.aujourdhui}>
					<div class="entete-jour">
						<h3>{jourLong(jour)}</h3>
						{#if jour === data.aujourdhui}<Pastille ton="info">Aujourd’hui</Pastille>{/if}
					</div>
					{#if reste !== null && pris.length > 0}<p class="reste">Reste {reste} sur {r.stock}</p>{/if}
					{#if pris.length === 0}
						<p class="doux">{reste === null ? 'Libre' : `Libre, ${r.stock} sur ${r.stock}`}</p>
					{:else}
						<ul class="pris" role="list">
							{#each pris as x (x.id)}
								<li><span>{quoi(x, jour)}</span>{@render etat(x)}</li>
							{/each}
						</ul>
					{/if}
				</li>
			{/each}
		</ul>
	</section>

	<section class="mois" aria-labelledby="t-mois">
		<div class="navigation">
			<a class="lien-secondaire" href="?jour={premierDuMois(data.jour, -1)}" rel="nofollow"><span aria-hidden="true">‹</span> Mois précédent</a>
			<h2 id="t-mois" class="rubrique">{moisDe(data.jour)}</h2>
			<a class="lien-secondaire" href="?jour={premierDuMois(data.jour, 1)}" rel="nofollow">Mois suivant <span aria-hidden="true">›</span></a>
		</div>
		<table>
			<thead>
				<tr>
					{#each COLONNES as [long, court] (long)}<th scope="col"><abbr title={long}>{court}</abbr></th>{/each}
				</tr>
			</thead>
			<tbody>
				{#each [0, 1, 2, 3, 4, 5] as ligne (ligne)}
					<tr>
						{#each grille.slice(ligne * 7, ligne * 7 + 7) as jour (jour)}
							{@const pris = ceJour(data.reservations, jour)}
							{@const reste = restant(jour)}
							<td class:ailleurs={jour.slice(0, 7) !== mois} class:passe={jour < data.aujourdhui} class:aujourdhui={jour === data.aujourdhui}>
								<span class="numero"><span class="masque">{jourLong(jour)}</span><span aria-hidden="true">{Number(jour.slice(8))}</span>{#if jour === data.aujourdhui}<span class="masque">, aujourd’hui</span>{/if}</span>
								{#if reste !== null && pris.length > 0}<span class="reste">Reste {reste}</span>{/if}
								<ul role="list">
									{#each pris.slice(0, PAR_CASE) as x (x.id)}
										<li class="etat-{x.etat}">{quoi(x, jour)}{#if x.etat === 'attente'}<span class="en-attente"> · {etatAffiche(x, data.aujourdhui).libelle.toLowerCase()}</span>{/if}</li>
									{/each}
								</ul>
								{#if pris.length > PAR_CASE}<span class="doux plus">et {pris.length - PAR_CASE} de plus</span>{/if}
							</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</section>
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}
	.navigation {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 12px;
	}
	.navigation h2 {
		text-align: center;
	}
	.navigation h2::first-letter {
		text-transform: uppercase;
	}
	.jours,
	.pris {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.jour {
		padding: 12px 14px;
		background: var(--surface);
		border: 1px solid transparent;
		box-shadow: var(--ombre-carte);
		border-radius: var(--rayon-grand);
	}
	/* Jour passé : sur le fond de la page, sans baisser le contraste. */
	.jour.passe {
		background: transparent;
	}
	.entete-jour {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	h3 {
		margin: 0;
		font: 700 1.0625rem var(--police-titre);
	}
	h3::first-letter {
		text-transform: uppercase;
	}
	.jour p {
		margin: 4px 0 0;
	}
	.reste {
		font-weight: 600;
	}
	.pris {
		margin-top: 8px;
		gap: 6px;
	}
	.pris li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		overflow-wrap: anywhere;
	}
	.mois {
		display: none;
	}
	table {
		width: 100%;
		table-layout: fixed;
		border-collapse: separate;
		border-spacing: 4px;
	}
	th {
		font-weight: 600;
		color: var(--doux);
		padding: 4px;
	}
	th abbr {
		text-decoration: none;
	}
	td {
		vertical-align: top;
		height: 112px;
		padding: 6px 8px;
		background: var(--surface);
		border: 1px solid var(--trait-doux);
		border-radius: 10px;
		font-size: 0.8125rem;
		line-height: 1.3;
		overflow-wrap: anywhere;
	}
	td.ailleurs {
		background: transparent;
		color: var(--doux);
	}
	td.passe {
		background: transparent;
	}
	td.aujourdhui {
		border: 2px solid var(--encre);
	}
	.numero {
		display: block;
		font: 700 1rem var(--police-titre);
	}
	td .reste {
		display: block;
		color: var(--doux);
	}
	td ul {
		margin: 4px 0 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 3px;
	}
	td li {
		padding: 2px 6px;
		border-radius: 6px;
		background: var(--statut-ok-fond);
		color: var(--statut-ok-texte);
	}
	td li.etat-attente {
		background: var(--statut-alerte-fond);
		color: var(--statut-alerte-texte);
		border: 1px dashed var(--statut-alerte-trait);
	}
	.en-attente {
		font-style: italic;
	}
	.plus {
		display: block;
		margin-top: 2px;
	}
	@media (min-width: 1024px) {
		.semaine {
			display: none;
		}
		.mois {
			display: block;
		}
	}
</style>
