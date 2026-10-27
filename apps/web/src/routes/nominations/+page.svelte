<script lang="ts">
	import { enhance } from '$app/forms';
	import Bouton from '#lib/ui/Bouton.svelte';
	import Carte from '#lib/ui/Carte.svelte';
	import Champ from '#lib/ui/Champ.svelte';
	import Choix from '#lib/ui/Choix.svelte';

	let { data, form } = $props();

	const date = (jour: string | null) => (jour ? jour.split('-').reverse().join('/') : '—');
	const periode = (t: { debut: string; fin: string | null }) => (t.fin ? `du ${date(t.debut)} au ${date(t.fin)}` : `depuis le ${date(t.debut)}`);
	const concerne = (cible: string) => form?.cible === cible;
	// « Terminer » ou « Changer la date de fin » peuvent sortir le titulaire de la liste : le succès s'annonce dans la carte du rôle.
	const annonceRole = (role: number) => (form?.succes && form.role === role && /^(terminer|finir)-/.test(String(form.cible ?? '')) ? form.message : null);

	// Une seule soumission à la fois par formulaire : le bouton se désactive pendant l'envoi.
	let envoi = $state<string | null>(null);
	const surEnvoi = (cible: string) => () => {
		envoi = cible;
		return async ({ update }: { update: () => Promise<void> }) => {
			try {
				await update();
			} finally {
				envoi = null;
			}
		};
	};

	const agents = $derived(data.agents.map((a) => ({ valeur: String(a.id), libelle: `${a.nom} (${a.equipe})` })));
	// La saisie réaffichée ne vaut que pour le rôle qui l'a produite.
	const saisie = (cible: string, cle: string, defaut: string) => (concerne(cible) ? (form?.valeurs?.[cle] ?? defaut) : defaut);
</script>

<svelte:head>
	<title>Nominations · Gyro Caserne</title>
</svelte:head>

