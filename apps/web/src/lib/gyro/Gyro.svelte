<script lang="ts">
	import { TENUES, aReflet, boucheDe, decalageDe, yeuxDe, type Tenue } from './tenues.ts';

	let {
		tenue = 'normal',
		taille = 160,
		anime = true,
		decoratif = false
	}: { tenue?: Tenue; taille?: number; anime?: boolean; decoratif?: boolean } = $props();

	const yeux = $derived(yeuxDe(tenue));
	const bouche = $derived(boucheDe(tenue));
	const decalage = $derived(decalageDe(tenue));
	const reflet = $derived(aReflet(tenue));
	const socle = $derived(tenue !== 'hiver');
	const couleurSocle = $derived(tenue === 'nuit' ? '#0f141b' : '#1d2733');

	const a = (nom: string) => (anime ? nom : undefined);
	const cl = $derived({
		corps: a(tenue === 'victoire' ? 'a-saute' : tenue === 'vent' ? 'a-penche' : 'a-respire'),
		clin: a('a-clin'),
		rayonne: a('a-rayonne'),
		tourne: a('a-tourne'),
		tourneLent: a('a-tourne-lent'),
		zzz: a('a-zzz'),
		scintille: a('a-scintille'),
		tombe: a('a-tombe'),
		glisse: a('a-glisse'),
		coucou: a('a-coucou'),
		balance: a('a-balance'),
		saute: a('a-saute'),
		balancePeche: a('a-coucou')
	});
</script>

