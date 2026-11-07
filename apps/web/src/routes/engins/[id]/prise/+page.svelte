<script lang="ts">
	import { tick } from 'svelte';
	import { enhance, type SubmitFunction } from '$app/forms';
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import type { ElementFiche, VuePrise, ZoneFiche } from '@gyro-caserne/socle';
	import { dateCourte, etatPrise, GENRES, heureCourte, texteEcart, texteEtape, texteReleve } from '#lib/engins/textes.ts';
	import { reduirePhoto } from '#lib/murs/reduire-photo.ts';
	import { pluriel } from '#lib/pluriel.ts';
	import Bouton from '#lib/ui/Bouton.svelte';
	import ChampPhoto from '#lib/ui/ChampPhoto.svelte';
	import ChoixRadio from '#lib/ui/ChoixRadio.svelte';
	import Retour from '#lib/ui/Retour.svelte';
	import Panneau from '#lib/planning/Panneau.svelte';
	import Pastille from '#lib/ui/Pastille.svelte';

	type Reponse = { cible?: string; zone?: number | null; zoneFaite?: number; succes?: string; message?: string } | null;
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
	const premiereAVoir = $derived(data.zones.find((z) => !vue(z.ref))?.ref);
	const toutVu = $derived(vues === data.zones.length);
	// La zone à l'écran : celle choisie ou touchée ; après « Tout est complet », la suivante à voir. Sans JavaScript, le sélecteur passe par l'adresse.
	let choisie = $state<number | null>(null);
	const zoneAffichee = $derived.by(() => {
		const adresse = form?.zoneFaite ? null : Number(page.url.searchParams.get('zone'));
		const refs = [choisie, form?.zone, adresse, premiereAVoir, data.zones[0]?.ref];
		return refs.flatMap((r) => data.zones.filter((z) => z.ref === r))[0];
	});
	const zoneFaite = $derived(s && data.zones.find((z) => z.ref === form?.zoneFaite && vue(z.ref)));
	const etatZone = (z: ZoneFiche) => {
		const n = ecartsDe(z.elements);
		const signales = z.elements.filter((x) => { const o = ouverteSur(x.ref); return o && !s?.retrouves.includes(o.id); }).length;
		const etat = vue(z.ref) ? [n ? `Complet sauf ${pluriel(n, 'écart')}` : 'Tout est complet'] : n ? ['À finir', pluriel(n, 'écart')] : [z.elements.length ? `${z.elements.length} à voir` : 'À voir'];
		const infos = signales ? [...etat, pluriel(signales, 'signalé')] : etat;
		// Deux infos courtes : un point ; trois : des virgules.
		return infos.join(infos.length > 2 ? ', ' : ' · ');
	};
	// Signalés sur des éléments absents de la fiche : ils ne se voient dans aucune zone.
	const horsFiche = $derived(data.ouvertes.filter((o) => !data.zones.some((z) => z.elements.some((x) => x.ref === o.ref))));
	const dansLaFiche = $derived(data.ouvertes.length - horsFiche.length);
	// Après un choix de zone : son titre à l'écran et le focus. Le sélecteur à côté (ordinateur), on ne défile que si le titre est caché.
	function montrerZone() {
		const titre = document.getElementById('titre-zone');
		const selecteur = document.querySelector('.selecteur');
		if (!titre || !selecteur) return;
		const { left, top, bottom } = titre.getBoundingClientRect();
		const aCote = selecteur.getBoundingClientRect().right <= left;
		if (!aCote || top < 0 || bottom > window.innerHeight) titre.scrollIntoView({ block: 'start' });
		titre.focus({ preventScroll: true });
	}
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
	const panneauParticipants = $derived(data.peutFaire && page.url.searchParams.has('participants'));
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
		return async ({ result, update, formElement }) => {
			// Un refus vient souvent d'un collègue (abandon, validation) ou d'une nouvelle relève : la page se remet à jour.
			if (result.type === 'failure') await invalidateAll();
			await update({ reset: false });
			const reponse = result.type === 'success' || result.type === 'failure' ? (result.data as Reponse) : null;
			choisie = reponse?.zoneFaite ? null : (reponse?.zone ?? choisie);
			if (result.type === 'success') {
				formElement.closest('details')?.removeAttribute('open');
				// `reset: false` garde le fichier choisi : il ne doit pas repartir avec le prochain écart.
				document.querySelectorAll<HTMLInputElement>('input[name="photo"]').forEach((champ) => {
					champ.value = '';
					champ.dispatchEvent(new Event('change', { bubbles: true }));
				});
			}
			await tick();
			if (reponse?.zoneFaite) {
				if (toutVu) {
					document.getElementById('valider')?.scrollIntoView({ block: 'start' });
					document.getElementById('titre-valider')?.focus({ preventScroll: true });
				} else montrerZone();
			} else if (zone) document.getElementById('titre-zone')?.focus({ preventScroll: true });
		};
	};
