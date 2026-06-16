import { getRuntimeEnv } from '$lib/server/env';
import ky, { type KyInstance } from 'ky';
import { Agent } from 'undici';

/*
search queries seem to be using jquery-bootgrid if you want more details on them.
*/

type OpnsenseCreateObjectResponse =
	| { result: 'saved'; uuid: string }
	| { result: 'failed'; validations: Record<string, string> };

type OpnsenseCommandResponse = {
	result?: string;
	status?: string;
};

type DHCPv4Subnet = {
	uuid: string;
	subnet: string;
	next_server: string;
	option_data_autocollect: string;
	'option_data.domain_name_servers': string;
	'option_data.domain_search': string;
	'option_data.routers': string;
	'option_data.static_routes': string;
	'option_data.classless_static_route': string;
	'option_data.domain_name': string;
	'option_data.ntp_servers': string;
	'option_data.time_servers': string;
	'option_data.tftp_server_name': string;
	'option_data.boot_file_name': string;
	'option_data.v6_only_preferred': string;
	'option_data.v4_dnr': string;
	option: string;
	'match-client-id': string;
	pools: string;
	ddns_forward_zone: string;
	ddns_qualifying_suffix: string;
	ddns_dns_server: string;
	ddns_domain_key_name: string;
	ddns_domain_key_secret: string;
	ddns_domain_key_algorithm: string;
	description: string;
};

type DHCPv6Subnet = {
	uuid: string;
	subnet: string;
	allocator: string;
	'pd-allocator': string;
	'option_data.dns_servers': string;
	'option_data.domain_search': string;
	'option_data.v6_dnr': string;
	option: string;
	pools: string;
	interface: string;
	'%interface': string;
	ddns_forward_zone: string;
	ddns_qualifying_suffix: string;
	ddns_dns_server: string;
	ddns_domain_key_name: string;
	ddns_domain_key_secret: string;
	ddns_domain_key_algorithm: string;
	description: string;
};

type OpnsenseInterfaceRow = {
	identifier?: string;
	description?: string;
	device?: string;
	addr4?: string;
	addr6?: string;
	routes?: string[];
	gateways?: string[];
	ipv4?: { ipaddr?: string; subnetbits?: number }[];
	ipv6?: { ipaddr?: string; subnetbits?: number }[];
	config?: {
		identifier?: string;
		ipaddr?: string;
		subnet?: string;
		ipaddrv6?: string;
		subnetv6?: string;
	};
};

type InterfacesInfoResponse = {
	rows: OpnsenseInterfaceRow[];
	rowCount: number;
	total: number;
	current: number;
};

type DHCPSubnetResponse<T> = {
	rows: T[];
	rowCount: number;
	total: number;
	current: number;
};

type DHCPv4SubnetResponse = DHCPSubnetResponse<DHCPv4Subnet>;
type DHCPv6SubnetResponse = DHCPSubnetResponse<DHCPv6Subnet>;

type DHCPv4Lease = {
	address: string;
	prefix_len: number;
	type: string;
	hwaddr: string;
	duid: string;
	client_id: string;
	iaid: string;
	valid_lifetime: number;
	expire: number;
	hostname: string;
	state: number;
	if: string;
	if_descr: string;
	is_reserved: string[];
	if_name: string;
	mac_info: string;
};

type DHCPv4LeaseSearchResponse = {
	rows: DHCPv4Lease[];
	rowCount: number;
	total: number;
	current: number;
	interfaces: Record<string, string>;
};

type DHCPv6Lease = {
	address: string;
	prefix_len: number;
	type: string;
	hwaddr: string;
	client_id: string;
	duid: string;
	iaid: number;
	valid_lifetime: number;
	expire: number;
	hostname: string;
	state: number;
	if: string | null;
	if_descr: string;
	is_reserved: string[];
	if_name: string;
	mac_info: string;
};

type DHCPv6LeaseSearchResponse = {
	rows: DHCPv6Lease[];
	rowCount: number;
	total: number;
	current: number;
	interfaces: Record<string, string>;
};

type CreateVMIPMappingParams = {
	macAddress: string;
	ipv4Addresses: string[];
	ipv6Addresses: string[];
};

