<script lang="ts">
	import { untrack } from 'svelte';
	import { estDroitPouvoir, type Droit } from '@gyro-caserne/socle';
	import { LIBELLES_DROIT } from '#lib/droits.ts';
	import { ADMINISTRATION, appliquerNiveaux, DOMAINES, estPersonnalise, niveauxDe, type DomaineId } from '#lib/paquets.ts';
	import BarreActions from '#lib/ui/BarreActions.svelte';
	import Bouton from '#lib/ui/Bouton.svelte';
	import Champ from '#lib/ui/Champ.svelte';
	import Choix from '#lib/ui/Choix.svelte';
	import Groupe from '#lib/ui/Groupe.svelte';
	import IconeRole from '#lib/ui/IconeRole.svelte';
	import Pastille from '#lib/ui/Pastille.svelte';
	import ChoixIcone from '../../ChoixIcone.svelte';
	import Domaines from '../../Domaines.svelte';
	import { iconeDe, NATURES, optionsAttributeur, PORTEES, quiAttribue, valeurAttributeur } from '../../roles.ts';

	let { data, form } = $props();

	const role = $derived(data.role);
	const actuels = $derived(role.droits.map((d) => d.droit as Droit));
	const lectureSeule = $derived(data.raison !== null);
	const peutAdmin = $derived(data.peutPouvoir && !lectureSeule);

	const adminDe = (droits: Droit[]) => droits.filter(estDroitPouvoir);

	// Ce qui est choisi à l'écran, pas encore enregistré. Repart de la page à chaque chargement (autre rôle, envoi).
	let choix = $state(untrack(() => niveauxDe(actuels)));
	let admin = $state(untrack(() => adminDe(actuels)));
	$effect.pre(() => {
		choix = niveauxDe(actuels);
		admin = adminDe(actuels);
	});

	const departNiveaux = $derived(niveauxDe(actuels));
	const departAdmin = $derived(adminDe(actuels));
	const memes = (a: Droit[], b: Droit[]) => a.length === b.length && a.every((d) => b.includes(d));
	const modifies = $derived(DOMAINES.filter((d) => choix[d.id] !== departNiveaux[d.id]).length + (memes(admin, departAdmin) ? 0 : 1));
	const message = $derived(modifies === 0 ? '' : modifies === 1 ? '1 domaine modifié, pas encore enregistré' : `${modifies} domaines modifiés, pas encore enregistrés`);

	const numeriques = $derived(Object.fromEntries(Object.entries(choix).filter(([, n]) => typeof n === 'number')) as Partial<Record<DomaineId, number>>);
	const apres = $derived([...appliquerNiveaux(actuels, numeriques).filter((d) => !estDroitPouvoir(d)), ...admin]);
	const personnalise = $derived(estPersonnalise(apres, role.modele));

	function toutRevenir(e: Event) {
		e.preventDefault();
		if (!data.modele) return;
		choix = niveauxDe(data.modele.droits);
		if (peutAdmin) admin = adminDe(data.modele.droits);
	}

	const concerne = (cible: string) => form?.cible === cible;
	const erreurs = (cible: string): Record<string, string> => (concerne(cible) ? (form?.erreurs ?? {}) : {});
	const saisie = (champ: 'nom' | 'nature' | 'portee' | 'attributeur', defaut: string) => (concerne('role') ? (form?.valeurs?.[champ] ?? defaut) : defaut);
	const porteeLibelle = $derived(PORTEES.find((p) => p.valeur === role.portee)?.libelle ?? role.portee);
	const avertissement = (n: number) =>
		n === 0 ? 'Personne ne tient ce rôle aujourd’hui.' : n === 1 ? 'La personne qui tient ce rôle le perd aujourd’hui, avec ses droits.' : `Les ${n} personnes qui tiennent ce rôle le perdent aujourd’hui, avec ses droits.`;
</script>

<svelte:head>
	<title>{role.nom} · Réglages · Gyro Caserne</title>
</svelte:head>