<div class="page">
	<h1>Nominations</h1>

	{#each data.roles as r (r.responsabiliteId)}
		{@const nomination = `attribuer-${r.responsabiliteId}`}
		{@const erreurs = concerne(nomination) ? (form?.erreurs ?? {}) : {}}
		{@const annonce = annonceRole(r.responsabiliteId)}
		<Carte titre={r.nom}>
			<h3>Titulaires</h3>
			<!-- Le titulaire retiré ou raccourci peut quitter la liste : le succès s'annonce ici. -->
			<div role="status">{#if annonce}<p class="succes">{annonce}</p>{/if}</div>
			{#if r.titulaires.length === 0}
				<p>Personne n'a ce rôle pour le moment.</p>
			{:else}
				<ul class="roles">
					{#each r.titulaires as t (t.id)}
						{@const cible = `terminer-${t.id}`}
						{@const finir = `finir-${t.id}`}
						{@const intitule = t.perimetre.nom ? `${t.personne.prenom} ${t.personne.nom} — ${t.perimetre.nom}` : `${t.personne.prenom} ${t.personne.nom}`}
						<li>
							<div>
								<strong>{intitule}</strong>
								<span class="note">{periode(t)}</span>
								{#if concerne(cible) && form?.erreurs?.confirmation}
									<p id="{cible}-erreur" class="echec" role="alert">{form.erreurs.confirmation}</p>
								{:else if (concerne(cible) || concerne(finir)) && form?.message && !form.succes}
									<p class="echec" role="alert">{form.message}</p>
								{/if}
							</div>
							<form method="POST" action="?/finir" class="finir" use:enhance={surEnvoi(finir)}>
								<input type="hidden" name="attributionId" value={t.id} />
								<input type="hidden" name="responsabiliteId" value={r.responsabiliteId} />
								<Champ
									id="nouvelle-fin-{t.id}"
									name="fin"
									type="date"
									libelle={`Nouvelle date de fin : ${intitule}`}
									valeur={concerne(finir) ? (form?.valeurs?.fin ?? t.fin ?? '') : (t.fin ?? '')}
									erreur={concerne(finir) ? form?.erreurs?.fin : undefined}
								/>
								<Bouton type="submit" variante="secondaire" desactive={envoi === finir}>Changer la date de fin</Bouton>
							</form>
							<form method="POST" action="?/terminer" class="terminer" use:enhance={surEnvoi(cible)}>
								<input type="hidden" name="attributionId" value={t.id} />
								<input type="hidden" name="responsabiliteId" value={r.responsabiliteId} />
								<label>
									<input
										type="checkbox"
										name="confirmation"
										value="oui"
										aria-label={`Je confirme : terminer ${r.nom}, ${intitule}`}
										aria-invalid={concerne(cible) && form?.erreurs?.confirmation ? 'true' : undefined}
										aria-describedby={concerne(cible) && form?.erreurs?.confirmation ? `${cible}-erreur` : undefined}
									/>
									Je confirme
								</label>
								<Bouton type="submit" variante="secondaire" desactive={envoi === cible}>Terminer</Bouton>
							</form>
						</li>
					{/each}
				</ul>
			{/if}

			<form method="POST" action="?/attribuer" class="nomination" use:enhance={surEnvoi(nomination)}>
				<h3>Nommer</h3>
				<!-- Zones présentes dès le chargement : le message y est annoncé. -->
				<div role="status">{#if concerne(nomination) && form?.succes}<p class="succes">{form.message}</p>{/if}</div>
				<div role="alert">
					{#if concerne(nomination) && !form?.succes && (form?.message || form?.erreurs)}<p class="echec">{form?.message ?? 'Le formulaire contient des erreurs.'}</p>{/if}
				</div>
				<input type="hidden" name="responsabiliteId" value={r.responsabiliteId} />
				<Choix id="agent-{r.responsabiliteId}" name="personneId" libelle="Agent" valeur={saisie(nomination, 'personneId', '')} options={[{ valeur: '', libelle: 'Choisissez un agent' }, ...agents]} erreur={erreurs.personneId} />
				{#if r.portee === 'centre'}
					<input type="hidden" name="perimetre" value="centre" />
				{:else}
					<Choix
						id="perimetre-{r.responsabiliteId}"
						name="perimetre"
						libelle={r.portee === 'equipe' ? 'Équipe' : 'Comité'}
						valeur={saisie(nomination, 'perimetre', String(r.perimetres[0]?.id ?? ''))}
						erreur={erreurs.perimetreId}
						options={r.perimetres.map((p) => ({ valeur: String(p.id), libelle: p.nom }))}
					/>
				{/if}
				<Champ id="debut-{r.responsabiliteId}" name="debut" type="date" libelle="Début" requis valeur={saisie(nomination, 'debut', data.aujourdhui)} erreur={erreurs.debut} />
				<Champ id="fin-{r.responsabiliteId}" name="fin" type="date" libelle="Fin" aide="Facultative : sans date, le rôle dure jusqu'à ce qu'on le termine." valeur={saisie(nomination, 'fin', '')} erreur={erreurs.fin} />
				<Bouton type="submit" desactive={envoi === nomination}>Nommer</Bouton>
			</form>
		</Carte>
	{/each}
</div>

<style>
	.page,
	form {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	h1 {
		margin: 0;
	}
	p {
		margin: 0;
	}
	form :global(button) {
		align-self: flex-start;
	}
	.succes,
	.echec {
		padding: 12px 16px;
		border-radius: var(--rayon-petit);
		border: 2px solid var(--trait);
		font-weight: 600;
	}
	.echec {
		border-color: var(--accent);
	}
	.note {
		color: var(--doux);
		font-size: 0.9375rem;
	}
	label {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: var(--cible);
		font-weight: 600;
	}
	input[type='checkbox'] {
		width: 1.5rem;
		height: 1.5rem;
		accent-color: var(--accent);
	}
	h3 {
		margin: 0 0 8px;
		font: 700 1.125rem var(--police-titre);
	}
	.roles {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.roles li {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
	}
	.roles li > div {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	form.terminer,
	form.finir {
		flex-direction: row;
		flex-wrap: wrap;
		align-items: center;
		gap: 12px;
	}
	form.finir {
		align-items: flex-end;
	}
	form.nomination {
		margin-top: 24px;
		padding-top: 24px;
		border-top: 1px solid var(--trait);
	}
	form.nomination h3 {
		margin: 0;
	}
</style>
