<script lang="ts">
	import { tick } from 'svelte';
	import { enhance, type SubmitFunction } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { ElementFiche, VuePrise } from '@gyro-caserne/socle';
	import { dateCourte, etatPrise, GENRES, heureCourte, texteEcart, texteEtape, texteReleve } from '#lib/engins/textes.ts';
	import { reduirePhoto } from '#lib/murs/reduire-photo.ts';
	import { pluriel } from '#lib/pluriel.ts';
	import Bouton from '#lib/ui/Bouton.svelte';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';
	import Groupe from '#lib/ui/Groupe.svelte';
	import Panneau from '#lib/planning/Panneau.svelte';
	import Pastille from '#lib/ui/Pastille.svelte';

	type Reponse = { cible?: string; zone?: number | null; succes?: string; message?: string } | null;
	let { data, form }: { data: VuePrise & { moi?: number | null }; form: Reponse } = $props();

	const e = $derived(data.engin);
	const p = $derived(data.prise);
	const s = $derived(p?.saisie);
	const pour = (cible: string) => (form?.cible === cible ? form : null);
	const ouverteSur = (ref: number | null) => data.ouvertes.find((o) => o.ref === ref);
	const ecartsDe = (refs: ElementFiche[]) => refs.filter((x) => s?.ecarts[String(x.ref)]).length;
	const vue = (ref: number) => s?.zones.includes(ref) ?? false;
	const vues = $derived(data.zones.filter((z) => vue(z.ref)).length);
	const nbEcarts = $derived(Object.keys(s?.ecarts ?? {}).length);
	const nbRetrouves = $derived(s?.retrouves.length ?? 0);
	// La zone touchée reste ouverte (marquée complète, on y signale encore un écart) ; la première à voir s'ouvre aussi.
	const premiereAVoir = $derived(data.zones.find((z) => !vue(z.ref))?.ref);
	const ouverte = (ref: number) => form?.zone === ref || premiereAVoir === ref;
	const astreinte = $derived(data.agents.filter((a) => a.astreinte));
	const autres = $derived(data.agents.filter((a) => !a.astreinte));
	const coche = (id: number) => s?.participants.includes(id) ?? false;
	// Participants : une rangée en tête, qui ouvre le panneau (`?participants`).
	const noms = $derived(data.agents.filter((a) => coche(a.id)).map((a) => (a.id === data.moi ? 'vous' : a.nom)));
	const resumeParticipants = $derived.by(() => {
		const avecMoi = data.moi != null && coche(data.moi);
		const autresCoches = (s?.participants.length ?? 0) - (avecMoi ? 1 : 0);
		if (avecMoi) return autresCoches ? `vous + ${autresCoches}` : 'vous seul';
		return autresCoches ? `${autresCoches} ${autresCoches > 1 ? 'agents' : 'agent'}` : 'personne';
	});
	const panneauParticipants = $derived(page.url.searchParams.has('participants'));
	// Les autres agents : avec JavaScript, seuls les cochés et ceux que la recherche trouve ; sans, tous.
	let cherche = $state('');
	let avecJs = $state(false);
	// Cochés dans le panneau, pour qu'ils restent visibles quand la recherche change.
	let touches = $state<number[]>([]);
	$effect(() => {
		avecJs = true;
	});
	const sansAccent = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr');
	const montre = (a: { id: number; nom: string }) => !avecJs || coche(a.id) || touches.includes(a.id) || (cherche.trim() !== '' && sansAccent(a.nom).includes(sansAccent(cherche.trim())));
	const fermerParticipants = $derived(`/engins/${data.engin.id}/prise`);
	const enregistrerParticipants: SubmitFunction = () => async ({ result, update }) => {
		if (result.type === 'success') await goto(fermerParticipants, { invalidateAll: true });
		else await update();
	};
	const validee = $derived(page.url.searchParams.has('validee'));

	// Avec JavaScript, la photo est réduite avant l'envoi (200 Ko au plus, comme ailleurs) ; le focus revient à la zone.
	let erreurPhoto = $state('');
	const envoi: SubmitFunction = async ({ formData, cancel }) => {
		erreurPhoto = '';
		const fichier = formData.get('photo');
		if (fichier instanceof File && fichier.size > 0) {
			try {
				formData.set('photo', await reduirePhoto(fichier), 'photo.jpg');
			} catch (x) {
				erreurPhoto = x instanceof Error ? `${x.message}.` : 'Photo illisible.';
				return cancel();
			}
		}
		const zone = formData.get('zone');
		return async ({ update }) => {
			await update({ reset: false });
			await tick();
			// On reste sur la zone touchée : marquée complète, on y signale encore un écart ; la suivante à voir est ouverte dessous.
			if (zone) document.getElementById(`zone-${zone}`)?.focus({ preventScroll: true });
		};
	};
