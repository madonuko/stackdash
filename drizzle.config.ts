import { defineConfig } from 'drizzle-kit';

const url =
	process.env.DATABASE_URL || process.env.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE;

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	dialect: 'postgresql',
	...(url ? { dbCredentials: { url } } : {}),
	verbose: true,
	strict: true
});
