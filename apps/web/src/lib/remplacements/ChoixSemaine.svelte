<script lang="ts">
	import { formatDeDate } from '@gyro-caserne/socle/dates';
	import { duAu, finDeSemaine } from '../planning/dates.ts';
	import { pluriel } from '../pluriel.ts';
	import { cle, plage, raccourcis, RAISONS, type Periode, type Tranche } from './guide.ts';

	// Choisir une semaine d'astreinte (cartes), puis ses jours dans une bande : un jour par période, la plage écrite,
	// les périodes passées ou déjà demandées visibles mais inactives, avec la raison. Les cases sont dans le formulaire de la page.
	let {
		semaines,
		ouverte,
		nom,
		choisies,
		maintenant,
		lienSemaine,
		lienRaccourci,
		aQui
	}: {
		semaines: { semaine: string; tranches: Tranche[] }[];
		ouverte: { semaine: string; tranches: Tranche[] } | null;
		nom: string;
		choisies: Periode[];
		maintenant: string;
		lienSemaine: (semaine: string) => string;
		lienRaccourci: (periodes: Periode[]) => string;
		aQui: 'Mes' | 'Ses';
	} = $props();

	const libres = (s: { tranches: Tranche[] }) => s.tranches.filter((t) => t.etat === 'libre').length;
	const format = (options: Intl.DateTimeFormatOptions, iso: string) => formatDeDate({ ...options, timeZone: 'UTC' }).format(new Date(`${iso.slice(0, 10)}T00:00:00Z`));
	const jourEntier = (iso: string) => format({ weekday: 'long' }, iso);
	const dateCourte = (iso: string) => format({ day: 'numeric', month: 'short' }, iso);
	const coche = (t: Tranche) => choisies.some((p) => cle(p) === cle(t));
	const rac = $derived(ouverte ? raccourcis(ouverte.tranches, maintenant) : []);
</script>