</script>

<svelte:head>
	<title>Prise de garde · {e.nom} · Gyro Caserne</title>
</svelte:head>

{#snippet message(cible: string)}
	{#if pour(cible)?.message}<p class="echec" role="alert">{pour(cible)?.message}</p>{/if}
{/snippet}

{#snippet marque()}
	<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10" /></svg>
{/snippet}

{#snippet signale(o: (typeof data.ouvertes)[number])}
	<span class="signale">
		<strong>{texteEcart(o)}</strong>
		<span class="doux">Signalé le {dateCourte(o.signaleeLe)} par {o.signaleePar} · <a href="/engins/anomalies/{o.id}">{texteEtape(o)}<span class="masque">{' '}: suivi de l’anomalie {o.libelle}</span></a></span>
	</span>
	{#if o.photo}<a class="vignette" href="/engins/photo/{o.photo}"><img src="/engins/photo/{o.photo}" alt="Photo de l’écart : {o.libelle}" width="56" height="56" loading="lazy" /></a>{/if}
{/snippet}

<div class="page">
	<Retour href="/engins/prise" libelle="Prise de garde" />

	<!-- La plaque de l'engin : son nom en grand sur l'à-plat rouge, la relève, les zones vues ; dessous, qui fait la prise. -->
	<section class="plaque" aria-labelledby="titre-engin">
		<div class="aplat">
			<div class="titres">
				<h1 id="titre-engin" tabindex="-1"><span class="masque">{'Prise de garde : '}</span>{e.nom}</h1>
				<p>{texteReleve(data.releve)}</p>
			</div>
			{#if data.zones.length}
				<p class="compteur"><span class="nombre">{vues}<span aria-hidden="true">{' / '}</span><span class="masque">{' sur '}</span>{data.zones.length}</span> {data.zones.length > 1 ? 'zones vues' : 'zone vue'}</p>
			{/if}
		</div>
		{#if p && p.etat !== 'validee'}
			<div class="bande">
				{#if data.peutFaire}
					<a class="participants" href="?participants" data-sveltekit-noscroll>
						<span><span>Participants :</span> <strong>{resumeParticipants}</strong></span>
						<span class="modifier">Modifier<span class="masque">{' '}les participants</span></span>
					</a>
				{:else}
					<p class="participants"><span><span>Participants :</span> <strong>{resumeParticipants}</strong></span></p>
				{/if}
				<p class="doux">Commencée par <strong>{p.commenceePar}</strong> à {heureCourte(p.commenceeLe)}{#if p.modifieeLe.slice(0, 16) !== p.commenceeLe.slice(0, 16) || p.modifieePar !== p.commenceePar}, modifiée par <strong>{p.modifieePar}</strong> à {heureCourte(p.modifieeLe)}{/if}.</p>
			</div>
		{/if}
	</section>

	<div role="status" class="masque">{form?.succes ?? ''}</div>

	{#if p?.etat === 'validee'}
		<section class="panneau fait" aria-labelledby="titre-fait">
			<h2 id="titre-fait">{validee ? 'Prise validée, merci.' : 'Prise faite'}</h2>
			<p><Pastille ton="ok">{etatPrise({ etat: 'validee', valideeLe: p.valideeLe, equipe: data.releve.equipe?.nom ?? null, par: p.modifieePar }).texte}</Pastille></p>
			<p>{pluriel(p.saisie.participants.length, 'participant')}, {pluriel(Object.keys(p.saisie.ecarts).length, 'écart')}, {pluriel(p.saisie.retrouves.length, 'élément retrouvé', 'éléments retrouvés')}</p>
			<a class="lien-secondaire" href="/engins/{e.id}">Voir l’engin et l’historique des prises</a>
		</section>
	{:else}
		{#if p}
			{#if !panneauParticipants}{@render message('participants')}{/if}
		{:else}
			<section class="panneau" aria-label="Avant de commencer">
				{#if data.peutFaire}
					<p>Lisez chaque zone, puis touchez « Tout est complet » sous sa liste. Le premier geste commence la prise ; un collègue peut ensuite la reprendre sur son téléphone.</p>
				{:else}
					<p class="doux">La prise de garde est faite par les agents du centre.</p>
				{/if}
				{#if dansLaFiche}
					<p class="doux">{pluriel(dansLaFiche, 'écart encore signalé', 'écarts encore signalés')} sur cet engin, à voir dans {dansLaFiche > 1 ? 'leur zone' : 'sa zone'}.</p>
				{:else if !horsFiche.length}
					<p class="doux">Aucun écart ouvert sur cet engin.</p>
				{/if}
				{#if data.peutFaire && data.zones.length === 0}
					<!-- Une fiche encore vide : aucun autre geste ne peut commencer la prise. -->
					<form method="POST" action="?/commencer" use:enhance>
						<Bouton type="submit">Commencer la prise</Bouton>
					</form>
				{/if}
				{@render message('commencer')}
			</section>
		{/if}

		{#if horsFiche.length}
			<section class="panneau" aria-labelledby="titre-hors-fiche">
				<h2 id="titre-hors-fiche">Signalé hors de la fiche</h2>
				<ul class="ouvertes" role="list">
					{#each horsFiche as o (o.id)}
						<li><span class="quoi">{o.libelle}{#if o.zone}{' '}<span class="doux">· {o.zone}</span>{/if}</span>{@render signale(o)}</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if erreurPhoto}<p class="echec" role="alert">{erreurPhoto}</p>{/if}
		{@render message('valider')}

		{#if p && data.peutFaire && toutVu}
			<section class="panneau" id="valider" aria-labelledby="titre-valider">
				<h2 id="titre-valider" tabindex="-1">Valider</h2>
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
			</section>
		{/if}

		{#if zoneAffichee}
			{@const z = zoneAffichee}
			{@const n = ecartsDe(z.elements)}
			<div class="parcours" id="parcours">
				<nav class="selecteur" aria-label="Zones de l’engin">
					<ul role="list">
						{#each data.zones as zone (zone.ref)}
							<li>
								<a
									href="?zone={zone.ref}#titre-zone"
									class={vue(zone.ref) ? 'vue' : undefined}
									aria-current={zone.ref === z.ref ? 'true' : undefined}
									data-sveltekit-preload-data="off"
									data-sveltekit-noscroll
									onclick={async (ev) => {
										ev.preventDefault();
										choisie = zone.ref;
										await tick();
										montrerZone();
									}}
								>
									<span class="nom-zone">{#if vue(zone.ref)}{@render marque()}{/if}{zone.nom}</span>
									<span class="etat-zone">{etatZone(zone)}</span>
								</a>
							</li>
						{/each}
					</ul>
				</nav>

				<section class="contenu" aria-labelledby="titre-zone">
					<h2 id="titre-zone" class="titre-groupe" tabindex="-1">{z.nom}{#if z.elements.length}{' '}<span class="compte">{z.elements.length}<span class="masque">{z.elements.length > 1 ? ' éléments' : ' élément'}</span></span>{/if}</h2>
					{#if p && zoneFaite && data.peutFaire}
						<form method="POST" action="?/geste" use:enhance={envoi} class="zone-faite">
							<input type="hidden" name="prise" value={p.id} />
							<input type="hidden" name="quoi" value="zone" />
							<input type="hidden" name="zone" value={zoneFaite.ref} />
							<input type="hidden" name="cible" value="zone:{zoneFaite.ref}" />
							<p class="ok">{@render marque()} {zoneFaite.nom} : tout est complet.</p>
							<button type="submit" class="petit" name="vue" value="0">Annuler<span class="masque">{' '}: {zoneFaite.nom} à revoir</span></button>
						</form>
					{/if}
					{#if z.elements.length}<ul role="list" class="lignes elements">
						{#each z.elements as el (el.ref)}
							{@const o = ouverteSur(el.ref)}
							{@const ecart = s?.ecarts[String(el.ref)]}
							<!-- Une valeur à part : après un refus, la page se relit, et le choix en cours ne doit pas sauter. -->
							{@const genre = ecart?.genre ?? 'manquant'}
							<li class:alerte={o || ecart}>
								<div class="ligne">
									<span class="libelle">{el.libelle}</span>
									{#if el.quantite !== null}<span class="quantite"><span aria-hidden="true">{'× '}</span>{el.quantite}<span class="masque">{' '}attendus</span></span>{/if}
									<!-- Retrouvé, l'élément peut avoir un nouvel écart. -->
									{#if data.peutFaire && (!o || s?.retrouves.includes(o.id))}
										<details name="ecart" open={pour(`element:${el.ref}`)?.message !== undefined}>
											<summary>{ecart ? 'Modifier' : 'Écart'}<span class="masque">{' '}: {el.libelle}</span></summary>
											<form method="POST" action="?/geste" enctype="multipart/form-data" use:enhance={envoi} class="formulaire">
												<input type="hidden" name="prise" value={p?.id ?? ''} />
												<input type="hidden" name="quoi" value="ecart" />
												<input type="hidden" name="element" value={el.ref} />
												<input type="hidden" name="zone" value={z.ref} />
												<input type="hidden" name="cible" value="element:{el.ref}" />
												<ChoixRadio id="genre-{el.ref}" legende="Quel écart ?" name="genre" valeur={genre} options={Object.entries(GENRES).map(([valeur, libelle]) => ({ valeur, libelle }))} />
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
												<ChampPhoto id="photo-{el.ref}" name="photo" libelle={ecart?.photo ? 'Remplacer la photo' : 'Photo'} precision="(facultative)" appel={ecart?.photo ? 'Choisir une autre photo' : undefined} capture="environment" />
												{#if ecart?.photo}<label class="choix"><input type="checkbox" name="retirer_photo" value="1" /> Retirer la photo</label>{/if}
												<div class="gestes">
													<Bouton type="submit">Enregistrer l’écart<span class="masque">{' '}: {el.libelle}</span></Bouton>
												</div>
											</form>
										</details>
									{/if}
								</div>
								{#if o}
									<div class="encadre">
										{@render signale(o)}
										{#if s?.retrouves.includes(o.id)}
											<p class="ok">Retrouvé : le signalement sera clos à la validation.</p>
										{:else if data.peutFaire}
											<p>Retrouvé ou réparé ?</p>
										{/if}
										{#if data.peutFaire}
											<form method="POST" action="?/geste" use:enhance={envoi} class="gestes">
												<input type="hidden" name="prise" value={p?.id ?? ''} />
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
										{/if}
									</div>
								{/if}
								{#if ecart && (!o || s?.retrouves.includes(o.id))}
									<div class="encadre">
										<span class="signale"><strong>{texteEcart(ecart, el.quantite)}</strong></span>
										{#if ecart.photo}<a class="vignette" href="/engins/photo/{ecart.photo}"><img src="/engins/photo/{ecart.photo}" alt="Photo de l’écart : {el.libelle}" width="56" height="56" loading="lazy" /></a>{/if}
										{#if data.peutFaire}
											<form method="POST" action="?/geste" use:enhance={envoi} class="gestes">
												<input type="hidden" name="prise" value={p?.id ?? ''} />
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
					</ul>{:else}<p class="doux">Aucun élément dans cette zone.</p>{/if}

					{#if data.peutFaire}
						<!-- Après la liste : on ne valide pas une check-list sans l'avoir sous les yeux. -->
						<form method="POST" action="?/geste" use:enhance={envoi} class="pied-zone">
							<input type="hidden" name="prise" value={p?.id ?? ''} />
							<input type="hidden" name="quoi" value="zone" />
							<input type="hidden" name="zone" value={z.ref} />
							<input type="hidden" name="cible" value="zone:{z.ref}" />
							{#if vue(z.ref)}
								<p class="ok">{@render marque()} {n ? `Complet sauf ${pluriel(n, 'écart')}` : 'Tout est complet'}</p>
								<button type="submit" class="petit" name="vue" value="0">Revoir la zone<span class="masque">{' '}{z.nom}</span></button>
							{:else}
								<Bouton type="submit">{n ? 'Le reste est complet' : 'Tout est complet'}<span class="masque">{' '}: {z.nom}</span></Bouton>
								<input type="hidden" name="vue" value="1" />
							{/if}
						</form>
						{@render message(`zone:${z.ref}`)}
					{/if}
				</section>
			</div>
		{/if}

		{#if p && data.peutFaire}
			<details class="abandon" open={pour('abandonner')?.message !== undefined}>
				<summary>Abandonner la prise…</summary>
				<form method="POST" action="?/abandonner" use:enhance class="formulaire">
					<input type="hidden" name="prise" value={p.id} />
					<p>Le brouillon et ses photos seront effacés.</p>
					<div><Bouton type="submit" variante="secondaire">Oui, abandonner</Bouton></div>
				</form>
				{@render message('abandonner')}
			</details>
		{/if}

		{#if p && panneauParticipants}
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
					{@render message('participants')}
					<div><Bouton type="submit">Enregistrer les participants</Bouton></div>
				</form>
			</Panneau>
		{/if}
	{/if}
</div>

<style>
	.page,
	.panneau,
	.contenu {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	p,
	h2:not(.titre-groupe),
	ul,
	fieldset {
		margin: 0;
	}
	h2:not(.titre-groupe) {
		font: 700 1.25rem var(--police-titre);
	}
	.doux {
		color: var(--doux);
	}
	.panneau {
		gap: 12px;
		padding: 16px;
		background: var(--surface);
		border: 1px solid transparent;
		box-shadow: var(--ombre-carte);
		border-radius: var(--rayon-grand);
	}
	.contenu {
		gap: 12px;
	}
	/* La plaque de l'engin : un à-plat rouge, tout y est écrit en blanc (contraste vérifié par les jetons). */
	.plaque {
		border: 1px solid transparent;
		border-radius: var(--rayon-grand);
		overflow: hidden;
		background: var(--surface);
		box-shadow: var(--ombre-carte);
	}
	.aplat {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: 8px 16px;
		padding: 14px 18px;
		background: var(--rouge);
		color: var(--sur-rouge);
	}
	.titres {
		flex: 1 1 12rem;
		min-width: 0;
	}
	h1 {
		margin: 0;
		font: 700 3.25rem/0.9 var(--police-titre);
		overflow-wrap: anywhere;
	}
	h1:focus {
		outline: none;
	}
	.aplat p {
		margin-top: 6px;
		font-size: 0.875rem;
	}
	.compteur {
		text-align: right;
		font-size: 0.8125rem;
	}
	.compteur .nombre {
		display: block;
		font: 700 2.125rem/1 var(--police-titre);
	}
	/* La bande claire sous la plaque : qui fait la prise, « Modifier », et où elle en est. */
	.bande {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 4px 6px 10px 18px;
		font-size: 0.9375rem;
	}
	.participants {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0 12px;
		min-height: var(--cible);
		color: var(--encre);
		text-decoration: none;
	}
	a.participants:focus-visible {
		outline-offset: -3px;
	}
	.modifier {
		padding: 0 10px;
		font-weight: 600;
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.bande .doux {
		font-size: 0.875rem;
	}
	.fait {
		border-left: 6px solid var(--statut-ok-trait);
	}
	ul {
		padding: 0;
		list-style: none;
	}
	#valider,
	#titre-zone {
		scroll-margin-top: 16px;
	}
	.parcours {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	/* Les zones passent à la ligne : on les voit toutes d'un coup, quels que soient leur nombre et leurs noms. */
	.selecteur ul {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
		gap: 8px;
	}
	.selecteur a {
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 2px;
		height: 100%;
		min-height: 64px;
		padding: 10px 12px;
		border: 1px solid var(--trait);
		border-radius: 12px;
		background: var(--surface);
		color: var(--encre);
		text-decoration: none;
	}
	.selecteur a:hover {
		border-color: var(--encre);
	}
	.nom-zone {
		font: 700 1.125rem/1.1 var(--police-titre);
		overflow-wrap: anywhere;
	}
	.nom-zone :global(svg) {
		margin-right: 6px;
		vertical-align: -2px;
	}
	.etat-zone {
		color: var(--doux);
		font-size: 0.8125rem;
	}
	/* Une zone vue : fond vert, la coche et « Tout est complet » écrits, jamais la couleur seule. */
	.selecteur a.vue {
		border-color: var(--statut-ok-trait);
		background: var(--statut-ok-fond);
	}
	.selecteur a.vue .nom-zone,
	.selecteur a.vue .etat-zone {
		color: var(--statut-ok-texte);
	}
	/* La zone à l'écran : fond plein et marque pour les lecteurs d'écran, pas une teinte seule. */
	.selecteur a[aria-current='true'] {
		border-color: var(--encre);
		background: var(--encre);
		color: var(--surface);
	}
	.selecteur a[aria-current='true'] .etat-zone,
	.selecteur a[aria-current='true'] .nom-zone {
		color: inherit;
	}
	.contenu {
		min-width: 0;
	}
	.zone-faite {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 4px 12px;
		padding: 0 6px 0 14px;
		min-height: var(--cible);
		border: 1px solid var(--statut-ok-trait);
		border-radius: var(--rayon-bouton);
		background: var(--statut-ok-fond);
	}
	.elements li,
	.ouvertes li {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 4px 0;
	}
	.elements li {
		padding: 3px 6px 3px 14px;
	}
	/* Dans la carte, l'encadré et le message gardent leur petit arrondi (pas celui de la carte). */
	.elements > li > :is(.encadre, .echec) {
		border-radius: var(--rayon-petit);
	}
	.elements li:has(details[open], .encadre) {
		padding-bottom: 12px;
	}
	.ouvertes li + li {
		border-top: 1px solid var(--trait-doux);
	}
	.ligne {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0 10px;
		min-height: var(--cible);
	}
	.libelle {
		flex: 1 1 8rem;
	}
	.libelle,
	.quoi {
		font-weight: 600;
		overflow-wrap: anywhere;
	}
	.quantite {
		flex: none;
		min-width: 2.5em;
		padding: 1px 9px;
		border-radius: 999px;
		background: var(--statut-neutre-fond);
		color: var(--statut-neutre-texte);
		text-align: center;
		font-size: 0.875rem;
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
	.pied-zone {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px;
	}
	.valider-participants a {
		color: inherit;
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
		border-radius: var(--rayon-bouton);
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
	.petit {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: var(--cible);
		padding: 0 14px;
		border: 1px solid var(--trait);
		border-radius: var(--rayon-bouton);
		background: var(--surface);
		color: var(--encre);
		font: 600 0.9375rem var(--police);
		cursor: pointer;
		list-style: none;
	}
	/* « Écart » : un lien discret, de 44 px de cible. */
	summary {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: var(--cible);
		min-height: var(--cible);
		padding: 0 6px;
		color: var(--encre);
		font: 600 0.9375rem var(--police);
		text-decoration: underline;
		text-underline-offset: 3px;
		cursor: pointer;
		list-style: none;
	}
	/* Le repère du clavier reste dans la ligne : la carte rogne ce qui dépasse. */
	summary:focus-visible {
		outline-offset: -3px;
	}
	summary::-webkit-details-marker {
		display: none;
	}
	details[open] {
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
	.echec {
		padding: 10px 14px;
		border-radius: var(--rayon-petit);
		border: 2px solid var(--accent);
		font-weight: 600;
	}
	/* À l'ordinateur : les zones à gauche, leur contenu à droite. */
	@media (min-width: 1024px) {
		.page {
			max-width: 64rem;
		}
		.parcours {
			display: grid;
			grid-template-columns: 17rem minmax(0, 1fr);
			align-items: start;
			gap: 16px;
		}
		.selecteur ul {
			grid-template-columns: 1fr;
		}
	}
</style>
