<script lang="ts">
	import { formatDeDate } from '@gyro-caserne/socle/dates';
	// Une page de calendrier : le jour, la date et le mois. Lue en entier : « jeudi 5 novembre ».
	let { iso }: { iso: string } = $props();

	// Les dates sont enregistrées à l'heure de Paris : on les lit telles quelles.
	const date = (options: Intl.DateTimeFormatOptions) => formatDeDate({ ...options, timeZone: 'UTC' }).format(new Date(`${iso.slice(0, 10)}T00:00:00Z`));
</script>

<span class="tuile" role="img" aria-label={date({ weekday: 'long', day: 'numeric', month: 'long' })}>
	<span class="jour">{date({ weekday: 'short' }).toUpperCase()}</span>
	<span class="date">{Number(iso.slice(8, 10))}</span>
	<span class="mois">{date({ month: 'short' })}</span>
</span>

<style>
	.tuile {
		flex: none;
		width: 64px;
		display: flex;
		flex-direction: column;
		align-items: center;
		border: 1px solid var(--trait-doux);
		border-radius: 14px;
		overflow: hidden;
		background: var(--surface);
		text-align: center;
	}
	.jour {
		width: 100%;
		padding: 3px 0;
		background: var(--rouge);
		color: var(--sur-rouge);
		font-size: 0.75rem;
		font-weight: 700;
	}
	.date {
		font: 700 1.875rem/1.1 var(--police-titre);
	}
	.mois {
		padding-bottom: 4px;
		color: var(--doux);
		font-size: 0.75rem;
	}
</style>