{#snippet retour(cible: string)}
	<div role="alert">
		{#if concerne(cible) && (form?.message || form?.erreurs)}<p class="echec">{form?.message ?? 'Le formulaire contient des erreurs.'}</p>{/if}
	</div>
	<div role="status">
		{#if concerne(cible) && form?.succes}<p class="succes">{form.succes}</p>{/if}
	</div>
{/snippet}

<header class="entete">
	<div class="titre">
		<IconeRole icone={iconeDe(role)} taille={48} />
		<div>
			<h1>{role.nom}</h1>
			<p class="sous-titre">{porteeLibelle} · {quiAttribue(role.attributeur, data.comitesChoix)}</p>
		</div>
	</div>
	<div class="pastilles">
		{#if data.modele}<Pastille ton="neutre">Modèle : {data.modele.nom}</Pastille>{/if}
		{#if personnalise}<Pastille ton="alerte">Personnalisé</Pastille>{/if}
		{#if role.systeme !== null}<Pastille ton="neutre">Rôle système</Pastille>{/if}
		{#if role.archiveeLe !== null}<Pastille ton="neutre">Archivé</Pastille>{/if}
	</div>
</header>

{#if data.raison}<p class="raison">{data.raison}</p>{/if}
{@render retour('role')}

<p class="intro">Ce que ce rôle peut faire, en plus de ce que tout agent fait déjà.{lectureSeule ? '' : ' Touchez un domaine pour le régler.'}</p>

<svelte:element this={lectureSeule ? 'div' : 'form'} class="formulaire" {...lectureSeule ? {} : { method: 'POST', action: '?/enregistrer', id: 'role' }}>
	<Domaines droits={actuels} modele={data.modele?.droits ?? null} bind:choix {lectureSeule} formRevenir="revenir" />

	<Groupe titre="Administration de l’appli" resume={admin.length === 0 ? 'Aucun pouvoir' : admin.map((d) => ADMINISTRATION.find((a) => a.droit === d)?.libelle).join(', ')}>
		<fieldset class="admin" aria-describedby={peutAdmin ? undefined : 'admin-aide'}>
			<legend class="cache">Administration de l’appli</legend>
			{#if !peutAdmin}
				<p id="admin-aide" class="aide">Seuls le chef de centre, son adjoint et le super administrateur cochent ou décochent ces cases.</p>
			{:else}
				<input type="hidden" name="administration" value="oui" />
			{/if}
			{#each ADMINISTRATION as a (a.droit)}
				<label class="case"
					><input
						type="checkbox"
						name="admin"
						value={a.droit}
						checked={admin.includes(a.droit)}
						disabled={!peutAdmin}
						onchange={(e) => (admin = e.currentTarget.checked ? [...admin, a.droit] : admin.filter((d) => d !== a.droit))}
					/>
					{a.libelle}</label
				>
			{/each}
		</fieldset>
	</Groupe>

	{#if !lectureSeule}
		<Groupe titre="Nom, icône et nomination" resume="{role.nom} · {porteeLibelle}">
			<div class="champs">
				<Champ id="role-nom" name="nom" libelle="Nom" requis maxlength={60} valeur={saisie('nom', role.nom)} erreur={erreurs('role').nom} />
				<Choix id="role-nature" name="nature" libelle="Nature" valeur={saisie('nature', role.nature)} erreur={erreurs('role').nature} options={NATURES} />
				{#if role.titulaires > 0}
					<p class="aide">Portée : {porteeLibelle}. Elle ne change pas tant que le rôle est tenu.</p>
				{:else}
					<Choix id="role-portee" name="portee" libelle="Portée" valeur={saisie('portee', role.portee)} erreur={erreurs('role').portee} options={PORTEES} />
				{/if}
				<Choix id="role-attributeur" name="attributeur" libelle="Qui attribue" valeur={saisie('attributeur', valeurAttributeur(role.attributeur))} erreur={erreurs('role').attributeur} options={optionsAttributeur(data.comitesChoix)} />
				<ChoixIcone valeur={iconeDe(role)} erreur={erreurs('role').icone} />
			</div>
		</Groupe>

		<BarreActions {message}>
			<Bouton type="submit">Enregistrer</Bouton>
			{#if data.modele}
				<button type="submit" class="secondaire" form="revenir" name="domaine" value="tout" onclick={toutRevenir}>↺ Tout revenir</button>
			{/if}
		</BarreActions>
	{/if}
</svelte:element>

<!-- Sans JavaScript, « Revenir au modèle » et « Tout revenir » envoient ce formulaire. -->
{#if !lectureSeule}<form id="revenir" method="POST" action="?/revenir"></form>{/if}

<details class="pli" open={concerne('detail') && !form?.succes ? true : undefined}>
	<summary>Détail droit par droit</summary>
	{@render retour('detail')}
	{#if lectureSeule}
		<ul class="detail">
			{#each actuels as d (d)}<li>{LIBELLES_DROIT[d]}</li>{:else}<li>Aucun droit en plus de ceux de tout agent.</li>{/each}
		</ul>
	{:else}
		<form method="POST" action="?/detail" class="formulaire-detail">
			{#each [{ titre: 'Droits métier', liste: data.droitsMetier, pouvoir: false }, { titre: 'Droits d’administration', liste: data.droitsPouvoir, pouvoir: true }] as bloc (bloc.titre)}
				<fieldset>
					<legend>{bloc.titre}</legend>
					{#each bloc.liste as d (d)}
						{@const verrouille = role.droits.some((x) => x.droit === d && x.verrouille)}
						<label class="case"
							><input type="checkbox" name="droits" value={d} checked={actuels.includes(d)} disabled={verrouille || (bloc.pouvoir && !data.peutPouvoir)} />
							{LIBELLES_DROIT[d]}</label
						>
					{/each}
				</fieldset>
			{/each}
			<Bouton type="submit" variante="secondaire">Enregistrer le détail</Bouton>
		</form>
	{/if}
</details>

{#if !lectureSeule}
	<details class="pli" open={concerne('archiver') && !form?.succes ? true : undefined}>
		<summary>Archiver le rôle</summary>
		{@render retour('archiver')}
		<form method="POST" action="?/archiver" class="formulaire-detail">
			<p class="avertissement">{avertissement(role.titulaires)}</p>
			<label class="case"><input type="checkbox" name="confirmation" value="oui" /> Je confirme</label>
			<Bouton type="submit" variante="secondaire">Archiver le rôle</Bouton>
		</form>
	</details>
{/if}

<style>
	.entete {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.titre {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	h1 {
		margin: 0;
		line-height: 1.1;
	}
	p {
		margin: 0;
	}
	.sous-titre,
	.intro,
	.aide {
		color: var(--doux);
	}
	.pastilles {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.raison {
		padding: 12px 16px;
		border-radius: var(--rayon-petit);
		background: var(--statut-neutre-fond);
		border: 1px solid var(--statut-neutre-trait);
	}
	.formulaire {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.admin,
	fieldset {
		border: none;
		margin: 0;
		padding: 12px 14px;
	}
	.cache {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}
	.champs {
		padding: 12px 14px 14px;
		display: flex;
		flex-direction: column;
		gap: 14px;
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
	.secondaire {
		min-height: var(--cible);
		padding: 0 20px;
		border-radius: var(--rayon-petit);
		border: 2px solid var(--doux);
		background: var(--surface);
		color: var(--encre);
		font: 700 1.0625rem var(--police);
		cursor: pointer;
	}
	.pli {
		background: var(--surface);
		border: 1px solid var(--trait-doux);
		border-radius: var(--rayon-grand);
		padding: 0 14px;
	}
	summary {
		min-height: 56px;
		display: flex;
		align-items: center;
		font-weight: 600;
		cursor: pointer;
	}
	.formulaire-detail {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding-bottom: 14px;
	}
	.formulaire-detail > :global(button) {
		align-self: flex-start;
	}
	legend {
		font-weight: 700;
	}
	.detail {
		margin: 0 0 14px;
	}
	.avertissement {
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
</style>
