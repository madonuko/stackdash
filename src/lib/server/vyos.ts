import { getRuntimeEnv } from '$lib/server/env';

type VyosCommandResponse = {
	result?: string;
	status?: string;
};

export type VyosStaticNeighborParams = {
	ipaddress: string;
	macAddress: string;
	description: string;
};

export type VyosStaticRouteParams = {
	destination: string;
	gateway: string;
	description: string;
};

export class VyosError extends Error {
	constructor(
		message: string,
		readonly status: number,
		readonly details: unknown
	) {
		let detailsString;
		try {
			detailsString = JSON.stringify(details);
		} catch {
			detailsString = 'Unable to stringify details';
		}

		super(`${message} - ${status} - ${detailsString}`);
		this.name = 'VyosError';
	}
}

function getVyosConfig() {
	const env = getRuntimeEnv();
	if (!env.VYOS_API_URL || !env.VYOS_API_KEY) return null;

	return {
		apiUrl: env.VYOS_API_URL.replace(/\/+$/, ''),
		apiKey: env.VYOS_API_KEY
	};
}

export function isVyosConfigured() {
	return getVyosConfig() !== null;
}

export class VyosClient {
	constructor() {
		const config = getVyosConfig();
		if (!config) throw new VyosError("Couldn't get VyOS config", 500, '');
	}

	async ensureStaticNeighborEntry(
		params: VyosStaticNeighborParams
	): Promise<VyosCommandResponse | null> {
		console.warn('VyOS static neighbor orchestration is not implemented yet', params);
		return null;
	}

	async ensureStaticRoute(params: VyosStaticRouteParams): Promise<VyosCommandResponse | null> {
		console.warn('VyOS static route orchestration is not implemented yet', params);
		return null;
	}
}
