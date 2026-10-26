<script lang="ts">
	import Bouton from '#lib/ui/Bouton.svelte';
	import Carte from '#lib/ui/Carte.svelte';
	import Champ from '#lib/ui/Champ.svelte';
	import Choix from '#lib/ui/Choix.svelte';
	import Tableau from '#lib/ui/Tableau.svelte';
	import { LIBELLES_DROIT } from '#lib/droits.ts';

	let { data, form } = $props();

	type Droit = keyof typeof LIBELLES_DROIT;
	type Resp = NonNullable<typeof data.responsabilites>[number];

	const NATURES = [
		{ valeur: 'fonction', libelle: 'Fonction' },
		{ valeur: 'mission', libelle: 'Mission' }
	];
	const PORTEES = [
		{ valeur: 'centre', libelle: 'Centre' },
		{ valeur: 'equipe', libelle: 'Équipe' },
		{ valeur: 'comite', libelle: 'Comité' }
	];
	const libelleDe = (liste: { valeur: string; libelle: string }[], valeur: string) => liste.find((o) => o.valeur === valeur)?.libelle ?? valeur;

	const attributeurs = $derived([
		{ valeur: 'chef_centre', libelle: 'Le chef de centre' },
		{ valeur: 'comite_vise', libelle: 'Le comité visé (portée « comité » seulement)' },
		...data.comitesChoix.map((c) => ({ valeur: `comite:${c.id}`, libelle: `Le comité « ${c.nom} »` }))
	]);
	const valeurAttributeur = (r: Resp) => (r.attributeur.type === 'comite' ? `comite:${r.attributeur.id}` : r.attributeur.type);
	function qui(r: Resp): string {
		if (r.attributeur.type === 'comite') {
			const id = r.attributeur.id;
			return data.comites?.find((c) => c.id === id)?.nom ?? data.comitesChoix.find((c) => c.id === id)?.nom ?? 'Un comité';
		}
		return r.attributeur.type === 'comite_vise' ? 'Le comité visé' : 'Le chef de centre';
	}

	const comitesEnCours = $derived((data.comites ?? []).filter((c) => c.dissousLe === null));
	const comitesAnciens = $derived((data.comites ?? []).filter((c) => c.dissousLe !== null));
	const respEnCours = $derived((data.responsabilites ?? []).filter((r) => r.archiveeLe === null));
	const respAnciennes = $derived((data.responsabilites ?? []).filter((r) => r.archiveeLe !== null));

	const jour = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('fr-FR', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' });
	const avertissement = (n: number) =>
		n === 0 ? 'Personne ne tient ce rôle aujourd’hui.' : n === 1 ? 'La personne qui tient ce rôle le perd aujourd’hui, avec ses droits.' : `Les ${n} personnes qui tiennent ce rôle le perdent aujourd’hui, avec ses droits.`;

	// Ce qui revient du serveur pour un formulaire donné (erreurs, saisie à réafficher).
	const concerne = (cible: string) => form?.cible === cible;
	const erreurs = (cible: string): Record<string, string> => (concerne(cible) ? (form?.erreurs ?? {}) : {});
	const saisie = (cible: string, champ: 'nom' | 'theme' | 'nature' | 'portee' | 'attributeur', defaut: string) => (concerne(cible) ? (form?.valeurs?.[champ] ?? defaut) : defaut);
	const droitsCoches = (cible: string, actuels: string[]) => (concerne(cible) && form?.valeurs?.droits ? (form.valeurs.droits as string[]) : actuels);
	const ouvert = (cible: string) => concerne(cible) && !form?.succes;
</script>

<svelte:head>
	<title>Réglages du centre · Gyro Caserne</title>
</svelte:head>

{#snippet retour(cible: string)}
	<div role="alert">
		{#if concerne(cible) && (form?.message || form?.erreurs)}<p class="echec">{form?.message ?? 'Le formulaire contient des erreurs.'}</p>{/if}
	</div>
{/snippet}

{#snippet confirmation(id: string)}
	<label class="case"><input type="checkbox" id={id} name="confirmation" value="oui" /> Je confirme</label>
{/snippet}

{#snippet droitsChamps(prefixe: string, cible: string, actuels: { droit: string; verrouille: boolean }[])}
	{@const coches = droitsCoches(cible, actuels.map((d) => d.droit))}
	{@const fermes = actuels.filter((d) => d.verrouille).map((d) => d.droit)}
	<fieldset>
		<legend>Droits métier</legend>
		<div class="cases">
			{#each data.droitsMetier as droit (droit)}
				{@const verrouille = fermes.includes(droit)}
				<label class="case"
					><input type="checkbox" name="droits" value={droit} checked={coches.includes(droit) || verrouille} disabled={verrouille} id="{prefixe}-droit-{droit}" />
					{LIBELLES_DROIT[droit as Droit]}{verrouille ? ' (verrouillé, il ne se retire pas)' : ''}</label
				>
			{/each}
		</div>
	</fieldset>
	<fieldset aria-describedby={data.peutPouvoir ? undefined : `${prefixe}-pouvoir`}>
		<legend>Droits de pouvoir</legend>
		{#if !data.peutPouvoir}
			<p id="{prefixe}-pouvoir" class="aide">Seuls le chef de centre, son adjoint et le super administrateur ajoutent ou retirent un droit de pouvoir.</p>
		{/if}
		<div class="cases">
			{#each data.droitsPouvoir as droit (droit)}
				{@const verrouille = fermes.includes(droit)}
				<label class="case"
					><input
						type="checkbox"
						name="droits"
						value={droit}
						checked={coches.includes(droit) || verrouille}
						disabled={verrouille || !data.peutPouvoir}
						id="{prefixe}-droit-{droit}"
					/>
					{LIBELLES_DROIT[droit as Droit]}{verrouille ? ' (verrouillé, il ne se retire pas)' : ''}</label
				>
			{/each}
		</div>
	</fieldset>
	{#if erreurs(cible).droits}<p class="erreur">{erreurs(cible).droits}</p>{/if}
{/snippet}

{#snippet champsResponsabilite(prefixe: string, cible: string, r: Resp | null)}
	<Champ id="{prefixe}-nom" name="nom" libelle="Nom" requis maxlength={60} valeur={saisie(cible, 'nom', r?.nom ?? '')} erreur={erreurs(cible).nom} />
	<Choix id="{prefixe}-nature" name="nature" libelle="Nature" valeur={saisie(cible, 'nature', r?.nature ?? 'mission')} erreur={erreurs(cible).nature} options={NATURES} />
	{#if r && (r.systeme !== null || r.titulaires > 0)}
		<p class="aide">Portée : {libelleDe(PORTEES, r.portee)}. Elle ne change pas tant que la responsabilité est tenue.</p>
	{:else}
		<Choix id="{prefixe}-portee" name="portee" libelle="Portée" valeur={saisie(cible, 'portee', r?.portee ?? 'centre')} erreur={erreurs(cible).portee} options={PORTEES} />
	{/if}
	<Choix
		id="{prefixe}-attributeur"
		name="attributeur"
		libelle="Qui attribue"
		valeur={saisie(cible, 'attributeur', r ? valeurAttributeur(r) : 'chef_centre')}
		erreur={erreurs(cible).attributeur}
		options={attributeurs}
	/>
	{@render droitsChamps(prefixe, cible, r?.droits ?? [])}
{/snippet}

<div class="reglages">
	<h1>Réglages du centre</h1>
	<div role="status">
		{#if form?.succes}<p class="succes">{form.succes}</p>{/if}
	</div>

	{#if data.comites}
		<Carte titre="Comités">
			<div class="bloc">
				<Tableau legende="Comités en cours">
					<thead>
						<tr><th scope="col">Nom</th><th scope="col">Thème</th><th scope="col">Membres en cours</th><th scope="col">Réglages</th></tr>
					</thead>
					<tbody>
						{#each comitesEnCours as c (c.id)}
							{@const cible = `comite-${c.id}`}
							<tr>
								<th scope="row">{c.nom}</th>
								<td>{c.theme}</td>
								<td>{c.membresEnCours}</td>
								<td>
									<details open={ouvert(cible)}>
										<summary>Modifier ou dissoudre <span class="cache">le comité {c.nom}</span></summary>
										{@render retour(cible)}
										<form method="POST" action="?/modifierComite" class="formulaire">
											<input type="hidden" name="id" value={c.id} />
											{#if c.estCentre}
												<input type="hidden" name="nom" value={c.nom} />
												<p class="aide">Le comité du centre ne se renomme pas.</p>
											{:else}
												<Champ id="{cible}-nom" name="nom" libelle="Nom" requis maxlength={60} valeur={saisie(cible, 'nom', c.nom)} erreur={erreurs(cible).nom} />
											{/if}
											<Champ id="{cible}-theme" name="theme" libelle="Thème" requis maxlength={60} valeur={saisie(cible, 'theme', c.theme)} erreur={erreurs(cible).theme} />
											<Bouton type="submit">Enregistrer</Bouton>
										</form>
										{#if c.estCentre}
											<p class="aide">Le comité du centre ne se dissout pas.</p>
										{:else}
											<form method="POST" action="?/dissoudreComite" class="formulaire danger">
												<input type="hidden" name="id" value={c.id} />
												<p class="avertissement">{avertissement(c.membresEnCours)}</p>
												{@render confirmation(`${cible}-confirmation`)}
												<Bouton type="submit" variante="secondaire">Dissoudre le comité</Bouton>
											</form>
										{/if}
									</details>
								</td>
							</tr>
						{/each}
					</tbody>
				</Tableau>

				<details class="nouveau" open={ouvert('comite-nouveau')}>
					<summary>Créer un comité</summary>
					{@render retour('comite-nouveau')}
					<form method="POST" action="?/creerComite" class="formulaire">
						<Champ id="comite-nouveau-nom" name="nom" libelle="Nom" requis maxlength={60} valeur={saisie('comite-nouveau', 'nom', '')} erreur={erreurs('comite-nouveau').nom} />
						<Champ id="comite-nouveau-theme" name="theme" libelle="Thème" requis maxlength={60} valeur={saisie('comite-nouveau', 'theme', '')} erreur={erreurs('comite-nouveau').theme} />
						<Bouton type="submit">Créer le comité</Bouton>
					</form>
				</details>

				{#if comitesAnciens.length > 0}
					<details>
						<summary>Anciens ({comitesAnciens.length})</summary>
						<ul>
							{#each comitesAnciens as c (c.id)}<li>{c.nom}, dissous le {jour(c.dissousLe!)}</li>{/each}
						</ul>
					</details>
				{/if}
			</div>
		</Carte>
	{/if}

	{#if data.responsabilites}
		<Carte titre="Responsabilités">
			<div class="bloc">
				<Tableau legende="Responsabilités en cours">
					<thead>
						<tr>
							<th scope="col">Nom</th><th scope="col">Portée</th><th scope="col">Qui attribue</th><th scope="col">Droits</th><th scope="col">Titulaires en cours</th><th scope="col">Réglages</th>
						</tr>
					</thead>
					<tbody>
						{#each respEnCours as r (r.id)}
							{@const cible = `resp-${r.id}`}
							<tr>
								<th scope="row">{r.nom}<span class="doux"> · {libelleDe(NATURES, r.nature)}</span></th>
								<td>{libelleDe(PORTEES, r.portee)}</td>
								<td>{qui(r)}</td>
								<td>{r.droits.map((d) => LIBELLES_DROIT[d.droit as Droit]).join(', ') || 'Aucun'}</td>
								<td>{r.titulaires}</td>
								<td>
									<details open={ouvert(cible)}>
										<summary>Modifier ou archiver <span class="cache">la responsabilité {r.nom}</span></summary>
										{@render retour(cible)}
										{#if r.protegee}
											<p class="aide">Cette responsabilité donne un droit de pouvoir : seuls le chef de centre, son adjoint et le super administrateur la modifient ou l’archivent.</p>
										{:else}
											<form method="POST" action="?/modifierResponsabilite" class="formulaire">
												<input type="hidden" name="id" value={r.id} />
												{@render champsResponsabilite(cible, cible, r)}
												<Bouton type="submit">Enregistrer</Bouton>
											</form>
											{#if r.systeme !== null}
												<p class="aide">Cette responsabilité fait partie du système : elle ne s’archive pas.</p>
											{:else}
												<form method="POST" action="?/archiverResponsabilite" class="formulaire danger">
													<input type="hidden" name="id" value={r.id} />
													<p class="avertissement">{avertissement(r.titulaires)}</p>
													{@render confirmation(`${cible}-confirmation`)}
													<Bouton type="submit" variante="secondaire">Archiver la responsabilité</Bouton>
												</form>
											{/if}
										{/if}
									</details>
								</td>
							</tr>
						{/each}
					</tbody>
				</Tableau>

				<details class="nouveau" open={ouvert('resp-nouvelle')}>
					<summary>Créer une responsabilité</summary>
					{@render retour('resp-nouvelle')}
					<form method="POST" action="?/creerResponsabilite" class="formulaire">
						{@render champsResponsabilite('resp-nouvelle', 'resp-nouvelle', null)}
						<Bouton type="submit">Créer la responsabilité</Bouton>
					</form>
				</details>

				{#if respAnciennes.length > 0}
					<details>
						<summary>Anciens ({respAnciennes.length})</summary>
						<ul>
							{#each respAnciennes as r (r.id)}<li>{r.nom}, archivée le {jour(r.archiveeLe!)}</li>{/each}
						</ul>
					</details>
				{/if}
			</div>
		</Carte>
	{/if}
</div>

<style>
	.reglages,
	.bloc,
	.formulaire {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	h1,
	p {
		margin: 0;
	}
	summary {
		cursor: pointer;
		min-height: var(--cible);
		display: flex;
		align-items: center;
		font-weight: 600;
	}
	.cache {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}
	.formulaire {
		padding: 12px 0;
		max-width: 36rem;
	}
	.danger {
		border-top: 1px solid var(--trait);
	}
	.formulaire > :global(button) {
		align-self: flex-start;
	}
	fieldset {
		border: 1px solid var(--trait);
		border-radius: var(--rayon-petit);
		padding: 12px;
		margin: 0;
	}
	legend {
		font-weight: 700;
		padding: 0 6px;
	}
	.cases {
		display: flex;
		flex-direction: column;
	}
	.case {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: var(--cible);
	}
	.case input {
		width: 24px;
		height: 24px;
		flex: none;
	}
	.aide,
	.doux {
		color: var(--doux);
	}
	.avertissement {
		font-weight: 600;
	}
	.erreur {
		color: var(--accent);
		font-weight: 600;
	}
	.echec,
	.succes {
		padding: 12px 16px;
		border-radius: var(--rayon-petit);
		border: 2px solid var(--accent);
		font-weight: 600;
	}
	.succes {
		border-color: var(--ok);
	}
	ul {
		margin: 8px 0 0;
		padding-left: 20px;
	}
</style>
