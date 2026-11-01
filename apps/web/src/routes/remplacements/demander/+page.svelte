<script lang="ts">
	import ChoixSemaine from '#lib/remplacements/ChoixSemaine.svelte';
	import ListeCollegues from '#lib/remplacements/ListeCollegues.svelte';
	import Progression from '#lib/remplacements/Progression.svelte';
	import { cle, etapes, phrasePeriodes, type Etape, type Periode } from '#lib/remplacements/guide.ts';
	import { pluriel } from '#lib/pluriel.ts';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';
	import Vide from '#lib/ui/Vide.svelte';

	let { data, form } = $props();
	const echange = $derived(data.mode === 'echange');
	const liste = $derived(etapes(data.mode));
	const index = $derived(liste.findIndex((e) => e.id === data.etape));
	const suivante = $derived(liste[index + 1]?.id ?? 'verifier');
	const precedente = $derived(index > 0 ? liste[index - 1]!.id : null);
	const nom = (q: { prenom: string; nom: string }) => `${q.prenom} ${q.nom}`;

	// L'état du parcours, tel qu'il est dans l'adresse ; `changer` en remplace une partie.
	type Etat = { etape?: Etape; semaine?: string | null; p?: Periode[]; pour?: string | null; avec?: number | null; semaineAvec?: string | null; ps?: Periode[] };
	const etat = $derived<Etat>({
		semaine: data.semaine?.semaine ?? null,
		p: data.choisies,
		pour: data.pour === 'tous' ? 'tous' : data.pour ? String(data.pour.id) : null,
		avec: data.avec?.id ?? null,
		semaineAvec: data.semaineAvec?.semaine ?? null,
		ps: data.choisiesAvec
	});
	function adresse(changer: Etat): string {
		const e = { ...etat, ...changer };
		const q = new URLSearchParams();
		if (echange) q.set('mode', 'echange');
		if (e.etape && e.etape !== 'quand') q.set('etape', e.etape);
		if (e.semaine) q.set('semaine', e.semaine);
		for (const p of e.p ?? []) q.append('p', cle(p));
		if (!echange && e.pour) q.set('pour', e.pour);
		if (echange && e.avec) q.set('avec', String(e.avec));
		if (echange && e.semaineAvec) q.set('semaineAvec', e.semaineAvec);
		for (const p of e.ps ?? []) q.append('ps', cle(p));
		return `?${q}`;
	}
	const lienEtape = (id: string) => adresse({ etape: id as Etape });
	const autreMode = $derived(echange ? `?${new URLSearchParams([...(data.semaine ? [['semaine', data.semaine.semaine]] : []), ...data.choisies.map((p) => ['p', cle(p)])])}` : adresse({}).replace('?', '?mode=echange&'));

	const cible = $derived(data.pour && data.pour !== 'tous' ? data.pour : null);
	const manque = $derived(echange ? (data.avec?.manque ?? []) : (cible?.manque ?? []));
	const chef = $derived(manque.length > 0 ? `Il lui manque ${manque.join(', ')} : votre chef d’équipe devra valider.` : 'Votre chef d’équipe sera informé.');
	const recap = $derived.by(() => {
		const miennes = phrasePeriodes(data.choisies);
		if (echange && data.avec) return [`Vous proposez à ${nom(data.avec)} d’échanger : vous lui donnez ${miennes}, ${data.avec.prenom} vous donne ${phrasePeriodes(data.choisiesAvec)}.`, `${data.avec.prenom} doit accepter.`, chef];
		if (cible) return [`Vous demandez à ${nom(cible)} de vous remplacer ${miennes}.`, `${cible.prenom} doit accepter.`, chef];
		const n = data.candidats.length;
		return [
			`Vous demandez à être remplacé ${miennes}.`,
			n > 0 ? `${pluriel(n, 'collègue disponible est prévenu', 'collègues disponibles sont prévenus')}.` : 'Aucun collègue n’est libre pour l’instant : personne ne sera prévenu.',
			'Votre chef d’équipe sera informé.'
		];
	});
	const message = $derived(form?.message ?? data.message ?? '');
</script>

<svelte:head>
	<title>{liste[index]?.titre} · {echange ? 'Échanger avec un collègue' : 'Me faire remplacer'} · Gyro Caserne</title>
</svelte:head>

