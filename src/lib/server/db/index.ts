import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import { getRuntimeEnv } from '$lib/server/env';

const pools = new Map<string, Pool>();

function getPool(connectionString: string) {
	let pool = pools.get(connectionString);

	if (!pool) {
		pool = new Pool({
			connectionString,
			max: 5
		});
		pools.set(connectionString, pool);
	}

	return pool;
}

export function initDrizzle() {
	const { DATABASE_URL, HYPERDRIVE } = getRuntimeEnv();
	const connectionString = HYPERDRIVE?.connectionString ?? DATABASE_URL;

	if (!connectionString) {
		throw new Error(
			'No database connection string is available. Configure the HYPERDRIVE binding for Workers or DATABASE_URL for local non-Wrangler development.'
		);
	}

	return drizzle(getPool(connectionString), { schema });
}
