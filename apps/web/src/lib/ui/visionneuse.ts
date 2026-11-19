// Un appui à prendre pour la visionneuse : un clic simple sur un lien de photo (marqué `data-visionneuse`).
// Avec Ctrl, Cmd, Maj ou Alt, le navigateur garde la main (nouvel onglet, téléchargement).
type Appui = Pick<MouseEvent, 'button' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey' | 'defaultPrevented'> & { target: unknown };
type Lien = { getAttribute(nom: string): string | null; querySelector(s: string): { alt: string } | null };

export function photoVisee(e: Appui): { lien: Lien; src: string; alt: string } | null {
	if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return null;
	const lien = (e.target as { closest?: (s: string) => Lien | null } | null)?.closest?.('a[data-visionneuse]');
	const src = lien?.getAttribute('href');
	if (!lien || !src) return null;
	return { lien, src, alt: lien.querySelector('img')?.alt ?? '' };
}