{#if semaines.length > 1}
	<ul class="semaines" role="list" aria-label="{aQui} semaines d’astreinte">
		{#each semaines as s (s.semaine)}
			<li>
				<a href={lienSemaine(s.semaine)} class="semaine" aria-current={ouverte?.semaine === s.semaine ? 'true' : undefined} data-sveltekit-reset="false">
					<span class="du">Semaine du {duAu(s.semaine, finDeSemaine(s.semaine))}</span>
					<span class="libres">{libres(s) > 0 ? pluriel(libres(s), 'jour libre', 'jours libres') : 'Rien à choisir'}</span>
					{#if ouverte?.semaine === s.semaine}<span class="choisie">Choisie</span>{/if}
				</a>
			</li>
		{/each}
	</ul>
{/if}

{#if ouverte}
	<fieldset class="bande">
		<legend>{aQui} jours, semaine du {duAu(ouverte.semaine, finDeSemaine(ouverte.semaine))}</legend>
		{#if rac.length > 0}
			<p class="raccourcis">
				<span class="doux">Raccourcis :</span>
				{#each rac as r (r.libelle)}<a href={lienRaccourci(r.periodes)} data-sveltekit-reset="false">{r.libelle}</a>{/each}
			</p>
		{/if}
		<ul role="list" class="jours">
			{#each ouverte.tranches as t (t.debut)}
				{@const inactive = t.etat !== 'libre'}
				<li>
					<label class="jour" class:inactive>
						<input type="checkbox" name={nom} value={cle(t)} checked={!inactive && coche(t)} disabled={inactive} />
						<!-- Le nom lu est le texte montré (aux deux tailles). -->
						<span class="texte">
							<span class="nom-jour">{jourEntier(t.debut)}</span>
							<span class="date">{dateCourte(t.debut)}</span>
							<span class="plage">{plage(t)}</span>
							{#if inactive}<span class="raison">{RAISONS[t.etat as Exclude<Tranche['etat'], 'libre'>]}</span>{/if}
						</span>
					</label>
				</li>
			{/each}
		</ul>
	</fieldset>
{/if}

<style>
	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.semaines {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: var(--espace-8);
	}
	.semaine {
		min-height: var(--cible);
		height: 100%;
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: var(--espace-12) var(--espace-16);
		border: 1px solid var(--trait);
		border-radius: var(--rayon-grand);
		background: var(--surface);
		color: var(--encre);
		text-decoration: none;
	}
	.semaine:hover {
		border-color: var(--encre);
	}
	.semaine[aria-current='true'] {
		border: 2px solid var(--encre);
		padding: calc(var(--espace-12) - 1px) calc(var(--espace-16) - 1px);
	}
	.du {
		font-weight: 700;
	}
	.libres {
		color: var(--doux);
		font-size: var(--texte-15);
	}
	.choisie {
		align-self: flex-start;
		padding: 0 var(--espace-8);
		border-radius: 999px;
		background: var(--encre);
		color: var(--surface);
		font-size: var(--texte-14);
		font-weight: 700;
	}
	.bande {
		margin: 0;
		padding: 0;
		border: 0;
		display: flex;
		flex-direction: column;
		gap: var(--espace-12);
		min-width: 0;
	}
	legend {
		float: left;
		padding: 0;
		margin-bottom: 2px;
		font: 700 var(--texte-18) var(--police-titre);
	}
	.raccourcis {
		clear: both;
		margin: 0;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--espace-6) var(--espace-8);
	}
	.raccourcis a {
		min-height: var(--cible);
		display: inline-flex;
		align-items: center;
		padding: 0 var(--espace-16);
		border: 1px solid var(--trait);
		border-radius: var(--rayon-bouton);
		background: var(--surface);
		color: var(--encre);
		font-weight: 600;
		text-decoration: none;
	}
	.raccourcis a:hover {
		border-color: var(--encre);
	}
	/* Téléphone : une rangée par jour, large à toucher. Ordinateur : la bande de 7 jours côte à côte. Même contenu. */
	.jours {
		clear: both;
		display: grid;
		gap: var(--espace-6);
	}
	.jour {
		min-height: 56px;
		display: flex;
		align-items: center;
		gap: var(--espace-12);
		padding: var(--espace-8) var(--espace-16);
		border: 1px solid var(--trait);
		border-radius: var(--rayon-grand);
		background: var(--surface);
		cursor: pointer;
	}
	.jour:has(input:checked) {
		border: 2px solid var(--encre);
		padding: calc(var(--espace-12) - 1px) calc(var(--espace-16) - 1px);
		background: color-mix(in srgb, var(--rouge) 8%, var(--surface));
	}
	.jour:has(input:focus-visible) {
		outline: 3px solid var(--focus);
		outline-offset: 2px;
	}
	.jour.inactive {
		cursor: default;
		border-style: dashed;
		background: transparent;
		color: var(--doux);
	}
	.texte {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 2px var(--espace-12);
	}
	.nom-jour {
		font-weight: 700;
		text-transform: capitalize;
		min-width: 5.5em;
	}
	.date {
		font-weight: 600;
	}
	.plage {
		padding: 0 var(--espace-8);
		border: 1px solid var(--trait);
		border-radius: 999px;
		font-size: var(--texte-14);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}
	.raison {
		font-size: var(--texte-14);
		font-style: italic;
	}
	.doux {
		color: var(--doux);
	}
	@media (min-width: 900px) {
		/* Une colonne par période : 7 d'ordinaire, 8 quand la relève tombe un jour férié. */
		.jours {
			grid-auto-flow: column;
			grid-auto-columns: minmax(0, 1fr);
		}
		.jour {
			flex-direction: column;
			align-items: flex-start;
			min-height: 128px;
			padding: var(--espace-12);
		}
		.jour:has(input:checked) {
			padding: var(--espace-12);
		}
		.texte {
			flex-direction: column;
			align-items: flex-start;
		}
		.nom-jour {
			font-size: var(--texte-18);
		}
	}
</style>
