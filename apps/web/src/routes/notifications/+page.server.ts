import { exigerActeur } from '#lib/server/formulaire-mur.ts';
import { aFaire } from '#lib/a-faire.ts';
import { aNePasManquerDe } from '#lib/server/a-faire.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => aFaire(await aNePasManquerDe(locals.base, exigerActeur(locals)));
