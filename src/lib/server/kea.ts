import { getRuntimeEnv } from '$lib/server/env';
import { duidLlFromMacAddress, normalizeMacAddress } from '$lib/server/network-identifiers';
import ky, { type KyInstance } from 'ky';

type KeaService = 'dhcp4' | 'dhcp6';

type KeaControlResponse<TArguments = Record<string, unknown>> = {
	result: number;
	text?: string;
	arguments?: TArguments;
};

type KeaSaveResponse = {
	result: 'saved';
	id: string | number;
};

type KeaReservationOperationTarget = 'memory' | 'database' | 'all' | 'default';

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

export type KeaReservation4WithSubnet = KeaReservation4 & {
	'subnet-id': number;
	subnet: string;
};

export type KeaReservation6WithSubnet = KeaReservation6 & {
	'subnet-id': number;
	subnet: string;
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

type KeaReservationListResponse<T> = {
	hosts?: T[];
};

export type KeaLease = {
	cltt?: number;
	duid?: string;
	'fqdn-fwd'?: boolean;
	'fqdn-rev'?: boolean;
	hostname?: string;
	'hw-address'?: string;
	'client-id'?: string;
	iaid?: number;
	'ip-address'?: string;
	'preferred-lft'?: number;
	'prefix-len'?: number;
	state?: number;
	'subnet-id'?: number;
	type?: string;
	'valid-lft'?: number;
	[key: string]: unknown;
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

	async deleteDHCPv4Lease(address: string): Promise<KeaControlResponse | null> {
		if (!address) return null;

		return await this.command('dhcp4', 'lease4-del', { 'ip-address': address }, true);
	}

	async deleteDHCPv6Lease(address: string): Promise<KeaControlResponse | null> {
		if (!address) return null;

		return await this.command('dhcp6', 'lease6-del', { 'ip-address': address }, true);
	}

	/// DHCPv4

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

	// Kea host reservations do not have reservation ids. Pass the subnet id and IPv4 address.
	async deleteDHCPv4Reservation(
		subnet_id: string | number,
		address: string,
		operationTarget: KeaReservationOperationTarget = 'default'
	) {
		await this.command('dhcp4', 'reservation-del', {
			'subnet-id': subnetId(subnet_id),
			'ip-address': address,
			'operation-target': operationTarget
		});
	}

	async listDHCPv4Reservations(
		subnet_id: string | number,
		operationTarget: KeaReservationOperationTarget = 'default'
	): Promise<KeaReservation4WithSubnet[]> {
		const response = await this.command<KeaReservationListResponse<KeaReservation4WithSubnet>>(
			'dhcp4',
			'reservation-get-all',
			{
				'subnet-id': subnetId(subnet_id),
				'operation-target': operationTarget
			},
			true
		);

		return response.arguments?.hosts ?? [];
	}

	async findDHCPv4ReservationsByAddress(
		address: string,
		subnet_id?: string | number,
		operationTarget: KeaReservationOperationTarget = 'default'
	): Promise<KeaReservation4WithSubnet[]> {
		const response = await this.command<KeaReservationListResponse<KeaReservation4WithSubnet>>(
			'dhcp4',
			'reservation-get-by-address',
			{
				'ip-address': address,
				...(subnet_id === undefined ? {} : { 'subnet-id': subnetId(subnet_id) }),
				'operation-target': operationTarget
			},
			true
		);

		return response.arguments?.hosts ?? [];
	}

	async listDHCPv4Subnets(): Promise<KeaSubnet4[]> {
		const config = await this.getConfig4();
		return config.Dhcp4.subnet4 ?? [];
	}

	async listDHCPv4Leases(): Promise<KeaLease[]> {
		const response = await this.command<{ leases?: KeaLease[] }>(
			'dhcp4',
			'lease4-get-all',
			undefined,
			true
		);
		return response.arguments?.leases ?? [];
	}

	// DHCPv6

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

	// Kea host reservations do not have reservation ids. Pass the subnet id and IPv6 address.
	async deleteDHCPv6Reservation(
		subnet_id: string | number,
		address: string,
		operationTarget: KeaReservationOperationTarget = 'default'
	) {
		await this.command('dhcp6', 'reservation-del', {
			'subnet-id': subnetId(subnet_id),
			'ip-address': address,
			'operation-target': operationTarget
		});
	}

	async listDHCPv6Reservations(
		subnet_id: string | number,
		operationTarget: KeaReservationOperationTarget = 'default'
	): Promise<KeaReservation6WithSubnet[]> {
		const response = await this.command<KeaReservationListResponse<KeaReservation6WithSubnet>>(
			'dhcp6',
			'reservation-get-all',
			{
				'subnet-id': subnetId(subnet_id),
				'operation-target': operationTarget
			},
			true
		);

		return response.arguments?.hosts ?? [];
	}

	async findDHCPv6ReservationsByAddress(
		address: string,
		subnet_id?: string | number,
		operationTarget: KeaReservationOperationTarget = 'default'
	): Promise<KeaReservation6WithSubnet[]> {
		const response = await this.command<KeaReservationListResponse<KeaReservation6WithSubnet>>(
			'dhcp6',
			'reservation-get-by-address',
			{
				'ip-address': address,
				...(subnet_id === undefined ? {} : { 'subnet-id': subnetId(subnet_id) }),
				'operation-target': operationTarget
			},
			true
		);

		return response.arguments?.hosts ?? [];
	}

	async listDHCPv6Subnets(): Promise<KeaSubnet6[]> {
		const config = await this.getConfig6();
		return config.Dhcp6.subnet6 ?? [];
	}

	async listDHCPv6Leases(): Promise<KeaLease[]> {
		const response = await this.command<{ leases?: KeaLease[] }>(
			'dhcp6',
			'lease6-get-all',
			undefined,
			true
		);
		return response.arguments?.leases ?? [];
	}
}

async function testFunction2() {
	console.log('running kea test function');
	const keaClient = new KeaClient();

	console.log('dhcpv4 subnets');
	const dhcpv4_subnets = await keaClient.listDHCPv4Subnets();
	console.log(dhcpv4_subnets);

	console.log('dhcpv4 reservations');
	for (const subnet of dhcpv4_subnets) {
		console.log(await keaClient.listDHCPv4Reservations(subnet.id));
	}

	console.log('dhcpv4 leases');
	console.log(await keaClient.listDHCPv4Leases());

	console.log('dhcpv6 subnets');
	const dhcpv6_subnets = await keaClient.listDHCPv6Subnets();
	console.log(dhcpv6_subnets);

	console.log('dhcpv6 reservations');
	for (const subnet of dhcpv6_subnets) {
		console.log(await keaClient.listDHCPv6Reservations(subnet.id));
	}

	console.log('dhcpv6 leases');
	console.log(await keaClient.listDHCPv6Leases());
}

// this code is intentionally dead. it should be turned into proper test cases, but caleb needed it to verify the implementation worked.
async function testFunction() {
	console.log('running kea test function');
	const keaClient = new KeaClient();

	const dhcpv6Subnets = await keaClient.listDHCPv6Subnets();
	const dhcpv6Subnet = dhcpv6Subnets[0];

	console.log('dhcpv6 subnets');
	console.log(dhcpv6Subnets);

	if (!dhcpv6Subnet) {
		console.log('No DHCPv6 subnet exists. Create one in Kea before running this test.');
	} else {
		const dhcpv6ReservationAddress = '2001:db8:2231:aaed::1';
		const dhcpv6ReservationPrefix = '2001:db8:2231:aaed::/64';

		const dhcpv6ReservationRes = await keaClient.createDHCPv6Reservation(
			dhcpv6Subnet.id,
			dhcpv6ReservationAddress,
			dhcpv6ReservationPrefix,
			'AB:CD:EF:AB:CD:E4'
		);

		console.log(dhcpv6ReservationRes);

		if (dhcpv6ReservationRes?.result === 'saved') {
			console.log(await keaClient.listDHCPv6Reservations(dhcpv6Subnet.id));
			console.log(await keaClient.findDHCPv6ReservationsByAddress(dhcpv6ReservationAddress));
			console.log(
				await keaClient.findDHCPv6ReservationsByAddress(dhcpv6ReservationAddress, dhcpv6Subnet.id)
			);

			// await keaClient.deleteDHCPv6Reservation(dhcpv6Subnet.id, dhcpv6ReservationAddress);
		}
	}

	const dhcpv4Subnets = await keaClient.listDHCPv4Subnets();
	const dhcpv4Subnet = dhcpv4Subnets[0];

	console.log('dhcpv4 subnets');
	console.log(dhcpv4Subnets);

	if (!dhcpv4Subnet) {
		console.log('No DHCPv4 subnet exists. Create one in Kea before running this test.');
	} else {
		const dhcpv4ReservationAddress = '192.168.128.120';

		const dhcpv4ReservationRes = await keaClient.createDHCPv4Reservation(
			dhcpv4Subnet.id,
			dhcpv4ReservationAddress,
			'AB:CD:EF:AB:CD:E2'
		);

		console.log(dhcpv4ReservationRes);

		if (dhcpv4ReservationRes?.result === 'saved') {
			console.log(await keaClient.listDHCPv4Reservations(dhcpv4Subnet.id));
			console.log(await keaClient.findDHCPv4ReservationsByAddress(dhcpv4ReservationAddress));
			console.log(
				await keaClient.findDHCPv4ReservationsByAddress(dhcpv4ReservationAddress, dhcpv4Subnet.id)
			);

			// await keaClient.deleteDHCPv4Reservation(dhcpv4Subnet.id, dhcpv4ReservationAddress);
		}
	}

	console.log(await keaClient.listDHCPv4Leases());
	console.log(await keaClient.listDHCPv6Leases());
}
