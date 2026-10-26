export function cinqTouches(appuis: number[], maintenant: number): boolean {
	return appuis.filter((t) => maintenant - t <= 2000).length >= 5;
}