</script>

<svelte:head>
	<title>Prise de garde · {e.nom} · Gyro Caserne</title>
</svelte:head>

{#snippet message(cible: string)}
	{#if pour(cible)?.message}<p class="echec" role="alert">{pour(cible)?.message}</p>{/if}
{/snippet}

{#snippet signale(o: (typeof data.ouvertes)[number])}
	<span class="signale">
		<strong>{texteEcart(o)}</strong>
		<span class="doux">Signalé le {dateCourte(o.signaleeLe)} par {o.signaleePar} · <a href="/engins/anomalies/{o.id}">{texteEtape(o)}<span class="masque">{' '}: suivi de l’anomalie {o.libelle}</span></a></span>
	</span>
	{#if o.photo}<a class="vignette" href="/engins/photo/{o.photo}"><img src="/engins/photo/{o.photo}" alt="Photo de l’écart : {o.libelle}" width="56" height="56" loading="lazy" /></a>{/if}
{/snippet}

<div class="page">
	<EnTetePage titre="Prise de garde · {e.nom}" phrase="{texteReleve(data.releve)} · fiche {e.type}" gyro tenue="garde" retour={{ href: '/engins/prise', libelle: 'Prise de garde' }} />

	<div role="status" class="masque">{form?.succes ?? ''}</div>

	{#if p === null}
		<section class="panneau" aria-labelledby="titre-debut">
			<h2 id="titre-debut">À faire</h2>
			{#if data.ouvertes.length}
				<p>Encore signalé sur cet engin depuis une prise précédente. Pendant la prise, vous direz si un élément est retrouvé.</p>
				<ul class="ouvertes" role="list">
					{#each data.ouvertes as o (o.id)}
						<li><span class="quoi">{o.libelle} <span class="doux">· {o.zone}</span></span>{@render signale(o)}</li>
					{/each}
				</ul>
			{:else}
				<p>Aucun écart ouvert sur cet engin.</p>
			{/if}
			{#if data.peutFaire}
				<form method="POST" action="?/commencer" use:enhance>
					<Bouton type="submit">Commencer la prise</Bouton>
				</form>
				<p class="doux">Zone par zone, « Tout est complet » en un geste ; on ne détaille que les écarts. Le brouillon est gardé : un collègue peut le reprendre sur son téléphone.</p>
				{@render message('commencer')}
			{:else}
				<p class="doux">La prise de garde est faite par les agents du centre.</p>
			{/if}
		</section>
	{:else if p.etat === 'validee'}
		<section class="panneau fait" aria-labelledby="titre-fait">
			<h2 id="titre-fait">{validee ? 'Prise validée, merci.' : 'Prise faite'}</h2>
			<p><Pastille ton="ok">{etatPrise({ etat: 'validee', valideeLe: p.valideeLe, equipe: data.releve.equipe?.nom ?? null, par: p.modifieePar })}</Pastille></p>
			<p>{pluriel(p.saisie.participants.length, 'participant')} · {pluriel(Object.keys(p.saisie.ecarts).length, 'écart')} · {pluriel(p.saisie.retrouves.length, 'élément retrouvé', 'éléments retrouvés')}</p>
			<a class="lien-secondaire" href="/engins/{e.id}">Voir l’engin et l’historique des prises</a>
		</section>
	{:else}
		<section class="suivi" aria-label="Où en est la prise">
			<p>Commencée par <strong>{p.commenceePar}</strong> à {heureCourte(p.commenceeLe)}{#if p.modifieeLe.slice(0, 16) !== p.commenceeLe.slice(0, 16) || p.modifieePar !== p.commenceePar}, modifiée par <strong>{p.modifieePar}</strong> à {heureCourte(p.modifieeLe)}{/if}.</p>
			<p class="doux">Brouillon gardé sur le serveur : un collègue peut le reprendre depuis son téléphone.</p>
			<div class="jauge">
				<span>{vues} {vues > 1 ? 'zones vues' : 'zone vue'} sur {data.zones.length}</span>
				<progress max={data.zones.length || 1} value={vues} aria-label="Zones vues">{vues} sur {data.zones.length}</progress>
			</div>
			<a class="rangee-participants" href="?participants" data-sveltekit-noscroll>
				<span><strong>Participants :</strong> {resumeParticipants}</span>
				<span class="doux">Modifier<span class="masque">{' '}les participants</span></span>
			</a>
			{@render message('participants')}
		</section>

		{#if erreurPhoto}<p class="echec" role="alert">{erreurPhoto}</p>{/if}

		<div class="zones">
			{#each data.zones as z (z.ref)}
				{@const n = ecartsDe(z.elements)}
				<Groupe titre={z.nom} resume={vue(z.ref) ? (n ? `Complète sauf ${pluriel(n, 'écart')}` : 'Complète') : n ? `À finir · ${pluriel(n, 'écart')}` : 'À voir'} ouvert={ouverte(z.ref)}>
					<div class="zone" id="zone-{z.ref}" tabindex="-1" role="group" aria-label="Zone {z.nom}">
						<form method="POST" action="?/geste" use:enhance={envoi} class="tete-zone">
							<input type="hidden" name="prise" value={p.id} />
							<input type="hidden" name="quoi" value="zone" />
							<input type="hidden" name="zone" value={z.ref} />
							<input type="hidden" name="cible" value="zone:{z.ref}" />
							{#if vue(z.ref)}
								<p class="ok"><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10" /></svg> Complet{n ? ` sauf ${pluriel(n, 'écart')}` : ''}</p>
								<button type="submit" class="petit" name="vue" value="0">Revoir la zone<span class="masque">{' '}{z.nom}</span></button>
							{:else}
								<Bouton type="submit">{n ? 'Le reste est complet' : 'Tout est complet'}<span class="masque">{' '}: {z.nom}</span></Bouton>
								<span class="doux">Puis touchez seulement un élément à problème.</span>
								<input type="hidden" name="vue" value="1" />
							{/if}
						</form>
						{@render message(`zone:${z.ref}`)}
						<ul role="list" class="elements">
							{#each z.elements as el (el.ref)}
								{@const o = ouverteSur(el.ref)}
								{@const ecart = s?.ecarts[String(el.ref)]}
								<li class:alerte={o || ecart}>
									<div class="element">
										<span class="libelle">{el.libelle}</span>
										{#if el.quantite !== null}<span class="quantite">{el.quantite}<span class="masque">{' '}attendus</span></span>{/if}
									</div>
									{#if o}
										<div class="encadre">
											{@render signale(o)}
											{#if s?.retrouves.includes(o.id)}
												<p class="ok">Retrouvé : le signalement sera clos à la validation.</p>
											{:else}
												<p>Retrouvé ou réparé ?</p>
											{/if}
											<form method="POST" action="?/geste" use:enhance={envoi} class="gestes">
												<input type="hidden" name="prise" value={p.id} />
												<input type="hidden" name="quoi" value="retrouve" />
												<input type="hidden" name="anomalie" value={o.id} />
												<input type="hidden" name="zone" value={z.ref} />
												<input type="hidden" name="cible" value="element:{el.ref}" />
												{#if s?.retrouves.includes(o.id)}
													<button type="submit" class="petit" name="oui" value="0">Non, toujours là<span class="masque">{' '}: {el.libelle}</span></button>
												{:else}
													<button type="submit" class="petit" name="oui" value="1">Oui, clore le signalement<span class="masque">{' '}: {el.libelle}</span></button>
												{/if}
											</form>
										</div>
									{/if}
									<!-- Retrouvé, l'élément peut avoir un nouvel écart. -->
									{#if !o || s?.retrouves.includes(o.id)}
										{#if ecart}
											<div class="encadre">
												<span class="signale"><strong>{texteEcart(ecart, el.quantite)}</strong></span>
												{#if ecart.photo}<a class="vignette" href="/engins/photo/{ecart.photo}"><img src="/engins/photo/{ecart.photo}" alt="Photo de l’écart : {el.libelle}" width="56" height="56" loading="lazy" /></a>{/if}
											</div>
										{/if}
										<div class="gestes">
										<details open={pour(`element:${el.ref}`)?.message !== undefined}>
											<summary>{ecart ? 'Modifier l’écart' : 'Signaler un écart'}<span class="masque">{' '}: {el.libelle}</span></summary>
											<form method="POST" action="?/geste" enctype="multipart/form-data" use:enhance={envoi} class="formulaire">
												<input type="hidden" name="prise" value={p.id} />
												<input type="hidden" name="quoi" value="ecart" />
												<input type="hidden" name="element" value={el.ref} />
												<input type="hidden" name="zone" value={z.ref} />
												<input type="hidden" name="cible" value="element:{el.ref}" />
												<fieldset>
													<legend>Écart</legend>
													{#each Object.entries(GENRES) as [valeur, libelle] (valeur)}
														<label class="choix"><input type="radio" name="genre" value={valeur} checked={(ecart?.genre ?? 'manquant') === valeur} /> {libelle}</label>
													{/each}
												</fieldset>
												{#if el.quantite !== null}
													<div class="champ">
														<label for="manque-{el.ref}">Combien manquent ? <span class="doux">(sur {el.quantite}, si manquant)</span></label>
														<input id="manque-{el.ref}" name="manque" type="number" inputmode="numeric" min="1" max={el.quantite} value={ecart?.manque ?? ''} />
													</div>
												{/if}
												<div class="champ">
													<label for="note-{el.ref}">Note <span class="doux">(facultative)</span></label>
													<textarea id="note-{el.ref}" name="note" maxlength="300" rows="2">{ecart?.note ?? ''}</textarea>
												</div>
												<div class="champ">
													<label for="photo-{el.ref}">{ecart?.photo ? 'Remplacer la photo' : 'Photo'} <span class="doux">(facultative)</span></label>
													<input id="photo-{el.ref}" name="photo" type="file" accept="image/*" capture="environment" />
													{#if ecart?.photo}<label class="choix"><input type="checkbox" name="retirer_photo" value="1" /> Retirer la photo</label>{/if}
												</div>
												<div class="gestes">
													<Bouton type="submit">Enregistrer l’écart<span class="masque">{' '}: {el.libelle}</span></Bouton>
												</div>
											</form>
										</details>
										{#if ecart}
											<form method="POST" action="?/geste" use:enhance={envoi}>
												<input type="hidden" name="prise" value={p.id} />
												<input type="hidden" name="quoi" value="retirer_ecart" />
												<input type="hidden" name="element" value={el.ref} />
												<input type="hidden" name="zone" value={z.ref} />
												<input type="hidden" name="cible" value="element:{el.ref}" />
												<button type="submit" class="petit">Retirer l’écart<span class="masque">{' '}: {el.libelle}</span></button>
											</form>
										{/if}
										</div>
									{/if}
									{@render message(`element:${el.ref}`)}
								</li>
							{/each}
						</ul>
						{#if z.elements.length === 0}<p class="doux">Aucun élément dans cette zone.</p>{/if}


					</div>
				</Groupe>
			{/each}
		</div>

		<section class="panneau" aria-labelledby="titre-valider">
			<h2 id="titre-valider" tabindex="-1">Valider</h2>
			{#if vues < data.zones.length}
				<p>Il reste {pluriel(data.zones.length - vues, 'zone')} à voir.</p>
			{/if}
			<p>
				{nbEcarts ? `${pluriel(nbEcarts, 'écart deviendra', 'écarts deviendront')} ${nbEcarts > 1 ? 'des anomalies suivies' : 'une anomalie suivie'}.` : 'Aucun écart.'}
				{#if nbRetrouves}{pluriel(nbRetrouves, 'signalement retrouvé sera clos', 'signalements retrouvés seront clos')}.{/if}
				L’engin reste disponible : seuls le référent engins et les chefs décident d’une indisponibilité.
			</p>
			<p class="valider-participants">La prise sera au nom de : <strong>{noms.join(', ') || 'vous'}</strong>. <a href="?participants" data-sveltekit-noscroll>Modifier les participants</a></p>
			<form method="POST" action="?/valider" use:enhance>
				<input type="hidden" name="prise" value={p.id} />
				<Bouton type="submit">Valider la prise</Bouton>
			</form>
			{@render message('valider')}
			<details class="abandon" open={pour('abandonner')?.message !== undefined}>
				<summary>Abandonner la prise…</summary>
				<form method="POST" action="?/abandonner" use:enhance class="formulaire">
					<input type="hidden" name="prise" value={p.id} />
					<p>Le brouillon et ses photos seront effacés.</p>
					<div><Bouton type="submit" variante="secondaire">Oui, abandonner</Bouton></div>
				</form>
				{@render message('abandonner')}
			</details>
		</section>

		{#if panneauParticipants}
			<Panneau titre="Participants" fermer={fermerParticipants}>
				<form method="POST" action="?/geste" use:enhance={enregistrerParticipants} class="formulaire participants">
					<input type="hidden" name="prise" value={p.id} />
					<input type="hidden" name="quoi" value="participants" />
					<input type="hidden" name="cible" value="participants" />
					<p class="doux">La prise est au nom de tous ceux qui l’ont faite. Celui qui valide en fait partie.</p>
					{#if astreinte.length}
						<fieldset>
							<legend>{data.releve.equipe ? data.releve.equipe.nom : 'Équipe d’astreinte'}</legend>
							<div class="pastilles">
								{#each astreinte as a (a.id)}<label class="pastille-choix"><input type="checkbox" name="participant" value={a.id} checked={coche(a.id)} /> {a.id === data.moi ? `${a.nom} (vous)` : a.nom}</label>{/each}
							</div>
						</fieldset>
					{/if}
					<fieldset>
						<legend>{astreinte.length ? 'Un remplaçant, un renfort' : 'Agents du centre'}</legend>
						<div class="champ">
							<label for="cherche-agent">Chercher un agent <span class="doux">(nom ou prénom)</span></label>
							<input id="cherche-agent" type="search" autocomplete="off" bind:value={cherche} />
						</div>
						<div class="pastilles">
							{#each autres as a (a.id)}<label class="pastille-choix" hidden={!montre(a)}><input type="checkbox" name="participant" value={a.id} checked={coche(a.id)} onchange={() => (touches = [...touches, a.id])} /> {a.id === data.moi ? `${a.nom} (vous)` : a.nom}</label>{/each}
						</div>
					</fieldset>
					<div><Bouton type="submit">Enregistrer les participants</Bouton></div>
				</form>
			</Panneau>
		{/if}
	{/if}
</div>

<style>
	.page,
	.zones,
	.zone,
	.panneau,
	.suivi {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.zones {
		gap: 10px;
	}
	.zone {
		gap: 12px;
		padding: 4px 14px 14px;
	}
	.zone:focus-visible {
		outline: 3px solid var(--encre);
		outline-offset: 2px;
	}
	p,
	h2,
	ul,
	fieldset {
		margin: 0;
	}
	h2 {
		font: 700 1.25rem var(--police-titre);
	}
	.doux {
		color: var(--doux);
	}
	.panneau,
	.suivi {
		gap: 12px;
		padding: 16px;
		background: var(--surface);
		border: 1px solid var(--trait-doux);
		border-radius: var(--rayon-grand);
	}
	.fait {
		border-left: 6px solid var(--statut-ok-trait);
	}
	.jauge {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-weight: 700;
	}
	progress {
		width: 100%;
		height: 10px;
		accent-color: var(--statut-ok-texte);
	}
	ul {
		padding: 0;
		list-style: none;
	}
	.elements li,
	.ouvertes li {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 12px 0;
	}
	.elements li + li,
	.ouvertes li + li {
		border-top: 1px solid var(--trait-doux);
	}
	.element {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.libelle,
	.quoi {
		flex: 1;
		font-weight: 600;
		overflow-wrap: anywhere;
	}
	.quantite {
		flex: none;
		min-width: 2.5em;
		padding: 0 8px;
		border: 1px solid var(--trait);
		border-radius: 999px;
		text-align: center;
		font-weight: 700;
	}
	.encadre {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 12px;
		padding: 10px 12px;
		border: 1px solid var(--statut-alerte-trait);
		border-left-width: 4px;
		border-radius: var(--rayon-petit);
		background: var(--statut-alerte-fond);
		color: var(--statut-alerte-texte);
	}
	.encadre p,
	.encadre form {
		flex-basis: 100%;
	}
	.signale {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.encadre .doux {
		color: inherit;
		font-size: 0.875rem;
	}
	.vignette img {
		display: block;
		width: 56px;
		height: 56px;
		object-fit: cover;
		border-radius: 8px;
		border: 1px solid var(--trait);
	}
	.ok {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-weight: 700;
		color: var(--statut-ok-texte);
	}
	.gestes {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px;
	}
	.tete-zone {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px;
		padding-bottom: 12px;
		border-bottom: 1px solid var(--trait-doux);
	}
	.rangee-participants {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 4px 12px;
		min-height: var(--cible);
		padding: 8px 12px;
		border: 1px solid var(--trait);
		border-radius: var(--rayon-petit);
		color: var(--encre);
		text-decoration: none;
	}
	.valider-participants a {
		color: inherit;
	}
	.rangee-participants:hover {
		background: var(--fond);
	}
	.pastilles {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		width: 100%;
	}
	.pastille-choix {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-height: var(--cible);
		padding: 0 14px;
		border: 1px solid var(--trait);
		border-radius: 999px;
		cursor: pointer;
	}
	.pastille-choix[hidden] {
		display: none;
	}
	.pastille-choix:has(input:checked) {
		border-color: var(--encre);
		background: var(--encre);
		color: var(--surface);
	}
	.pastille-choix input {
		width: 20px;
		height: 20px;
		accent-color: var(--rouge);
	}
	input[type='search'] {
		min-height: var(--cible);
		padding: 8px 12px;
		border: 2px solid var(--doux);
		border-radius: var(--rayon-petit);
		background: var(--surface);
		color: var(--encre);
		font: inherit;
	}
	.petit,
	summary {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: var(--cible);
		padding: 0 14px;
		border: 1px solid var(--trait);
		border-radius: 999px;
		background: var(--surface);
		color: var(--encre);
		font: 600 0.9375rem var(--police);
		cursor: pointer;
		list-style: none;
	}
	summary::-webkit-details-marker {
		display: none;
	}
	details {
		align-self: flex-start;
	}
	details[open] {
		align-self: stretch;
		flex-basis: 100%;
	}
	.formulaire {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 12px 0 4px;
	}
	fieldset {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 16px;
		padding: 0;
		border: none;
	}
	legend {
		margin-bottom: 4px;
		font-weight: 700;
	}
	.choix {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-height: var(--cible);
	}
	.choix input {
		width: 22px;
		height: 22px;
		accent-color: var(--rouge);
	}
	.champ {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	label {
		font-weight: 600;
	}
	input[type='number'],
	textarea {
		min-height: var(--cible);
		padding: 8px 12px;
		border: 2px solid var(--doux);
		border-radius: var(--rayon-petit);
		background: var(--surface);
		color: var(--encre);
		font: inherit;
	}
	input[type='number'] {
		max-width: 8rem;
	}
	.abandon {
		padding-top: 12px;
	}
	.echec {
		padding: 10px 14px;
		border-radius: var(--rayon-petit);
		border: 2px solid var(--accent);
		font-weight: 600;
	}
	@media (min-width: 1024px) {
		.page {
			max-width: 52rem;
		}
	}
</style>
