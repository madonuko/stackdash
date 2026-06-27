import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import type { RequestEvent } from '@sveltejs/kit';
import * as schema from './schema';
import { getRequestEvent } from '$app/server';
import { getRuntimeEnv } from '$lib/server/env';

export type Database = ReturnType<typeof drizzle<typeof schema>>;

function createPool(connectionString: string) {
	const url = new URL(connectionString);
	const useSystemSsl = url.searchParams.get('sslrootcert') === 'system';
	url.searchParams.delete('sslrootcert');

	const pool = new Pool({
		connectionString: url.toString(),
		max: 5,
		...(useSystemSsl ? { ssl: { rejectUnauthorized: true } } : {})
	});
	pool.on('error', (error) => {
		console.error('Unexpected error on idle PostgreSQL client', error);
	});

	return pool;
}

export function initDrizzle(): Database {
	const event = getRequestEvent();

	if (event.locals.dbPool) return event.locals.db!;

	const { DATABASE_URL, HYPERDRIVE } = getRuntimeEnv();
	const connectionString = HYPERDRIVE?.connectionString ?? DATABASE_URL;

	if (!connectionString) {
		throw new Error(
			'No database connection string is available. Configure the HYPERDRIVE binding for Workers or DATABASE_URL for local non-Wrangler development.'
		);
	}

	const pool = createPool(connectionString);
	const db = drizzle(pool, { schema });
	event.locals.dbPool = pool;
	event.locals.db = db;

	return db;
}

export function closeRequestDb(event: RequestEvent) {
	const pool = event.locals.dbPool;
	if (!pool) return;

	event.locals.dbPool = undefined;
	event.locals.db = undefined;

	const ending = pool.end().catch((error) => {
		console.error('Error closing PostgreSQL pool', error);
	});

	const ctx = event.platform?.ctx;
	if (ctx) {
		ctx.waitUntil(ending);
	}
}
