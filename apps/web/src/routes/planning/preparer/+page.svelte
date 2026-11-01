<script lang="ts">
	import Celebration from '#lib/animations/Celebration.svelte';
	import { momentPlanningPublie } from '#lib/animations/celebration.ts';
	import { duAu, finDeSemaine, jourLong, momentLong, semainesParMois } from '#lib/planning/dates.ts';
	import Bouton from '#lib/ui/Bouton.svelte';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';
	import ListeRangees from '#lib/ui/ListeRangees.svelte';
	import Pastille from '#lib/ui/Pastille.svelte';
	import Rangee from '#lib/ui/Rangee.svelte';

	let { data, form } = $props();

	const p = $derived(data.preparation);
	const nomEquipe = (id: number | null) => (id === null ? 'personne' : (p.equipes.find((e) => e.id === id)?.nom ?? 'équipe archivée'));
	const ordre = $derived(p.ordre.length ? p.ordre : p.ordrePropose);
	const mois = $derived(semainesParMois(p.annee, p.semaines));
	const concerne = (cible: string) => form?.cible === cible;
	const valeur = (cle: string) => (concerne('vacances') && typeof form?.valeurs?.[cle] === 'string' ? (form.valeurs[cle] as string) : '');
	const RANG = ['1re', '2e', '3e', '4e', '5e', '6e', '7e', '8e'];
	const FETES = { noel: 'Noël', nouvel_an: 'Nouvel An' } as const;

	// Hors de son tour : l'équipe calculée n'est pas parmi celles qui attendent le plus longtemps.
	const horsTour = (id: number | null, attendues: number[]) => id !== null && attendues.length > 0 && !attendues.includes(id);
	const noms = (ids: number[]) => ids.map(nomEquipe).join(', ');
	const convoques = (c: 'tous' | number[]) => (c === 'tous' ? 'Tout le centre' : noms(c));
</script>

<svelte:head>
	<title>Préparer {p.annee} · Planning · Gyro Caserne</title>
</svelte:head>

