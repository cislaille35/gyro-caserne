<script lang="ts">
	import EnTetePage from '#lib/ui/EnTetePage.svelte';
	import { untrack } from 'svelte';
	import { estDroitDuCentre, estDroitPouvoir, estSansEffet, iconeDuRole, type Droit } from '@gyro-caserne/socle';
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
	import { NATURES, optionsAttributeur, PORTEES, quiAttribue, valeurAttributeur } from '../../roles.ts';

	let { data, form } = $props();

	const role = $derived(data.role);
	const actuels = $derived(role.droits.map((d) => d.droit as Droit));
	const lectureSeule = $derived(data.raison !== null);
	const peutAdmin = $derived(data.peutPouvoir && !lectureSeule);

	const adminDe = (droits: Droit[]) => droits.filter(estDroitPouvoir);
	const RESERVE_AU_CENTRE = 'Réservé à un rôle du centre : gérer les accès, les comités et les responsabilités.';

	// Après un refus, la saisie revient du serveur : on la réaffiche.
	const saisis = $derived(form?.cible === 'role' && !form?.succes ? form?.valeurs : undefined);
	function choixDepart() {
		const c = niveauxDe(actuels);
		for (const d of DOMAINES) {
			const n = Number(saisis?.niveaux?.[d.id] ?? NaN);
			if (Number.isInteger(n) && n >= 0 && n < d.niveaux.length) c[d.id] = n;
		}
		return c;
	}
	const adminDepart = () => (saisis?.admin ? adminDe(saisis.admin as Droit[]) : adminDe(actuels));

	// Ce qui est choisi à l'écran, pas encore enregistré. Repart de la page à chaque chargement (autre rôle, envoi).
	let choix = $state(untrack(choixDepart));
	let admin = $state(untrack(adminDepart));
	// La portée choisie à l'écran. Sans JavaScript, celle de la page : le refus du serveur reste le filet.
	const porteeDepart = () => (saisis?.portee as string | undefined) || role.portee;
	let portee = $state(untrack(porteeDepart));
	$effect.pre(() => {
		choix = choixDepart();
		admin = adminDepart();
		portee = porteeDepart();
	});

	// Hors du centre, ces droits sont grisés et décochés : une case grisée n'est pas envoyée, le droit part à l'enregistrement.
	const portePasCentre = $derived(portee !== 'centre');
	const adminPermis = $derived(portePasCentre ? admin.filter((d) => !estDroitDuCentre(d)) : admin);
	// Le détail s'enregistre seul, avec la portée déjà enregistrée : il suit celle-ci, pas celle de l'écran.
	const detailPasCentre = $derived(role.portee !== 'centre');

	const departNiveaux = $derived(niveauxDe(actuels));
	const departAdmin = $derived(adminDe(actuels));
	const memes = (a: Droit[], b: Droit[]) => a.length === b.length && a.every((d) => b.includes(d));
	const modifies = $derived(DOMAINES.filter((d) => choix[d.id] !== departNiveaux[d.id]).length + (memes(adminPermis, departAdmin) ? 0 : 1));
	const message = $derived(modifies === 0 ? '' : modifies === 1 ? '1 domaine modifié, pas encore enregistré' : `${modifies} domaines modifiés, pas encore enregistrés`);

	const numeriques = $derived(Object.fromEntries(Object.entries(choix).filter(([, n]) => typeof n === 'number')) as Partial<Record<DomaineId, number>>);
	const apres = $derived([...appliquerNiveaux(actuels, numeriques).filter((d) => !estDroitPouvoir(d)), ...adminPermis]);
	const personnalise = $derived(estPersonnalise(apres, role.modele));

	function toutRevenir(e: Event) {
		e.preventDefault();
		if (!data.modele) return;
		choix = niveauxDe(data.modele.droits);
		if (peutAdmin) admin = adminDe(data.modele.droits);
	}

	const concerne = (cible: string) => form?.cible === cible;
	// Un bloc s'ouvre seulement s'il est visé ; sinon aucun attribut open n'est posé, et l'hydratation ne referme pas ce que l'agent a ouvert.
	const ouvert = (cible: string) => (concerne(cible) && !form?.succes ? { open: true } : {});
	const erreurs = (cible: string): Record<string, string> => (concerne(cible) ? (form?.erreurs ?? {}) : {});
	const saisie = (champ: 'nom' | 'nature' | 'attributeur', defaut: string) => (concerne('role') ? (form?.valeurs?.[champ] ?? defaut) : defaut);
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