<svg class="gyro" width={taille} height={taille} viewBox="0 0 160 160" style="display: block;" {...decoratif ? { 'aria-hidden': 'true' } : { role: 'img', 'aria-label': `Gyro, ${TENUES[tenue]}` }}>
{#if tenue === 'astreinte'}<g class={cl.rayonne} stroke="#f4c400" stroke-width="5" stroke-linecap="round">
<line x1="80" y1="10" x2="80" y2="24"></line><line x1="38" y1="26" x2="47" y2="37"></line><line x1="122" y1="26" x2="113" y2="37"></line>
<line x1="20" y1="70" x2="34" y2="70"></line><line x1="140" y1="70" x2="126" y2="70"></line>
</g>{/if}
{#if tenue === 'chargement'}<g class={cl.tourne} fill="#f4c400" opacity="0.5">
<path d="M80 52 L6 24 L2 46 Z"></path><path d="M80 52 L154 80 L158 58 Z"></path>
</g>{/if}
{#if tenue === 'pluie'}<g>
<path d="M118 44 L118 114 Q118 122 110 122 Q104 122 104 116" fill="none" stroke="#1d2733" stroke-width="4" stroke-linecap="round"></path>
<path d="M30 46 Q80 0 130 46 Q118 39 105 46 Q92 39 80 46 Q68 39 55 46 Q42 39 30 46 Z" fill="#1d2733"></path>
<circle cx="80" cy="10" r="3.5" fill="#f4c400"></circle>
<g class={cl.tombe} stroke="#1d9bd8" stroke-width="3" stroke-linecap="round"><line x1="20" y1="60" x2="17" y2="68"></line><line x1="142" y1="70" x2="139" y2="78"></line><line x1="26" y1="100" x2="23" y2="108"></line></g>
</g>{/if}
{#if tenue === 'amicale'}<g class={cl.scintille}>
<circle cx="26" cy="40" r="4" fill="#f4c400"></circle><circle cx="136" cy="34" r="4" fill="#62ad3f"></circle>
<rect x="128" y="70" width="8" height="5" rx="2" fill="#ec5fa6" transform="rotate(30 132 72)"></rect>
<rect x="18" y="80" width="8" height="5" rx="2" fill="#1d9bd8" transform="rotate(-25 22 82)"></rect>
</g>{/if}
{#if tenue === 'ete'}<g>
<g class={cl.tourneLent}><circle cx="132" cy="30" r="13" fill="#f4c400"></circle>
<g stroke="#f4c400" stroke-width="3.5" stroke-linecap="round"><line x1="132" y1="8" x2="132" y2="12"></line><line x1="150" y1="30" x2="154" y2="30"></line><line x1="114" y1="30" x2="110" y2="30"></line><line x1="132" y1="48" x2="132" y2="52"></line></g></g>
</g>{/if}
{#if tenue === 'hiver'}<g class={cl.tombe} fill="#9fb3c4"><circle cx="22" cy="44" r="3"></circle><circle cx="140" cy="58" r="3"></circle><circle cx="30" cy="104" r="2.5"></circle><circle cx="134" cy="112" r="2.5"></circle></g>{/if}
{#if tenue === 'nuit'}<g class={cl.zzz} fill="#9aa6b2" font-family="Barlow Condensed, sans-serif" font-weight="700">
<text x="112" y="40" font-size="22">z</text><text x="126" y="24" font-size="16">z</text>
</g>{/if}
{#if tenue === 'inquiet'}<g class={cl.glisse}><path d="M118 44 C118 44 110 56 110 61 a8 8 0 0 0 16 0 C126 56 118 44 118 44 Z" fill="#1d9bd8"></path></g>{/if}
{#if tenue === 'victoire'}<g class={cl.scintille} fill="#f4c400">
<path d="M24 34 l4 9 l10 1 l-7 7 l2 10 l-9 -5 l-9 5 l2 -10 l-7 -7 l10 -1 Z"></path>
<path d="M134 22 l3 7 l8 1 l-6 5 l2 8 l-7 -4 l-7 4 l2 -8 l-6 -5 l8 -1 Z"></path>
<circle cx="142" cy="96" r="4"></circle><circle cx="16" cy="96" r="3"></circle>
</g>{/if}
{#if tenue === 'saintebarbe'}<g class={cl.scintille}>
<circle cx="24" cy="38" r="4" fill="#f4c400"></circle><circle cx="138" cy="36" r="4" fill="#e3262b"></circle>
<rect x="18" y="86" width="8" height="5" rx="2" fill="#e3262b" transform="rotate(-25 22 88)"></rect>
<rect x="132" y="78" width="8" height="5" rx="2" fill="#f4c400" transform="rotate(30 136 80)"></rect>
</g>{/if}
{#if tenue === 'anniversaire'}<g class={cl.scintille}>
<circle cx="22" cy="36" r="4" fill="#1d9bd8"></circle><circle cx="30" cy="96" r="3" fill="#ec5fa6"></circle><circle cx="96" cy="14" r="3" fill="#62ad3f"></circle>
</g>{/if}
{#if tenue === 'vent'}<g stroke="#9aa6b2" stroke-width="3.5" stroke-linecap="round" fill="none">
<path d="M4 58 H26"></path><path d="M10 74 H34 Q40 74 40 68"></path><path d="M2 92 H22"></path>
</g>{/if}
{#if tenue === 'remplacement'}<g fill="none" stroke="#1d9bd8" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">
<path d="M58 14 H94 M86 8 L94 14 L86 20"></path><path d="M94 32 H58 M66 26 L58 32 L66 38"></path>
</g>{/if}
{#if tenue === 'bal14'}<g class={cl.scintille}>
<path d="M4 16 Q80 44 156 16" fill="none" stroke="#9aa6b2" stroke-width="2"></path>
<circle cx="30" cy="27" r="7" fill="#1d4ed8"></circle><circle cx="80" cy="33" r="7" fill="#ffffff" stroke="#9aa6b2" stroke-width="1.5"></circle><circle cx="130" cy="27" r="7" fill="#e3262b"></circle>
</g>{/if}
{#if tenue === 'galons'}<g class={cl.scintille} fill="#f4c400">
<path d="M22 40 l3 7 l7 1 l-5 5 l1 7 l-6 -4 l-6 4 l1 -7 l-5 -5 l7 -1 Z"></path><circle cx="138" cy="40" r="3.5"></circle><circle cx="140" cy="100" r="3"></circle>
</g>{/if}
{#if tenue === 'lavage'}<g class={cl.scintille} fill="#ffffff" stroke="#9fc7e6" stroke-width="2">
<circle cx="24" cy="50" r="6"></circle><circle cx="16" cy="70" r="4"></circle><circle cx="30" cy="96" r="5"></circle><circle cx="98" cy="16" r="5"></circle>
</g>{/if}
{#if tenue === 'nouvelan'}<g class={cl.scintille} fill="#f4c400">
<path d="M24 30 l3 7 l7 1 l-5 5 l1 7 l-6 -4 l-6 4 l1 -7 l-5 -5 l7 -1 Z"></path><circle cx="136" cy="28" r="4"></circle><circle cx="20" cy="96" r="3" fill="#ec5fa6"></circle><circle cx="144" cy="112" r="3" fill="#1d9bd8"></circle>
</g>{/if}
{#if tenue === 'orage'}<g>
<g fill="#9aa6b2"><circle cx="112" cy="26" r="11"></circle><circle cx="128" cy="20" r="14"></circle><circle cx="144" cy="28" r="10"></circle><rect x="104" y="26" width="46" height="12" rx="6"></rect></g>
<path class={cl.scintille} d="M128 40 L118 58 H127 L120 76 L138 52 H129 L135 40 Z" fill="#f4c400"></path>
</g>{/if}
<g transform={decalage}>
<g class={cl.corps}>
{#if tenue === 'poisson'}<g>
<path d="M4 66 Q18 54 34 66 Q18 78 4 66 Z" fill="#1d9bd8"></path><path d="M6 66 L-6 58 L-6 74 Z" fill="#1d9bd8"></path><circle cx="26" cy="64" r="2" fill="#1d2733"></circle>
</g>{/if}
<path d="M32 94 V62 Q32 30 60 30 Q88 30 88 62 V94 Z" fill="#e3262b"></path>
{#if reflet}<path d="M42 50 Q46 38 58 36" fill="none" stroke="#ff9a8f" stroke-width="5" stroke-linecap="round"></path>{/if}
{#if tenue === 'manoeuvre'}<g>
<path d="M26 54 Q26 18 60 16 Q94 18 94 54 Z" fill="#eef1f4" stroke="#1d2733" stroke-width="3"></path>
<path d="M60 16 Q58 34 60 54" fill="none" stroke="#e3262b" stroke-width="4" stroke-linecap="round"></path>
<rect x="20" y="51" width="80" height="8" rx="4" fill="#1d2733"></rect>
</g>{/if}
{#if tenue === 'intervention'}<g>
<path d="M26 56 Q26 16 60 14 Q94 16 94 56 Z" fill="#d6dce2" stroke="#1d2733" stroke-width="3"></path>
<path d="M60 14 Q58 34 60 54" fill="none" stroke="#9aa6b2" stroke-width="5" stroke-linecap="round"></path>
<path d="M30 56 Q60 48 90 56 L88 64 Q60 57 32 64 Z" fill="#f4c400" opacity="0.75"></path>
</g>{/if}
{#if tenue === 'hiver'}<g>
<path d="M30 48 Q30 18 60 16 Q90 18 90 48 Z" fill="#1d9bd8"></path>
<rect x="27" y="44" width="66" height="10" rx="5" fill="#eef1f4"></rect>
<circle cx="60" cy="13" r="8" fill="#eef1f4"></circle>
</g>{/if}
{#if tenue === 'nuit'}<g>
<path d="M34 50 Q36 24 62 22 Q92 20 108 46 Q96 40 88 46 Z" fill="#62ad3f"></path>
<circle cx="108" cy="48" r="6" fill="#eef1f4"></circle>
<rect x="32" y="46" width="58" height="8" rx="4" fill="#eef1f4"></rect>
</g>{/if}
{#if tenue === 'amicale'}<g>
<path d="M60 -6 L46 32 H74 Z" fill="#f4c400"></path><path d="M53 13 L67 13 L70 22 L50 22 Z" fill="#ec5fa6"></path><circle cx="60" cy="-7" r="5" fill="#1d9bd8"></circle>
</g>{/if}
{#if tenue === 'anniversaire'}<g>
<path d="M60 -6 L46 32 H74 Z" fill="#1d9bd8"></path><path d="M53 13 L67 13 L70 22 L50 22 Z" fill="#f4c400"></path><circle cx="60" cy="-7" r="5" fill="#ec5fa6"></circle>
</g>{/if}
{#if tenue === 'vacances'}<g>
<path d="M28 46 Q32 30 60 28 Q88 30 92 46 Q60 38 28 46 Z" fill="#e8c77a"></path>
<path d="M18 48 Q60 36 102 48" fill="none" stroke="#e8c77a" stroke-width="6" stroke-linecap="round"></path>
<path d="M30 44 Q60 36 90 44" fill="none" stroke="#1d9bd8" stroke-width="3"></path>
</g>{/if}
{#if tenue === 'anomalie'}<g>
<g transform="rotate(-30 66 42)"><rect x="54" y="37" width="26" height="10" rx="3" fill="#f2d3b3"></rect></g>
<g transform="rotate(30 66 42)"><rect x="54" y="37" width="26" height="10" rx="3" fill="#f2d3b3"></rect></g>
</g>{/if}
{#if tenue === 'formation'}<g>
<rect x="42" y="36" width="36" height="12" rx="3" fill="#1d2733"></rect>
<path d="M22 34 L60 20 L98 34 L60 46 Z" fill="#1d2733"></path>
<path d="M60 33 L92 40 V54" fill="none" stroke="#f4c400" stroke-width="3" stroke-linecap="round"></path>
<circle cx="92" cy="57" r="3.5" fill="#f4c400"></circle>
</g>{/if}
{#if tenue === 'sport'}<g>
<rect x="30" y="42" width="60" height="9" rx="4.5" fill="#f4c400"></rect>
<rect x="84" y="44" width="6" height="16" rx="3" fill="#f4c400" transform="rotate(25 87 46)"></rect>
</g>{/if}
{#if tenue === 'recrue'}<g>
<path d="M34 46 Q36 26 60 26 Q84 26 86 46 Z" fill="#1d2733"></path>
<path d="M30 46 Q60 40 102 50 L100 55 Q60 46 30 51 Z" fill="#1d2733"></path>
<circle cx="60" cy="35" r="4.5" fill="#e3262b" stroke="#ffffff" stroke-width="1.5"></circle>
</g>{/if}
{#if tenue === 'retraite'}<g>
<path d="M30 46 Q32 28 60 26 Q88 28 90 46 Z" fill="#62ad3f"></path>
<rect x="22" y="43" width="76" height="7" rx="3.5" fill="#4d8f2f"></rect>
</g>{/if}
{#if tenue === 'lavage'}<g>
<rect x="44" y="20" width="30" height="13" rx="4" fill="#f4c400" transform="rotate(-8 59 26)"></rect>
</g>{/if}
{#if tenue === 'galette'}<g>
<path d="M36 36 L42 18 L51 30 L60 13 L69 30 L78 18 L84 36 Z" fill="#f4c400" stroke="#b9772a" stroke-width="2" stroke-linejoin="round"></path>
<circle cx="60" cy="27" r="2.5" fill="#e3262b"></circle>
</g>{/if}
{#if tenue === 'noel'}<g>
<path d="M30 46 Q36 18 66 20 Q92 24 104 50 Q92 44 86 46 Z" fill="#2e7a1f"></path>
<rect x="28" y="42" width="64" height="9" rx="4.5" fill="#ffffff"></rect>
<circle cx="104" cy="52" r="6" fill="#ffffff"></circle>
</g>{/if}
{#if tenue === 'nouvelan'}<g>
<path d="M60 -4 L47 32 H73 Z" fill="#1d2733"></path><path d="M53 16 L67 16 L69 22 L51 22 Z" fill="#f4c400"></path><circle cx="60" cy="-5" r="4.5" fill="#f4c400"></circle>
</g>{/if}
{#if yeux === 'normal'}<g class={cl.clin}>
<ellipse cx="49" cy="64" rx="8" ry="10" fill="#ffffff"></ellipse><ellipse cx="71" cy="64" rx="8" ry="10" fill="#ffffff"></ellipse>
<circle cx="51" cy="66" r="4.5" fill="#1d2733"></circle><circle cx="73" cy="66" r="4.5" fill="#1d2733"></circle>
</g>{/if}
{#if yeux === 'grands'}<g>
<ellipse cx="49" cy="63" rx="9" ry="11" fill="#ffffff"></ellipse><ellipse cx="71" cy="63" rx="9" ry="11" fill="#ffffff"></ellipse>
<circle cx="49" cy="63" r="4.5" fill="#1d2733"></circle><circle cx="71" cy="63" r="4.5" fill="#1d2733"></circle>
</g>{/if}
{#if yeux === 'fermes'}<g fill="none" stroke="#1d2733" stroke-width="4" stroke-linecap="round">
<path d="M42 66 Q49 71 56 66"></path><path d="M64 66 Q71 71 78 66"></path>
</g>{/if}
{#if yeux === 'joyeux'}<g fill="none" stroke="#ffffff" stroke-width="4.5" stroke-linecap="round">
<path d="M42 64 Q49 57 56 64"></path><path d="M64 64 Q71 57 78 64"></path>
</g>{/if}
{#if yeux === 'soleil'}<g>
<rect x="37" y="56" width="21" height="15" rx="6" fill="#1d2733"></rect><rect x="62" y="56" width="21" height="15" rx="6" fill="#1d2733"></rect>
<path d="M58 61 H62" stroke="#1d2733" stroke-width="3"></path>
<path d="M41 60 L47 60 M66 60 L72 60" stroke="#6b7785" stroke-width="2.5" stroke-linecap="round"></path>
</g>{/if}
{#if yeux === 'inquiet'}<g>
<ellipse cx="49" cy="64" rx="9" ry="11" fill="#ffffff"></ellipse><ellipse cx="71" cy="64" rx="9" ry="11" fill="#ffffff"></ellipse>
<circle cx="49" cy="60" r="3.5" fill="#1d2733"></circle><circle cx="71" cy="60" r="3.5" fill="#1d2733"></circle>
<path d="M40 50 L55 46 M80 50 L65 46" stroke="#1d2733" stroke-width="3" stroke-linecap="round"></path>
</g>{/if}
{#if yeux === 'concentre'}<g>
<ellipse cx="49" cy="68" rx="8" ry="9" fill="#ffffff"></ellipse><ellipse cx="71" cy="68" rx="8" ry="9" fill="#ffffff"></ellipse>
<circle cx="51" cy="70" r="4" fill="#1d2733"></circle><circle cx="73" cy="70" r="4" fill="#1d2733"></circle>
<path d="M43 60 L55 63 M77 60 L65 63" stroke="#1d2733" stroke-width="3" stroke-linecap="round"></path>
</g>{/if}
{#if yeux === 'lecture'}<g>
<ellipse cx="49" cy="64" rx="7" ry="8" fill="#ffffff"></ellipse><ellipse cx="71" cy="64" rx="7" ry="8" fill="#ffffff"></ellipse>
<circle cx="51" cy="66" r="3.5" fill="#1d2733"></circle><circle cx="73" cy="66" r="3.5" fill="#1d2733"></circle>
<circle cx="49" cy="64" r="11" fill="none" stroke="#1d2733" stroke-width="3"></circle><circle cx="71" cy="64" r="11" fill="none" stroke="#1d2733" stroke-width="3"></circle>
<path d="M57 62 Q60 59 63 62" fill="none" stroke="#1d2733" stroke-width="3"></path>
</g>{/if}
{#if yeux === 'haut'}<g>
<ellipse cx="49" cy="64" rx="8" ry="10" fill="#ffffff"></ellipse><ellipse cx="71" cy="64" rx="8" ry="10" fill="#ffffff"></ellipse>
<circle cx="49" cy="59" r="4.5" fill="#1d2733"></circle><circle cx="71" cy="59" r="4.5" fill="#1d2733"></circle>
</g>{/if}
{#if yeux === 'bas'}<g>
<ellipse cx="49" cy="64" rx="9" ry="11" fill="#ffffff"></ellipse><ellipse cx="71" cy="64" rx="9" ry="11" fill="#ffffff"></ellipse>
<circle cx="49" cy="69" r="4.5" fill="#1d2733"></circle><circle cx="71" cy="69" r="4.5" fill="#1d2733"></circle>
</g>{/if}
{#if yeux === 'cote'}<g>
<ellipse cx="49" cy="64" rx="8" ry="10" fill="#ffffff"></ellipse><ellipse cx="71" cy="64" rx="8" ry="10" fill="#ffffff"></ellipse>
<circle cx="54" cy="65" r="4.5" fill="#1d2733"></circle><circle cx="76" cy="65" r="4.5" fill="#1d2733"></circle>
</g>{/if}
{#if bouche === 'sourire'}<path d="M50 80 Q60 88 70 80" fill="none" stroke="#1d2733" stroke-width="4" stroke-linecap="round"></path>{/if}
{#if bouche === 'large'}<path d="M48 80 Q60 90 72 80" fill="none" stroke="#1d2733" stroke-width="4" stroke-linecap="round"></path>{/if}
{#if bouche === 'o'}<ellipse cx="60" cy="82" rx="5" ry="4.5" fill="#1d2733"></ellipse>{/if}
{#if bouche === 'triste'}<path d="M50 86 Q60 78 70 86" fill="none" stroke="#1d2733" stroke-width="4" stroke-linecap="round"></path>{/if}
{#if bouche === 'vague'}<path d="M51 84 Q55 80 60 84 Q65 88 69 84" fill="none" stroke="#1d2733" stroke-width="3.5" stroke-linecap="round"></path>{/if}
{#if bouche === 'droite'}<path d="M53 82 H67" stroke="#1d2733" stroke-width="3.5" stroke-linecap="round"></path>{/if}
{#if bouche === 'grande'}<path d="M46 76 Q60 94 74 76 Z" fill="#1d2733"></path>{/if}
{#if bouche === 'petite'}<path d="M51 83 Q60 88 69 83" fill="none" stroke="#1d2733" stroke-width="3.5" stroke-linecap="round"></path>{/if}
{#if tenue === 'ptitdej'}<path d="M64 85 Q67 92 72 86" fill="#ec5fa6"></path>{/if}
{#if tenue === 'hiver'}<g>
<rect x="28" y="84" width="64" height="11" rx="5" fill="#f4c400"></rect>
<rect x="70" y="88" width="11" height="22" rx="4" fill="#f4c400"></rect>
<rect x="70" y="102" width="11" height="4" fill="#ec5fa6"></rect>
<rect x="24" y="96" width="72" height="12" rx="5" fill="#1d2733"></rect>
</g>{/if}
{#if socle}<rect x="24" y="92" width="72" height="16" rx="5" fill={couleurSocle}></rect>{/if}
{#if tenue === 'bal14'}<g>
<path d="M47 87 L59 93 L47 99 Z" fill="#1d4ed8"></path><path d="M73 87 L61 93 L73 99 Z" fill="#1d4ed8"></path><circle cx="60" cy="93" r="3.5" fill="#1d4ed8"></circle>
</g>{/if}
{#if tenue === 'galons'}<g fill="none" stroke="#f4c400" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
<path d="M50 96 L60 101 L70 96"></path><path d="M50 101 L60 106 L70 101"></path>
</g>{/if}
{#if tenue === 'journeenationale'}<g>
<path d="M30 92 Q44 104 66 98" fill="none" stroke="#f4c400" stroke-width="4" stroke-dasharray="4 3" stroke-linecap="round"></path>
<circle cx="68" cy="98" r="3.5" fill="#f4c400"></circle>
</g>{/if}
{#if tenue === 'nouvelan'}<g>
<path d="M68 82 H90 Q100 82 100 74 Q100 68 94 68" fill="none" stroke="#ec5fa6" stroke-width="5" stroke-linecap="round"></path>
</g>{/if}
{#if tenue === 'saintebarbe'}<g>
<path d="M54 84 L60 96 L66 84 Z" fill="#1d9bd8"></path>
<circle cx="60" cy="100" r="7" fill="#f4c400" stroke="#b9772a" stroke-width="2"></circle>
</g>{/if}
</g>
</g>
{#if tenue === 'garde'}<g>
<rect x="104" y="58" width="44" height="58" rx="6" fill="#f4c400"></rect>
<rect x="116" y="52" width="20" height="10" rx="3" fill="#1d2733"></rect>
<path d="M111 76 L115 80 L122 72 M111 92 L115 96 L122 88" fill="none" stroke="#1d2733" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></path>
<path d="M127 77 H141 M127 93 H141" stroke="#1d2733" stroke-width="3" stroke-linecap="round"></path>
</g>{/if}
{#if tenue === 'anomalie'}<g transform="rotate(35 132 70)">
<rect x="128" y="62" width="9" height="46" rx="3" fill="#6b7785"></rect>
<path d="M122 50 a11 11 0 1 0 21 0 l-4 6 h-13 z" fill="#6b7785"></path>
</g>{/if}
{#if tenue === 'ptitdej'}<g>
<path d="M104 96 C104 74 150 74 150 96 C146 90 140 88 138 92 C134 84 120 84 116 92 C114 88 108 90 104 96 Z" fill="#e0a24a"></path>
<path d="M120 80 Q122 88 118 92 M134 80 Q132 88 136 92" fill="none" stroke="#b9772a" stroke-width="2.5" stroke-linecap="round"></path>
<g class={cl.tombe} fill="#e0a24a"><circle cx="112" cy="110" r="2"></circle><circle cx="140" cy="114" r="2"></circle></g>
</g>{/if}
{#if tenue === 'vacances'}<g>
<rect x="108" y="78" width="40" height="44" rx="6" fill="#b9772a"></rect>
<path d="M120 78 V70 H136 V78" fill="none" stroke="#1d2733" stroke-width="4" stroke-linejoin="round"></path>
<circle cx="120" cy="92" r="5" fill="#f4c400"></circle><rect x="128" y="102" width="14" height="8" rx="2" fill="#ec5fa6"></rect>
</g>{/if}
{#if tenue === 'anniversaire'}<g>
<rect x="106" y="96" width="44" height="24" rx="4" fill="#f6c9d8"></rect>
<rect x="106" y="90" width="44" height="10" rx="4" fill="#ec5fa6"></rect>
<rect x="126" y="74" width="4" height="16" rx="1" fill="#1d9bd8"></rect>
<path class={cl.scintille} d="M128 62 Q134 70 128 74 Q122 70 128 62 Z" fill="#f4c400"></path>
</g>{/if}
{#if tenue === 'bienvenue'}<g>
<g class={cl.coucou}><rect x="112" y="50" width="18" height="24" rx="9" fill="#e3262b"></rect><circle cx="111" cy="66" r="5" fill="#e3262b"></circle></g>
<path d="M138 46 Q143 54 138 62 M146 42 Q153 54 146 66" fill="none" stroke="#9aa6b2" stroke-width="3" stroke-linecap="round"></path>
</g>{/if}
{#if tenue === 'horsligne'}<g>
<path d="M96 118 Q112 142 126 126" fill="none" stroke="#1d2733" stroke-width="3" stroke-linecap="round"></path>
<g class={cl.balance}><rect x="122" y="112" width="16" height="13" rx="3" fill="#6b7785"></rect>
<path d="M126 112 V104 M134 112 V104" stroke="#6b7785" stroke-width="3" stroke-linecap="round"></path></g>
</g>{/if}
{#if tenue === 'sport'}<g>
<rect x="110" y="96" width="32" height="6" rx="2" fill="#6b7785"></rect>
<rect x="104" y="88" width="9" height="22" rx="2" fill="#1d2733"></rect><rect x="139" y="88" width="9" height="22" rx="2" fill="#1d2733"></rect>
</g>{/if}
{#if tenue === 'vide'}<g>
<circle cx="124" cy="84" r="14" fill="#ffffff" fill-opacity="0.5" stroke="#1d2733" stroke-width="5"></circle>
<path d="M134 94 L148 110" stroke="#1d2733" stroke-width="6" stroke-linecap="round"></path>
</g>{/if}
{#if tenue === 'calendriers'}<g>
<rect x="112" y="84" width="38" height="28" rx="3" fill="#f4f6f8" stroke="#1d2733" stroke-width="2"></rect>
<rect x="106" y="92" width="38" height="28" rx="3" fill="#ffffff" stroke="#1d2733" stroke-width="2"></rect>
<rect x="106" y="92" width="38" height="8" rx="3" fill="#e3262b"></rect>
<path d="M114 89 V95 M136 89 V95" stroke="#1d2733" stroke-width="2.5" stroke-linecap="round"></path>
<path d="M112 106 H138 M112 112 H130" stroke="#9aa6b2" stroke-width="2" stroke-linecap="round"></path>
</g>{/if}
{#if tenue === 'journeenationale'}<g>
<line x1="120" y1="38" x2="120" y2="122" stroke="#1d2733" stroke-width="3" stroke-linecap="round"></line>
<rect x="122" y="40" width="9" height="20" fill="#1d4ed8"></rect><rect x="131" y="40" width="9" height="20" fill="#ffffff" stroke="#d5dbe1" stroke-width="1"></rect><rect x="140" y="40" width="9" height="20" fill="#e3262b"></rect>
</g>{/if}
{#if tenue === 'retraite'}<g>
<path d="M104 122 L150 36" stroke="#b9772a" stroke-width="3" stroke-linecap="round"></path>
<path d="M150 36 V88" stroke="#9aa6b2" stroke-width="1.5"></path>
<g class={cl.balancePeche}><path d="M142 94 Q150 86 158 94 Q150 102 142 94 Z" fill="#1d9bd8"></path><path d="M142 94 L136 89 L136 99 Z" fill="#1d9bd8"></path></g>
</g>{/if}
{#if tenue === 'lavage'}<g>
<path d="M108 94 L146 94 L142 122 L112 122 Z" fill="#1d9bd8"></path>
<path d="M110 94 Q127 74 144 94" fill="none" stroke="#1d2733" stroke-width="2.5"></path>
<ellipse cx="127" cy="94" rx="19" ry="4" fill="#d7ecfb"></ellipse>
</g>{/if}
{#if tenue === 'cafe'}<g>
<g class={cl.zzz} fill="none" stroke="#9aa6b2" stroke-width="2.5" stroke-linecap="round"><path d="M118 80 Q114 72 118 66"></path><path d="M128 80 Q124 72 128 64"></path></g>
<rect x="110" y="86" width="28" height="30" rx="5" fill="#ffffff" stroke="#1d2733" stroke-width="3"></rect>
<path d="M138 92 Q148 92 148 101 Q148 110 138 110" fill="none" stroke="#1d2733" stroke-width="3"></path>
<rect x="110" y="96" width="28" height="6" fill="#e3262b"></rect>
</g>{/if}
{#if tenue === 'chandeleur'}<g>
<ellipse class={cl.saute} cx="126" cy="70" rx="16" ry="5" fill="#f2c879" stroke="#b9772a" stroke-width="1.5"></ellipse>
<ellipse cx="126" cy="102" rx="20" ry="6" fill="#1d2733"></ellipse>
<rect x="144" y="99" width="16" height="5" rx="2.5" fill="#1d2733"></rect>
</g>{/if}
{#if tenue === 'halloween'}<g>
<ellipse cx="128" cy="106" rx="19" ry="16" fill="#f08a24"></ellipse>
<path d="M120 92 Q128 98 136 92" fill="none" stroke="#c9690f" stroke-width="2"></path>
<rect x="126" y="84" width="5" height="8" rx="2" fill="#4d8f2f"></rect>
<path d="M118 102 L123 96 L127 102 Z M129 102 L134 96 L138 102 Z" fill="#1d2733"></path>
<path d="M118 110 Q128 118 138 110 L134 112 L131 109 L128 112 L125 109 L122 112 Z" fill="#1d2733"></path>
</g>{/if}
{#if tenue === 'brouillard'}<g stroke="#c9d1d9" stroke-width="9" stroke-linecap="round" opacity="0.85">
<path d="M6 72 H70"></path><path d="M90 88 H154"></path><path d="M20 108 H120"></path>
</g>{/if}
{#if tenue === 'canicule'}<g>
<line x1="130" y1="98" x2="130" y2="122" stroke="#1d2733" stroke-width="4" stroke-linecap="round"></line>
<rect x="116" y="118" width="28" height="6" rx="3" fill="#1d2733"></rect>
<circle cx="130" cy="80" r="19" fill="#ffffff" stroke="#1d2733" stroke-width="3"></circle>
<g class={cl.tourneLent} fill="#9fc7e6"><ellipse cx="130" cy="70" rx="5" ry="9"></ellipse><ellipse cx="139" cy="85" rx="5" ry="9" transform="rotate(120 139 85)"></ellipse><ellipse cx="121" cy="85" rx="5" ry="9" transform="rotate(-120 121 85)"></ellipse></g>
<circle cx="130" cy="80" r="3.5" fill="#1d2733"></circle>
<path class={cl.glisse} d="M30 40 C30 40 25 48 25 51 a5 5 0 0 0 10 0 C35 48 30 40 30 40 Z" fill="#1d9bd8"></path>
</g>{/if}
</svg>

<style>
	.gyro :global(.a-respire){transform-box:fill-box;transform-origin:50% 100%;animation:g-respire 3.2s ease-in-out infinite}
	.gyro :global(.a-saute){transform-box:fill-box;transform-origin:50% 100%;animation:g-saute 1.2s ease-out infinite}
	.gyro :global(.a-penche){transform-box:fill-box;transform-origin:50% 100%;animation:g-penche 2.4s ease-in-out infinite}
	.gyro :global(.a-clin){transform-box:fill-box;transform-origin:50% 50%;animation:g-clin 5s infinite}
	.gyro :global(.a-rayonne){animation:g-rayonne 1.6s ease-in-out infinite}
	.gyro :global(.a-tourne){transform-box:view-box;transform-origin:80px 52px;animation:g-tourne 2.4s linear infinite}
	.gyro :global(.a-tourne-lent){transform-box:fill-box;transform-origin:50% 50%;animation:g-tourne 12s linear infinite}
	.gyro :global(.a-zzz){animation:g-zzz 3s ease-out infinite}
	.gyro :global(.a-scintille){animation:g-scintille 1.4s ease-in-out infinite}
	.gyro :global(.a-tombe){animation:g-tombe 1.6s linear infinite}
	.gyro :global(.a-glisse){animation:g-glisse 1.6s ease-in infinite}
	.gyro :global(.a-coucou){transform-box:fill-box;transform-origin:50% 100%;animation:g-coucou 1.2s ease-in-out infinite}
	.gyro :global(.a-balance){transform-box:view-box;transform-origin:96px 118px;animation:g-balance 1.8s ease-in-out infinite alternate}
	@keyframes -global-g-respire{0%,100%{transform:scale(1,1)}50%{transform:scale(1.025,0.975)}}
	@keyframes -global-g-saute{0%,100%{transform:translateY(0)}35%,55%{transform:translateY(-12px)}}
	@keyframes -global-g-penche{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(-12deg)}}
	@keyframes -global-g-clin{0%,90%,100%{transform:scaleY(1)}94%{transform:scaleY(0.1)}}
	@keyframes -global-g-rayonne{0%,100%{opacity:.35}50%{opacity:1}}
	@keyframes -global-g-tourne{to{transform:rotate(360deg)}}
	@keyframes -global-g-zzz{0%{opacity:0;transform:translate(0,6px)}40%{opacity:1}100%{opacity:0;transform:translate(8px,-10px)}}
	@keyframes -global-g-scintille{0%,100%{opacity:1}50%{opacity:.25}}
	@keyframes -global-g-tombe{0%{transform:translateY(-8px);opacity:0}25%{opacity:1}100%{transform:translateY(14px);opacity:0}}
	@keyframes -global-g-glisse{0%{transform:translateY(0);opacity:1}100%{transform:translateY(10px);opacity:0}}
	@keyframes -global-g-coucou{0%,100%{transform:rotate(0)}25%{transform:rotate(-20deg)}75%{transform:rotate(20deg)}}
	@keyframes -global-g-balance{0%{transform:rotate(-8deg)}100%{transform:rotate(8deg)}}
	@media (prefers-reduced-motion: reduce) {
		.gyro :global([class^='a-']),
		.gyro :global([class*=' a-']) {
			animation: none !important;
		}
	}
</style>