{#snippet retour(cible: string)}
	<div role="alert">{#if concerne(cible) && form?.message}<p class="echec">{form.message}</p>{/if}</div>
	<div role="status">{#if concerne(cible) && form?.succes}<p class="succes">{form.succes}</p>{/if}</div>
{/snippet}

<div class="page">
	<EnTetePage titre="Préparer {p.annee}" phrase="Roulement, manœuvres, fêtes et repères, puis la publication." retour={{ href: `/planning?annee=${p.annee}`, libelle: 'Planning' }} />

	<nav class="annees" aria-label="Année à préparer">
		{#each data.annees as a (a)}<a href="?annee={a}" aria-current={a === p.annee ? 'page' : undefined}>{a}</a>{/each}
	</nav>

	<section class="carte" aria-labelledby="publication">
		<h2 id="publication">Publication</h2>
		{@render retour('publier')}
		{#if p.publiee}
			<p><Pastille ton="ok">Publiée</Pastille> le {jourLong(p.publiee)}. Chaque modification est visible tout de suite des agents.</p>
		{:else}
			<p>Tant que l’année n’est pas publiée, les agents ne voient rien. Publiez-la quand le roulement et les manœuvres sont prêts.</p>
			<form method="POST" action="?/publier&annee={p.annee}"><Bouton type="submit">Publier l’année {p.annee}</Bouton></form>
		{/if}
	</section>

	<section class="carte" aria-labelledby="roulement">
		<h2 id="roulement">Roulement</h2>
		<p class="doux">L’ordre des équipes, semaine après semaine. La première semaine commence le {p.semaines[0] ? jourLong(p.semaines[0].debut) : jourLong(`${p.annee}-01-01`)}.{p.ordre.length ? '' : ' Ordre proposé d’après la référence du centre.'}</p>
		{@render retour('roulement')}
		<form method="POST" action="?/roulement&annee={p.annee}" class="formulaire">
			<div class="ordre">
				{#each ordre as id, i (i)}
					<div class="champ">
						<label for="ordre-{i}">{RANG[i] ?? `${i + 1}e`} semaine</label>
						<select id="ordre-{i}" name="ordre">
							{#each p.equipes as e (e.id)}<option value={e.id} selected={e.id === id}>{e.nom}</option>{/each}
						</select>
					</div>
				{/each}
			</div>
			<Bouton type="submit">Enregistrer le roulement</Bouton>
		</form>
	</section>

	{#if p.semaines.length}
		<section class="carte" aria-labelledby="semaines">
			<h2 id="semaines">Semaines</h2>
			<p class="doux">Changez l’équipe d’une semaine pour régler le tour des fêtes ou un échange. La suite du roulement ne bouge pas.</p>
			{@render retour('semaines')}
			<form method="POST" action="?/semaines&annee={p.annee}" class="formulaire">
				{#each mois as m (m.numero)}
					{#if m.semaines.length}
						{@const changees = m.semaines.filter((s) => s.changee).length}
						<details class="pli">
							<summary>{m.nom}{#if changees}<span class="pastille-texte"> · {changees} changée{changees > 1 ? 's' : ''}</span>{/if}</summary>
							<ul role="list" class="liste-semaines">
								{#each m.semaines as s (s.debut)}
									<li>
										<label for="semaine-{s.debut}">S{s.numero} · {duAu(s.debut, finDeSemaine(s.debut))}{#if s.changee}<span class="changee"> · changée</span>{/if}</label>
										<select id="semaine-{s.debut}" name="semaine-{s.debut}">
											{#each p.equipes as e (e.id)}<option value={e.id} selected={e.id === s.equipeId}>{e.nom}</option>{/each}
										</select>
									</li>
								{/each}
							</ul>
						</details>
					{/if}
				{/each}
				<Bouton type="submit">Enregistrer les semaines</Bouton>
			</form>
		</section>

		<section class="carte" aria-labelledby="fetes">
			<h2 id="fetes">Noël et Nouvel An</h2>
			{@render retour('fetes')}
			<ul role="list" class="fetes">
				<li>
					<strong>Noël {p.annee}</strong> (25 décembre, midi) : {nomEquipe(p.fetes.noel)}
					{#if horsTour(p.fetes.noel, p.fetes.attendues.noel)}<p class="avertissement">Hors de son tour : c’est à {noms(p.fetes.attendues.noel)} de tenir Noël.</p>{/if}
				</li>
				<li>
					<strong>Nouvel An {p.annee}</strong> (31 décembre, 23 h) : {nomEquipe(p.fetes.nouvelAn)}
					{#if horsTour(p.fetes.nouvelAn, p.fetes.attendues.nouvelAn)}<p class="avertissement">Hors de son tour : c’est à {noms(p.fetes.attendues.nouvelAn)} de tenir le Nouvel An.</p>{/if}
				</li>
			</ul>
			<h3>Historique</h3>
			{#if p.fetes.historique.length}
				<ul role="list" class="historique">
					{#each p.fetes.historique as h (`${h.annee}-${h.fete}`)}<li>{FETES[h.fete]} {h.annee} : {nomEquipe(h.equipeId)}</li>{/each}
				</ul>
			{:else}
				<p class="doux">Aucune année passée. Saisissez les dernières pour que l’appli suive le tour.</p>
			{/if}
			<form method="POST" action="?/fete&annee={p.annee}" class="en-ligne">
				<div class="champ">
					<label for="fete-annee">Année</label>
					<input id="fete-annee" name="annee" type="number" min="2020" max={p.annee} value={p.annee - 1} required />
				</div>
				<div class="champ">
					<label for="fete-fete">Fête</label>
					<select id="fete-fete" name="fete"><option value="noel">Noël</option><option value="nouvel_an">Nouvel An</option></select>
				</div>
				<div class="champ">
					<label for="fete-equipe">Équipe</label>
					<select id="fete-equipe" name="equipe">
						{#each p.equipes as e (e.id)}<option value={e.id}>{e.nom}</option>{/each}
						<option value="">Effacer cette ligne</option>
					</select>
				</div>
				<Bouton type="submit" variante="secondaire">Noter</Bouton>
			</form>
		</section>
	{/if}

	<section class="carte" aria-labelledby="manoeuvres">
		<h2 id="manoeuvres" tabindex="-1">Manœuvres</h2>
		<p class="doux">Chaque manœuvre est annoncée sur « Le centre » deux semaines avant, aux équipes convoquées.</p>
		{#if p.manoeuvres.length}
			<ListeRangees>
				{#each p.manoeuvres as m (m.id)}
					<li>
						<Rangee href="/planning/preparer/manoeuvre?id={m.id}&annee={p.annee}" titre={m.theme} sous="{momentLong(m.debut)} · {convoques(m.convoques)}">
							{#snippet droite()}
								{#if m.annulee}<Pastille ton="danger">Annulée</Pastille>{:else if m.publiee}<Pastille ton="ok">Annoncée</Pastille>{/if}
							{/snippet}
						</Rangee>
					</li>
				{/each}
			</ListeRangees>
		{:else}
			<p>Aucune manœuvre pour {p.annee}.</p>
		{/if}
		<p><a class="lien-secondaire" href="/planning/preparer/manoeuvre?annee={p.annee}">Ajouter une manœuvre</a></p>
	</section>

	<section class="carte" aria-labelledby="reperes">
		<h2 id="reperes">Repères</h2>
		<h3>Jours fériés</h3>
		<ul role="list" class="feries">
			{#each p.feries as f (f.date)}<li>{f.nom} : {jourLong(f.date)}</li>{/each}
		</ul>
		<h3>Vacances scolaires</h3>
		{@render retour('vacances')}
		{#if p.vacances.length}
			<ul role="list" class="vacances">
				{#each p.vacances as v (v.id)}
					<li>
						<span>{v.nom} : du {jourLong(v.debut)} au {jourLong(v.fin)}</span>
						<form method="POST" action="?/retirerVacances&annee={p.annee}">
							<input type="hidden" name="id" value={v.id} />
							<button type="submit" class="retirer" aria-label="Retirer {v.nom}">Retirer</button>
						</form>
					</li>
				{/each}
			</ul>
		{/if}
		<form method="POST" action="?/vacances&annee={p.annee}" class="en-ligne">
			<div class="champ">
				<label for="vacances-nom">Nom</label>
				<input id="vacances-nom" name="nom" maxlength="60" required value={valeur('nom')} placeholder="Vacances d’hiver" />
			</div>
			<div class="champ">
				<label for="vacances-debut">Du</label>
				<input id="vacances-debut" name="debut" type="date" required value={valeur('debut')} />
			</div>
			<div class="champ">
				<label for="vacances-fin">Au</label>
				<input id="vacances-fin" name="fin" type="date" required value={valeur('fin')} />
			</div>
			<Bouton type="submit" variante="secondaire">Ajouter</Bouton>
		</form>
	</section>
</div>
<Celebration moment={momentPlanningPublie(concerne('publier') && form?.succes ? p.annee : null)} qui={data.qui} annoncer={false} />

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 16px;
		max-width: 52rem;
	}
	h2,
	h3,
	p {
		margin: 0;
	}
	h2 {
		font: 700 1.5rem var(--police-titre);
	}
	h2:focus {
		outline: none;
	}
	h3 {
		font: 700 1.125rem var(--police-titre);
	}
	.doux {
		color: var(--doux);
	}
	.annees {
		display: flex;
		gap: 8px;
	}
	.annees a {
		min-height: var(--cible);
		display: inline-flex;
		align-items: center;
		padding: 0 18px;
		border: 1px solid var(--trait);
		border-radius: 999px;
		background: var(--surface);
		color: var(--encre);
		font-weight: 600;
		text-decoration: none;
	}
	.annees a[aria-current='page'] {
		background: var(--encre);
		color: var(--surface);
	}
	.carte {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 16px;
		border: 1px solid var(--trait-doux);
		border-radius: var(--rayon-grand);
		background: var(--surface);
	}
	.formulaire {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.formulaire > :global(button) {
		align-self: flex-start;
	}
	.ordre {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
		gap: 12px;
	}
	.champ {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	label {
		font-weight: 600;
	}
	select,
	input {
		min-height: var(--cible);
		padding: 0 10px;
		border: 2px solid var(--doux);
		border-radius: var(--rayon-petit);
		background: var(--surface);
		color: var(--encre);
		font: 400 1rem var(--police);
	}
	.pli {
		border: 1px solid var(--trait-doux);
		border-radius: var(--rayon-petit);
		padding: 0 12px;
	}
	summary {
		min-height: var(--cible);
		display: flex;
		align-items: center;
		font-weight: 600;
		cursor: pointer;
	}
	.pastille-texte,
	.changee {
		color: var(--statut-alerte-texte);
		font-weight: 600;
	}
	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.liste-semaines {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding-bottom: 12px;
	}
	.liste-semaines li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 6px 12px;
	}
	.fetes,
	.historique,
	.feries,
	.vacances {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.avertissement {
		margin-top: 4px;
		padding: 8px 12px;
		border: 1px solid var(--statut-alerte-trait);
		border-radius: var(--rayon-petit);
		background: var(--statut-alerte-fond);
		color: var(--statut-alerte-texte);
		font-weight: 600;
	}
	.en-ligne {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 12px;
	}
	.vacances li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}
	.retirer {
		min-height: var(--cible);
		padding: 0 14px;
		border: 1px solid var(--trait);
		border-radius: 999px;
		background: none;
		color: var(--accent);
		font: 600 0.9375rem var(--police);
		cursor: pointer;
	}
	.echec,
	.succes {
		padding: 10px 14px;
		border-radius: var(--rayon-petit);
		border: 2px solid var(--accent);
		font-weight: 600;
	}
	.succes {
		border-color: var(--ok);
	}
</style>