type DHCPv4Reservation = {
	uuid: string;
	subnet: string;
	// Note: Keys with special characters (dots, spaces, percent) must be quoted
	'%subnet': string;
	ip_address: string;
	hw_address: string;
	hostname: string;
	description: string;

	// Flattened option data fields
	'option_data.domain_name_servers': string;
	'option_data.domain_search': string;
	'option_data.routers': string;
	'option_data.static_routes': string;
	'option_data.classless_static_route': string;
	'option_data.domain_name': string;
	'option_data.ntp_servers': string;
	'option_data.time_servers': string;
	'option_data.tftp_server_name': string;
	'option_data.boot_file_name': string;

	option: string;
};

type DHCPv4SearchResponse = {
	rows: DHCPv4Reservation[];
	rowCount: number;
	total: number;
	current: number;
};

type DHCPv6Reservation = {
	uuid: string;
	subnet: string;
	// Note: Keys with special characters (dots, spaces, percent) must be quoted
	'%subnet': string;
	ip_address: string;
	duid: string;
	hw_address: string;
	hostname: string;
	domain_search: string;
	option: string;
	description: string;
};

type DHCPv6ReservationResponse = {
	rows: DHCPv6Reservation[];
	rowCount: number;
	total: number;
	current: number;
};

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

	private async applyKeaChanges() {
		await this.api.post('/api/kea/service/reconfigure', { json: {} });
	}

	async deleteDHCPv4Lease(address: string): Promise<OpnsenseCommandResponse | null> {
		if (!address) return null;

		return await this.api
			.post<OpnsenseCommandResponse>(`/api/kea/leases4/del_lease/${encodeURIComponent(address)}`, {
				json: {}
			})
			.json();
	}

	async deleteDHCPv6Lease(address: string): Promise<OpnsenseCommandResponse | null> {
		if (!address) return null;

		return await this.api
			.post<OpnsenseCommandResponse>(`/api/kea/leases6/del_lease/${encodeURIComponent(address)}`, {
				json: {}
			})
			.json();
	}

	/// DHCPv4

	async createDHCPv4Reservation(
		subnet_uuid: string,
		address: string,
		macAddress: string
	): Promise<OpnsenseCreateObjectResponse | null> {
		let data = await this.api
			.post<OpnsenseCreateObjectResponse>('/api/kea/dhcpv4/add_reservation/', {
				json: {
					reservation: {
						subnet: subnet_uuid,
						ip_address: address,
						hw_address: macAddress,
						hostname: '',
						description: ''
					}
				}
			})
			.json();

		if (data?.result == 'failed') {
			throw new OpnsenseError('Kea add_reservation request failed.', 500, data.validations);
		}

		await this.applyKeaChanges();

		return data;
	}

	async deleteDHCPv4Reservation(uuid: string) {
		await this.api.post('/api/kea/dhcpv4/del_reservation/' + uuid, { json: {} });

		await this.applyKeaChanges();
	}

	async getDHCPv4Reservations(page: number): Promise<DHCPv4SearchResponse | null> {
		return await this.api
			.post<DHCPv4SearchResponse>('/api/kea/dhcpv4/search_reservation', {
				json: {
					current: page,
					rowCount: 50,
					sort: {}
				}
			})
			.json();
	}

	// this works via MAC or assigned address.
	async getDHCPv4ReservationsByAddress(
		page: number,
		address: string
	): Promise<DHCPv4SearchResponse | null> {
		return await this.api
			.post<DHCPv4SearchResponse>('/api/kea/dhcpv4/search_reservation', {
				json: {
					current: page,
					rowCount: 50,
					searchPhrase: address,
					sort: {}
				}
			})
			.json();
	}

	async createDHCPv4Subnet(
		subnet: string,
		options: { gateway?: string | null; description?: string | null } = {}
	): Promise<OpnsenseCreateObjectResponse | null> {
		let body = await this.api
			.post<OpnsenseCreateObjectResponse>('/api/kea/dhcpv4/add_subnet/', {
				json: {
					subnet4: {
						subnet,
						...(options.gateway ? { option_data: { routers: options.gateway } } : {}),
						...(options.description ? { description: options.description } : {})
					}
				}
			})
			.json();

		if (body?.result == 'failed') {
			throw new OpnsenseError('Kea add_subnet request failed.', 500, body.validations);
		}

		await this.applyKeaChanges();

		return body;
	}

	async getDHCPv4Subnets(page: number): Promise<DHCPv4SubnetResponse | null> {
		return await this.api
			.post<DHCPv4SubnetResponse>('/api/kea/dhcpv4/search_subnet', {
				json: {
					current: page,
					rowCount: 50,
					sort: {}
				}
			})
			.json();
	}

	async listDHCPv4Subnets(): Promise<DHCPv4Subnet[]> {
		const firstPage = await this.api
			.post<DHCPv4SubnetResponse>('/api/kea/dhcpv4/search_subnet', {
				json: {
					current: 1,
					rowCount: 200,
					sort: {}
				}
			})
			.json();

		return firstPage.rows ?? [];
	}

	async deleteDHCPv4Subnet(uuid: string) {
		await this.api.post('/api/kea/dhcpv4/del_subnet/' + uuid);

		await this.applyKeaChanges();
	}

	async listDHCPv4Leases(): Promise<DHCPv4Lease[]> {
		const firstPage = await this.api
			.post<DHCPv4LeaseSearchResponse>('/api/kea/leases4/search/', {
				json: {
					current: 1,
					rowCount: 200,
					sort: {},
					selected_interfaces: []
				}
			})
			.json();

		return firstPage.rows ?? [];
	}

	// DHCPv6

	async createDHCPv6Reservation(
		subnet_uuid: string,
		address: string,
		prefix: string | null,
		macAddress: string
	): Promise<OpnsenseCreateObjectResponse | null> {
		const json_data = {
			reservation: {
				subnet: subnet_uuid,
				ip_address: address,
				hw_address: macAddress,
				...(prefix ? { prefix } : {})
				// there is also a duid option. In our case we should just use MAC, but it is an option if needed.
			}
		};

		console.log('createDHCPv6Reservation JSON_DATA');
		console.log(json_data);
		let data = await this.api
			.post<OpnsenseCreateObjectResponse>('/api/kea/dhcpv6/add_reservation/', {
				json: json_data
			})
			.json();

		if (data?.result == 'failed') {
			throw new OpnsenseError('Kea add_reservation request failed.', 500, data.validations);
		}

		await this.applyKeaChanges();

		return data;
	}

	async deleteDHCPv6Reservation(uuid: string) {
		await this.api.post('/api/kea/dhcpv6/del_reservation/' + uuid, { json: {} });

		await this.applyKeaChanges();
	}

	async getDHCPv6Reservations(page: number): Promise<DHCPv6ReservationResponse | null> {
		return await this.api
			.post<DHCPv6ReservationResponse>('/api/kea/dhcpv6/search_reservation', {
				json: {
					current: page,
					rowCount: 50,
					sort: {}
				}
			})
			.json();
	}

	// this works via MAC or assigned address.
	async getDHCPv6ReservationsByAddress(
		page: number,
		address: string
	): Promise<DHCPv6ReservationResponse | null> {
		return await this.api
			.post<DHCPv6ReservationResponse>('/api/kea/dhcpv6/search_reservation', {
				json: {
					current: page,
					rowCount: 50,
					searchPhrase: address,
					sort: {}
				}
			})
			.json();
	}

	async createDHCPv6Subnet(
		subnet: string,
		networkInterface: string
	): Promise<OpnsenseCreateObjectResponse | null> {
		let body = await this.api
			.post<OpnsenseCreateObjectResponse>('/api/kea/dhcpv6/add_subnet/', {
				json: {
					subnet6: { subnet, interface: networkInterface }
				}
			})
			.json();

		await this.applyKeaChanges();

		return body;
	}

	async getDHCPv6Subnets(page: number): Promise<DHCPv6SubnetResponse | null> {
		return await this.api
			.post<DHCPv6SubnetResponse>('/api/kea/dhcpv6/search_subnet', {
				json: {
					current: page,
					rowCount: 50,
					sort: {}
				}
			})
			.json();
	}

	async listDHCPv6Subnets(): Promise<DHCPv6Subnet[]> {
		const firstPage = await this.api
			.post<DHCPv6SubnetResponse>('/api/kea/dhcpv6/search_subnet', {
				json: {
					current: 1,
					rowCount: 200,
					sort: {}
				}
			})
			.json();

		return firstPage.rows ?? [];
	}

	async deleteDHCPv6Subnet(uuid: string) {
		await this.api.post('/api/kea/dhcpv6/del_subnet/' + uuid);

		await this.applyKeaChanges();
	}

	async listInterfaces(): Promise<OpnsenseInterfaceRow[]> {
		const response = await this.api
			.get<InterfacesInfoResponse>('/api/interfaces/overview/interfaces_info?details=1')
			.json();

		return response.rows ?? [];
	}

	async listDHCPv6Leases(): Promise<DHCPv6Lease[]> {
		const firstPage = await this.api
			.post<DHCPv6LeaseSearchResponse>('/api/kea/leases6/search/', {
				json: {
					current: 1,
					rowCount: 200,
					sort: {},
					selected_interfaces: []
				}
			})
			.json();

		return firstPage.rows ?? [];
	}
}