{#snippet garder(sauf: string[])}
	{#if echange}<input type="hidden" name="mode" value="echange" />{/if}
	{#if data.semaine && !sauf.includes('p')}<input type="hidden" name="semaine" value={data.semaine.semaine} />{/if}
	{#if !sauf.includes('p')}{#each data.choisies as p (p.debut)}<input type="hidden" name="p" value={cle(p)} />{/each}{/if}
	{#if !echange && etat.pour && !sauf.includes('pour')}<input type="hidden" name="pour" value={etat.pour} />{/if}
	{#if echange && data.avec && !sauf.includes('avec')}<input type="hidden" name="avec" value={data.avec.id} />{/if}
	{#if echange && data.semaineAvec && !sauf.includes('ps')}<input type="hidden" name="semaineAvec" value={data.semaineAvec.semaine} />{/if}
	{#if !sauf.includes('ps')}{#each data.choisiesAvec as p (p.debut)}<input type="hidden" name="ps" value={cle(p)} />{/each}{/if}
{/snippet}

{#snippet boutons(libelle: string)}
	<div class="boutons">
		<button type="submit" name="etape" value={suivante} class="bouton principal">{libelle}</button>
		{#if precedente}<a class="bouton secondaire" href={lienEtape(precedente)}>Retour</a>{/if}
	</div>
{/snippet}

{#snippet resume()}
	<p class="resume">
		<span>Vos périodes : <strong>{phrasePeriodes(data.choisies)}</strong>.</span>
		<a href={lienEtape('quand')}>Modifier<span class="masque">{' vos périodes'}</span></a>
	</p>
	{#if echange && data.avec && data.etape === 'verifier'}
		<p class="resume">
			<span>Avec <strong>{nom(data.avec)}</strong>, ses périodes : <strong>{phrasePeriodes(data.choisiesAvec)}</strong>.</span>
			<a href={lienEtape('avec')}>Modifier<span class="masque">{' le collègue'}</span></a>
		</p>
	{/if}
{/snippet}

<div class="page">
	<EnTetePage
		titre={echange ? 'Échanger avec un collègue' : 'Me faire remplacer'}
		phrase={echange ? 'Vous prenez une de ses périodes, il prend une des vôtres. Il doit accepter.' : 'Trois étapes : quand, à qui, et vous vérifiez avant d’envoyer.'}
		retour={{ href: '/remplacements', libelle: 'Remplacements' }}
	/>

	{#if data.semaines.length === 0}
		<Vide titre="Aucune astreinte à venir." texte="Vos semaines d’astreinte des douze prochaines semaines apparaîtront ici, dès que le planning est publié." action={{ href: '/planning', libelle: 'Voir le planning' }} />
	{:else}
		<Progression etapes={liste} courante={data.etape} lien={lienEtape} />
		<p class="erreur" class:masque={!message} role="alert">{message}</p>

		<section class="carte" aria-labelledby="titre-etape">
			<h2 id="titre-etape">{liste[index]?.titre}</h2>

			{#if data.etape === 'quand'}
				<p class="doux">{echange ? 'Touchez les jours de votre astreinte que vous donnez.' : 'Choisissez la semaine, puis touchez les jours où vous ne pouvez pas être d’astreinte.'}</p>
				<form method="GET" class="formulaire">
					{@render garder(['p'])}
					{#if data.semaine}<input type="hidden" name="semaine" value={data.semaine.semaine} />{/if}
					<ChoixSemaine
						semaines={data.semaines}
						ouverte={data.semaine}
						nom="p"
						choisies={data.choisies}
						maintenant={data.maintenant}
						lienSemaine={(s) => adresse({ etape: 'quand', semaine: s, p: [] })}
						lienRaccourci={(p) => adresse({ etape: 'quand', p })}
						aQui="Mes"
					/>
					{#if data.semaine}{@render boutons('Continuer')}{/if}
				</form>
				<p class="autre"><a href={autreMode}>{echange ? 'Plutôt me faire remplacer ?' : 'Plutôt échanger avec un collègue ?'}</a></p>
			{:else if data.etape === 'qui'}
				{@render resume()}
				<form method="GET" class="formulaire">
					{@render garder(['pour'])}
					<ListeCollegues collegues={data.candidats} name="pour" choisi={data.pour === 'tous' ? 'tous' : (data.pour?.id ?? null)} recherche={data.recherche} etape="qui" tous={data.candidats.length} legende="Qui prévenir ?" />
					{@render boutons('Continuer')}
				</form>
			{:else if data.etape === 'avec'}
				{@render resume()}
				<form method="GET" class="formulaire">
					{@render garder(['avec', 'ps'])}
					<ListeCollegues collegues={data.echangeables} name="avec" choisi={data.avec?.id ?? null} recherche={data.recherche} etape="avec" legende="Avec qui échanger ?" />
					{@render boutons('Continuer')}
				</form>
			{:else if data.etape === 'sienne' && data.avec}
				{@render resume()}
				<p class="doux">Touchez les jours de l’astreinte de {nom(data.avec)} que vous prenez.</p>
				<form method="GET" class="formulaire">
					{@render garder(['ps'])}
					{#if data.semaineAvec}<input type="hidden" name="semaineAvec" value={data.semaineAvec.semaine} />{/if}
					<ChoixSemaine
						semaines={data.semainesAvec}
						ouverte={data.semaineAvec}
						nom="ps"
						choisies={data.choisiesAvec}
						maintenant={data.maintenant}
						lienSemaine={(s) => adresse({ etape: 'sienne', semaineAvec: s, ps: [] })}
						lienRaccourci={(ps) => adresse({ etape: 'sienne', ps })}
						aQui="Ses"
					/>
					{#if data.semaineAvec}{@render boutons('Continuer')}{/if}
				</form>
			{:else if data.etape === 'verifier'}
				<div class="recap">
					{#each recap as phrase, i (i)}<p class:fort={i === 0}>{phrase}</p>{/each}
				</div>
				<form method="POST" class="formulaire">
					{#if echange}<input type="hidden" name="mode" value="echange" />{/if}
					{#each data.choisies as p (p.debut)}<input type="hidden" name="periode" value={cle(p)} />{/each}
					{#if echange && data.avec}
						<input type="hidden" name="avec" value={data.avec.id} />
						{#each data.choisiesAvec as p (p.debut)}<input type="hidden" name="periodeCible" value={cle(p)} />{/each}
					{:else}
						<input type="hidden" name="pour" value={etat.pour ?? 'tous'} />
					{/if}
					<label for="mot" class="libelle">Un mot pour {echange || cible ? 'votre collègue' : 'vos collègues'} (facultatif)</label>
					<textarea id="mot" name="mot" maxlength="200" rows="2"></textarea>
					<div class="boutons">
						<button type="submit" class="bouton principal">{echange ? 'Proposer l’échange' : 'Envoyer la demande'}</button>
						{#if precedente}<a class="bouton secondaire" href={lienEtape(precedente)}>Retour</a>{/if}
					</div>
				</form>
			{/if}
		</section>
	{/if}
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 16px;
		max-width: 60rem;
	}
	p,
	h2 {
		margin: 0;
	}
	h2 {
		font: 700 1.5rem var(--police-titre);
	}
	.carte {
		display: flex;
		flex-direction: column;
		gap: 14px;
		padding: 16px;
		background: var(--surface);
		border: 1px solid var(--trait-doux);
		border-radius: var(--rayon-grand);
	}
	.formulaire {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.doux {
		color: var(--doux);
	}
	.resume {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: 4px 12px;
		padding: 10px 14px;
		border-radius: var(--rayon-grand);
		background: var(--statut-neutre-fond);
	}
	.resume a,
	.autre a {
		color: var(--encre);
		font-weight: 600;
	}
	.recap {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 14px 16px;
		border-left: 6px solid var(--rouge);
		border-radius: var(--rayon-grand);
		background: var(--statut-neutre-fond);
		font-size: 1.0625rem;
	}
	.fort {
		font-weight: 700;
	}
	.libelle {
		font-weight: 600;
	}
	textarea {
		min-height: var(--cible);
		padding: 8px 12px;
		border: 2px solid var(--doux);
		border-radius: var(--rayon-petit);
		background: var(--surface);
		color: var(--encre);
		font: 400 1rem var(--police);
		resize: vertical;
	}
	.boutons {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.bouton {
		min-height: var(--cible);
		display: inline-flex;
		align-items: center;
		padding: 0 22px;
		border-radius: 999px;
		font: inherit;
		font-weight: 700;
		text-decoration: none;
		cursor: pointer;
	}
	.principal {
		border: 2px solid var(--encre);
		background: var(--rouge);
		color: var(--sur-rouge);
	}
	.secondaire {
		border: 1px solid var(--trait);
		background: var(--surface);
		color: var(--encre);
	}
	.erreur {
		padding: 12px 14px;
		border-radius: var(--rayon-grand);
		font-weight: 600;
		background: var(--statut-danger-fond);
		color: var(--statut-danger-texte);
		border: 1px solid var(--statut-danger-trait);
	}
</style>
