import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import { getRuntimeEnv } from '$lib/server/env';

const pools = new Map<string, Pool>();

function getPool(connectionString: string) {
	let pool = pools.get(connectionString);

	if (!pool) {
		// Strip sslrootcert=system — node-pg doesn't support the "system"
		// keyword and tries to open it as a file path. We enable SSL via
		// the pool options instead.
		const url = new URL(connectionString);
		const useSystemSsl = url.searchParams.get('sslrootcert') === 'system';
		url.searchParams.delete('sslrootcert');

		pool = new Pool({
			connectionString: url.toString(),
			max: 5,
			...(useSystemSsl ? { ssl: { rejectUnauthorized: true } } : {})
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
