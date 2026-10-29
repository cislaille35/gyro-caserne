// La config du centre pour écrire en ligne : les deux bases (principale et photos) marquées « remote ».
export function configEnLigne(texte: string): string {
	let copie = texte;
	for (const liaison of ['BASE', 'PHOTOS']) {
		const avant = copie;
		copie = copie.replace(`"binding": "${liaison}",`, `"binding": "${liaison}", "remote": true,`);
		if (copie === avant) throw new Error(`Base ${liaison} introuvable dans wrangler.jsonc`);
	}
	return copie;
}
