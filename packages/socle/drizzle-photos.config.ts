import { defineConfig } from 'drizzle-kit';

// Base des photos, à part de la base principale (drizzle.config.ts).
export default defineConfig({
	dialect: 'sqlite',
	schema: './src/schema-photos.ts',
	out: './migrations-photos'
});