<div class="en-tete-role">
	<EnTetePage titre={role.nom} phrase="{porteeLibelle} · {quiAttribue(role.attributeur, data.comitesChoix)}">
		{#snippet tete()}<IconeRole icone={iconeDuRole(role)} taille={48} />{/snippet}
	</EnTetePage>
	<div class="pastilles">
		{#if data.modele}<Pastille ton="neutre">Modèle : {data.modele.nom}</Pastille>{/if}
		{#if personnalise}<Pastille ton="alerte">Personnalisé</Pastille>{/if}
		{#if role.systeme !== null}<Pastille ton="neutre">Rôle système</Pastille>{/if}
		{#if role.archiveeLe !== null}<Pastille ton="neutre">Archivé</Pastille>{/if}
	</div>
</div>

{#if data.raison}<p class="raison">{data.raison}</p>{/if}
{@render retour('role')}

<p class="intro">Ce que ce rôle peut faire, en plus de ce que tout agent fait déjà.{lectureSeule ? '' : ' Touchez un domaine pour le régler.'}</p>

<svelte:element this={lectureSeule ? 'div' : 'form'} class="formulaire" {...lectureSeule ? {} : { method: 'POST', action: '?/enregistrer', id: 'role' }}>
	<Domaines droits={actuels} modele={data.modele?.droits ?? null} bind:choix {lectureSeule} formRevenir="revenir" />

	<Groupe titre="Administration de l’appli" resume={adminPermis.length === 0 ? 'Aucun pouvoir' : adminPermis.map((d) => ADMINISTRATION.find((a) => a.droit === d)?.libelle).join(', ')}>
		<fieldset class="admin" aria-describedby={peutAdmin ? undefined : 'admin-aide'}>
			<legend class="cache">Administration de l’appli</legend>
			<!-- Grisées pour l'une de deux raisons : le rôle est figé, ou la personne ne gère pas le pouvoir. -->
			{#if !peutAdmin}
				<p id="admin-aide" class="aide">{lectureSeule ? 'Ces cases ne se modifient pas sur ce rôle.' : 'Seuls le chef de centre, son adjoint et le super administrateur cochent ou décochent ces cases.'}</p>
			{:else}
				<input type="hidden" name="administration" value="oui" />
			{/if}
			{#if portePasCentre}<p id="admin-centre" class="aide">{RESERVE_AU_CENTRE}</p>{/if}
			{#each ADMINISTRATION as a (a.droit)}
				{@const reserve = portePasCentre && estDroitDuCentre(a.droit)}
				<label class="case"
					><input
						type="checkbox"
						name="admin"
						value={a.droit}
						checked={adminPermis.includes(a.droit)}
						disabled={!peutAdmin || reserve}
						aria-describedby={reserve ? 'admin-centre' : undefined}
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
					<Choix id="role-portee" name="portee" libelle="Portée" bind:valeur={portee} erreur={erreurs('role').portee} options={PORTEES} />
				{/if}
				<Choix id="role-attributeur" name="attributeur" libelle="Qui attribue" valeur={saisie('attributeur', valeurAttributeur(role.attributeur))} erreur={erreurs('role').attributeur} options={optionsAttributeur(data.comitesChoix)} />
				<ChoixIcone valeur={(saisis?.icone as ReturnType<typeof iconeDuRole> | undefined) ?? iconeDuRole(role)} erreur={erreurs('role').icone} />
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

<details class="pli repli" {...ouvert('detail')}>
	<summary>Détail droit par droit</summary>
	{@render retour('detail')}
	{#if lectureSeule}
		<ul class="detail">
			{#each actuels.filter((d) => !estSansEffet(d)) as d (d)}<li>{LIBELLES_DROIT[d]}</li>{:else}<li>Aucun droit en plus de ceux de tout agent.</li>{/each}
		</ul>
	{:else}
		<form method="POST" action="?/detail" class="formulaire-detail">
			{#each [{ titre: 'Droits métier', liste: data.droitsMetier, pouvoir: false }, { titre: 'Droits d’administration', liste: data.droitsPouvoir, pouvoir: true }] as bloc (bloc.titre)}
				<fieldset>
					<legend>{bloc.titre}</legend>
					{#if bloc.pouvoir && detailPasCentre}<p id="detail-centre" class="aide">{RESERVE_AU_CENTRE}</p>{/if}
					{#each bloc.liste as d (d)}
						{@const verrouille = role.droits.some((x) => x.droit === d && x.verrouille)}
						{@const reserve = detailPasCentre && estDroitDuCentre(d)}
						<label class="case"
							><input type="checkbox" name="droits" value={d} checked={actuels.includes(d) && !reserve} disabled={verrouille || reserve || (bloc.pouvoir && !data.peutPouvoir)} aria-describedby={reserve ? 'detail-centre' : undefined} />
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
	<details class="pli repli" {...ouvert('archiver')}>
		<summary>Archiver le rôle</summary>
		{@render retour('archiver')}
		<form method="POST" action="?/archiver" class="formulaire-detail">
			<p class="avertissement">{avertissement(role.titulaires)}</p>
			<label class="case"><input type="checkbox" name="confirmation" value="oui" /> Je confirme</label>
			<Bouton type="submit" variante="grave">Archiver le rôle</Bouton>
		</form>
	</details>
{/if}

<style>
	.en-tete-role {
		display: flex;
		flex-direction: column;
		gap: var(--espace-8);
	}
	p {
		margin: 0;
	}
	.intro,
	.aide {
		color: var(--doux);
	}
	.pastilles {
		display: flex;
		flex-wrap: wrap;
		gap: var(--espace-6);
	}
	.raison {
		padding: var(--espace-12) var(--espace-16);
		border-radius: var(--rayon-petit);
		background: var(--statut-neutre-fond);
		border: 1px solid var(--statut-neutre-trait);
	}
	.formulaire {
		display: flex;
		flex-direction: column;
		gap: var(--espace-12);
	}
	.admin,
	fieldset {
		border: none;
		margin: 0;
		padding: var(--espace-12) var(--espace-16);
	}
	.cache {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}
	.champs {
		padding: var(--espace-12) var(--espace-16) var(--espace-16);
		display: flex;
		flex-direction: column;
		gap: var(--espace-16);
	}
	.case {
		display: flex;
		align-items: center;
		gap: var(--espace-12);
		min-height: var(--cible);
	}
	.secondaire {
		min-height: var(--cible);
		padding: 0 var(--espace-20);
		border-radius: var(--rayon-petit);
		border: 2px solid var(--doux);
		background: var(--surface);
		color: var(--encre);
		font: 700 var(--texte-16) var(--police);
		cursor: pointer;
	}
	.pli {
		background: var(--surface);
		border: 1px solid transparent;
		box-shadow: var(--ombre-carte);
		border-radius: var(--rayon-grand);
		padding: 0 var(--espace-16);
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
		gap: var(--espace-12);
		padding-bottom: var(--espace-16);
	}
	.formulaire-detail > :global(button) {
		align-self: flex-start;
	}
	legend {
		font-weight: 700;
	}
	.detail {
		margin: 0 0 var(--espace-16);
	}
	.avertissement {
		font-weight: 600;
	}
	.echec,
	.succes {
		padding: var(--espace-12) var(--espace-16);
		border-radius: var(--rayon-petit);
		border: 2px solid var(--accent);
		font-weight: 600;
	}
	.succes {
		border-color: var(--ok);
	}
</style>
