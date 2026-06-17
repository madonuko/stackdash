import { getRuntimeEnv } from '$lib/server/env';
import { duidLlFromMacAddress, normalizeMacAddress } from '$lib/server/network-identifiers';
import ky, { type KyInstance } from 'ky';

type KeaService = 'dhcp4' | 'dhcp6';
type KeaReservationOperationTarget = 'memory' | 'database' | 'all' | 'default';

type KeaControlResponse<TArguments = Record<string, unknown>> = {
	result: number;
	text?: string;
	arguments?: TArguments;
};

type KeaSaveResponse = {
	result: 'saved';
	id: string | number;
};

type KeaOptionData = {
	name?: string;
	code?: number;
	data?: string;
	space?: string;
	[key: string]: unknown;
};

type KeaUserContext = {
	comment?: string;
	[key: string]: unknown;
};

export type KeaSubnet4 = {
	id: number;
	subnet: string;
	pools?: { pool: string }[];
	reservations?: KeaReservation4[];
	'option-data'?: KeaOptionData[];
	'user-context'?: KeaUserContext;
	[key: string]: unknown;
};

export type KeaSubnet6 = {
	id: number;
	subnet: string;
	interface?: string;
	pools?: { pool: string }[];
	reservations?: KeaReservation6[];
	'option-data'?: KeaOptionData[];
	'user-context'?: KeaUserContext;
	[key: string]: unknown;
};

export type KeaReservation4 = {
	'hw-address'?: string;
	'ip-address'?: string;
	hostname?: string;
	'option-data'?: KeaOptionData[];
	'user-context'?: KeaUserContext;
	[key: string]: unknown;
};

export type KeaReservation6 = {
	'hw-address'?: string;
	duid?: string;
	'ip-addresses'?: string[];
	'ip-address'?: string;
	prefixes?: string[];
	hostname?: string;
	'option-data'?: KeaOptionData[];
	'user-context'?: KeaUserContext;
	[key: string]: unknown;
};

type KeaConfig4 = {
	Dhcp4: {
		subnet4?: KeaSubnet4[];
		[key: string]: unknown;
	};
};

type KeaConfig6 = {
	Dhcp6: {
		subnet6?: KeaSubnet6[];
		[key: string]: unknown;
	};
};

export class KeaError extends Error {
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
		this.name = 'KeaError';
	}
}

function getKeaConfig() {
	const env = getRuntimeEnv();
	if (!env.KEA_CONTROL_AGENT_URL) return null;

	return {
		apiUrl: env.KEA_CONTROL_AGENT_URL.replace(/\/+$/, '')
	};
}

export function isKeaConfigured() {
	return getKeaConfig() !== null;
}

function subnetId(id: string | number) {
	const parsed = Number(id);
	if (!Number.isInteger(parsed) || parsed <= 0) {
		throw new KeaError('Kea subnet id must be a positive integer.', 400, { id });
	}

	return parsed;
}

export class KeaClient {
	private api: KyInstance;

	constructor() {
		const config = getKeaConfig();
		if (!config) throw new KeaError("Couldn't get Kea Config", 500, '');

		this.api = ky.create({
			prefix: config.apiUrl,
			headers: {
				Accept: 'application/json'
			},
			timeout: 30_000
		});
	}

	private async command<TArguments = Record<string, unknown>>(
		service: KeaService,
		command: string,
		args?: Record<string, unknown>,
		allowEmpty = false
	): Promise<KeaControlResponse<TArguments>> {
		const response = await this.api
			.post<KeaControlResponse<TArguments>[] | KeaControlResponse<TArguments>>('', {
				json: {
					command,
					service: [service],
					...(args ? { arguments: args } : {})
				}
			})
			.json();

		const body = Array.isArray(response) ? response[0] : response;
		if (!body) throw new KeaError(`Kea ${command} returned an empty response.`, 502, response);

		if (body.result !== 0 && !(allowEmpty && body.result === 3)) {
			throw new KeaError(`Kea ${command} request failed.`, 500, body);
		}

		return body;
	}

	private async getConfig4(): Promise<KeaConfig4> {
		const response = await this.command<{ Dhcp4: KeaConfig4['Dhcp4'] }>('dhcp4', 'config-get');
		return {
			Dhcp4: { ...response.arguments?.Dhcp4, subnet4: response.arguments?.Dhcp4?.subnet4 ?? [] }
		};
	}

	private async getConfig6(): Promise<KeaConfig6> {
		const response = await this.command<{ Dhcp6: KeaConfig6['Dhcp6'] }>('dhcp6', 'config-get');
		return {
			Dhcp6: { ...response.arguments?.Dhcp6, subnet6: response.arguments?.Dhcp6?.subnet6 ?? [] }
		};
	}

	async createDHCPv4Reservation(
		subnet_id: string | number,
		address: string,
		macAddress: string,
		operationTarget: KeaReservationOperationTarget = 'default'
	): Promise<KeaSaveResponse | null> {
		const subnet_id_number = subnetId(subnet_id);

		await this.command('dhcp4', 'reservation-add', {
			reservation: {
				'subnet-id': subnet_id_number,
				'hw-address': normalizeMacAddress(macAddress),
				'ip-address': address
			},
			'operation-target': operationTarget
		});

		return { result: 'saved', id: address };
	}

	async listDHCPv4Subnets(): Promise<KeaSubnet4[]> {
		const config = await this.getConfig4();
		return config.Dhcp4.subnet4 ?? [];
	}

	async createDHCPv6Reservation(
		subnet_id: string | number,
		address: string,
		prefix: string | null,
		macAddress: string,
		operationTarget: KeaReservationOperationTarget = 'default'
	): Promise<KeaSaveResponse | null> {
		const subnet_id_number = subnetId(subnet_id);

		await this.command('dhcp6', 'reservation-add', {
			reservation: {
				'subnet-id': subnet_id_number,
				duid: duidLlFromMacAddress(macAddress),
				'ip-addresses': [address],
				...(prefix ? { prefixes: [prefix] } : {})
			},
			'operation-target': operationTarget
		});

		return { result: 'saved', id: address };
	}

	async listDHCPv6Subnets(): Promise<KeaSubnet6[]> {
		const config = await this.getConfig6();
		return config.Dhcp6.subnet6 ?? [];
	}
}