// this code is intentionally dead. it should be turned into proper test cases, but caleb needed it to verify the implementation worked.
async function testFunction() {
	console.log('running test function');
	const opnsenseClient = new OpnsenseClient();

	const dhcpv6_subnet_res = await opnsenseClient.createDHCPv6Subnet(
		'2001:db8:2231:aaed::/64',
		'lan'
	);

	console.log(dhcpv6_subnet_res);

	if (dhcpv6_subnet_res?.result != 'saved') {
		return;
	}

	const ipv6_subnet_uuid = dhcpv6_subnet_res.uuid;

	let dhcpv6_reservation_res = await opnsenseClient.createDHCPv6Reservation(
		ipv6_subnet_uuid,
		'2001:db8:2231:aaed::1',
		'2001:db8:2231:aaed::/64',
		'AB:CD:EF:AB:CD:E4'
	);

	console.log(dhcpv6_reservation_res);

	if (dhcpv6_reservation_res?.result != 'saved') {
		return;
	}

	const ipv6_reservation_uuid = dhcpv6_reservation_res.uuid;

	console.log(ipv6_reservation_uuid);

	console.log(await opnsenseClient.getDHCPv6Reservations(1));

	console.log(await opnsenseClient.getDHCPv6ReservationsByAddress(1, 'AB:CD:EF'));

	console.log(await opnsenseClient.getDHCPv6Subnets(1));

	//opnsenseClient.deleteDHCPv6Reservation(ipv6_reservation_uuid)

	//opnsenseClient.deleteDHCPv6Subnet(ipv6_subnet_uuid)

	const dhcpv4_subnet_res = await opnsenseClient.createDHCPv4Subnet('192.168.128.0/24');

	console.log(dhcpv4_subnet_res);

	if (dhcpv4_subnet_res?.result != 'saved') {
		return;
	}

	const ipv4_subnet_uuid = dhcpv4_subnet_res.uuid;

	const dhcpv4_reservation_res = await opnsenseClient.createDHCPv4Reservation(
		ipv4_subnet_uuid,
		'192.168.128.120',
		'AB:CD:EF:AB:CD:E2'
	);

	console.log(dhcpv4_reservation_res);

	if (dhcpv4_reservation_res?.result != 'saved') {
		return;
	}

	const ipv4_reservation_uuid = dhcpv4_reservation_res.uuid;

	console.log(ipv4_reservation_uuid);

	console.log(await opnsenseClient.getDHCPv4Reservations(1));

	console.log(await opnsenseClient.getDHCPv4ReservationsByAddress(1, 'AB:CD:EF'));

	console.log(await opnsenseClient.getDHCPv4Subnets(1));

	//opnsenseClient.deleteDHCPv4Reservation(ipv4_reservation_uuid);

	//opnsenseClient.deleteDHCPv4Subnet(ipv4_subnet_uuid);

	console.log(await opnsenseClient.listDHCPv4Leases());
	console.log(await opnsenseClient.listDHCPv6Leases());
}
