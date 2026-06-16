import { getRuntimeEnv } from '$lib/server/env';
import ky, { type KyInstance } from 'ky';
import { Agent } from 'undici';

/*
search queries seem to be using jquery-bootgrid if you want more details on them.
*/

export class OpnsenseError extends Error {
	constructor(
		message: string,
		readonly status: number,
		readonly details: unknown
	) {
		let details_string;
		try {
			details_string = JSON.stringify(details);
		} catch {
			details_string = 'Unable to stringify details';
		}

		super(`${message} - ${status} - ${details_string}`);
		this.name = 'OpnsenseError';
	}
}

function getOpnsenseConfig() {
	const env = getRuntimeEnv();
	if (!env.OPNSENSE_API_KEY || !env.OPNSENSE_API_SECRET || !env.OPNSENSE_API_URL) return null;

	return {
		apiKey: env.OPNSENSE_API_KEY,
		apiSecret: env.OPNSENSE_API_SECRET,
		apiUrl: env.OPNSENSE_API_URL.replace(/\/+$/, '')
	};
}

export function isOpnsenseConfigured() {
	return getOpnsenseConfig() !== null;
}

export class OpnsenseClient {
	private api: KyInstance;

	constructor() {
		const config = getOpnsenseConfig();
		if (!config) throw new OpnsenseError("Couldn't get Opnsense Config", 500, '');

		// Build a custom fetch that skips TLS verification for self-signed certs
		const insecureAgent = new Agent({ connect: { rejectUnauthorized: false } });
		const insecureFetch = (input: RequestInfo | URL, init?: RequestInit) =>
			fetch(input, {
				...init,
				// @ts-expect-error -- Node/undici dispatcher extension
				dispatcher: insecureAgent
			});

		this.api = ky.create({
			prefix: `${config.apiUrl}`,
			headers: {
				Authorization:
					'Basic ' + Buffer.from(config.apiKey + ':' + config.apiSecret).toString('base64'),
				Accept: 'application/json'
			},
			timeout: 30_000,
			fetch: insecureFetch
		});
	}

	// we switched over to directly using kea, so this code is mostly not necessary anymore, but we still will need to hit opnsense to set the routing for prefix delegation so i left that code here.
}
