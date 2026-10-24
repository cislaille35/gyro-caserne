declare global {
	namespace App {
		interface Platform {
			env: Record<string, never>;
			ctx: ExecutionContext;
			caches: CacheStorage & { default: Cache };
		}
	}
}

export {};
