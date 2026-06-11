import { getRuntimeEnv } from '$lib/server/env';

/*
search queries seem to be using jquery-bootgrid if you want more details on them.
*/

type OpnsenseMethod = 'GET' | 'POST';

type OpnsenseCreateObjectResponse =
	| { result: 'saved'; uuid: string }
	| { result: 'failed'; validations: Record<string, string> };

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

type DHCPSubnetResponse<T> = {
	rows: T[];
	rowCount: number;
	total: number;
	current: number;
};

type DHCPv4SubnetResponse = DHCPSubnetResponse<DHCPv4Subnet>;
type DHCPv6SubnetResponse = DHCPSubnetResponse<DHCPv6Subnet>;

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

async function parseResponse(response: Response) {
	const text = await response.text();
	if (!text) return null;

	try {
		return JSON.parse(text) as unknown;
	} catch {
		return text;
	}
}

async function opnsenseRequest<T>(
	route: string,
	method: OpnsenseMethod,
	data?: unknown
): Promise<T | null> {
	const config = getOpnsenseConfig();
	if (!config) return null;

	const response = await fetch(`${config.apiUrl}${route}`, {
		headers: {
			Authorization:
				'Basic ' + Buffer.from(config.apiKey + ':' + config.apiSecret).toString('base64'),
			'Content-Type': 'application/json',
			Accept: 'application/json, text/javascript'
		},
		method,
		...(data === undefined ? {} : { body: JSON.stringify(data) })
	});

	const body = await parseResponse(response);
	if (!response.ok) {
		console.error(data);
		throw new OpnsenseError(`Opnsense ${method} ${route} failed`, response.status, body);
	}

	return body as T;
}

/// DHCPv4

export async function createDHCPv4Reservation(
	subnet_uuid: string,
	address: string,
	macAddress: string
): Promise<OpnsenseCreateObjectResponse | null> {
	let data = await opnsenseRequest<OpnsenseCreateObjectResponse>(
		'/api/kea/dhcpv4/add_reservation/',
		'POST',
		{
			reservation: {
				subnet: subnet_uuid,
				ip_address: address,
				hw_address: macAddress,
				hostname: '',
				description: ''
			}
		}
	);

	// the webui also runs /api/kea/dhcpv4/set, but I am not sure what that actually does.
	await opnsenseRequest('/api/kea/service/reconfigure', 'POST', {});

	return data;
}

export async function deleteDHCPv4Reservation(uuid: string) {
	await opnsenseRequest('/api/kea/dhcpv4/del_reservation/' + uuid, 'POST', {});

	await opnsenseRequest('/api/kea/service/reconfigure', 'POST', {});
}

export async function getDHCPv4Reservations(page: number): Promise<DHCPv4SearchResponse> {
	let data = await opnsenseRequest('/api/kea/dhcpv4/search_reservation', 'POST', {
		current: page,
		rowCount: 50,
		sort: {}
	});

	return data as DHCPv4SearchResponse;
}

// this works via MAC or assigned address.
export async function getDHCPv4ReservationsByAddress(
	page: number,
	address: string
): Promise<DHCPv4SearchResponse> {
	let data = await opnsenseRequest('/api/kea/dhcpv4/search_reservation', 'POST', {
		current: page,
		rowCount: 50,
		searchPhrase: address,
		sort: {}
	});

	return data as DHCPv4SearchResponse;
}

export async function createDHCPv4Subnet(
	subnet: string
): Promise<OpnsenseCreateObjectResponse | null> {
	let body = await opnsenseRequest<OpnsenseCreateObjectResponse>(
		'/api/kea/dhcpv4/add_subnet/',
		'POST',
		{
			subnet4: { subnet }
		}
	);

	await opnsenseRequest('/api/kea/service/reconfigure', 'POST', {});

	return body;
}

export async function getDHCPv4Subnets(page: number): Promise<DHCPv4SubnetResponse | null> {
	return await opnsenseRequest<DHCPv4SubnetResponse>('/api/kea/dhcpv4/search_subnet', 'POST', {
		current: page,
		rowCount: 50,
		sort: {}
	});
}

export async function deleteDHCPv4Subnet(uuid: string) {
	await opnsenseRequest('/api/kea/dhcpv4/del_subnet/' + uuid, 'POST');

	await opnsenseRequest('/api/kea/service/reconfigure', 'POST', {});
}

// DHCPv6

export async function createDHCPv6Reservation(
	subnet_uuid: string,
	address: string,
	macAddress: string
): Promise<OpnsenseCreateObjectResponse | null> {
	let data = await opnsenseRequest<OpnsenseCreateObjectResponse>(
		'/api/kea/dhcpv6/add_reservation/',
		'POST',
		{
			reservation: {
				subnet: subnet_uuid,
				ip_address: address,
				hw_address: macAddress
				// there is also a duid option. I think in our case we likely just wanna use MAC, but we might need to add it.
			}
		}
	);

	await opnsenseRequest('/api/kea/service/reconfigure', 'POST', {});

	return data;
}

export async function deleteDHCPv6Reservation(uuid: string) {
	await opnsenseRequest('/api/kea/dhcpv6/del_reservation/' + uuid, 'POST', {});

	await opnsenseRequest('/api/kea/service/reconfigure', 'POST', {});
}

export async function getDHCPv6Reservations(page: number): Promise<DHCPv4SearchResponse> {
	let data = await opnsenseRequest('/api/kea/dhcpv6/search_reservation', 'POST', {
		current: page,
		rowCount: 50,
		sort: {}
	});

	return data as DHCPv4SearchResponse;
}

// this works via MAC or assigned address.
export async function getDHCPv6ReservationsByAddress(
	page: number,
	address: string
): Promise<DHCPv4SearchResponse> {
	let data = await opnsenseRequest('/api/kea/dhcpv6/search_reservation', 'POST', {
		current: page,
		rowCount: 50,
		searchPhrase: address,
		sort: {}
	});

	return data as DHCPv4SearchResponse;
}

export async function createDHCPv6Subnet(
	subnet: string,
	networkInterface: string
): Promise<OpnsenseCreateObjectResponse | null> {
	let body = await opnsenseRequest<OpnsenseCreateObjectResponse>(
		'/api/kea/dhcpv6/add_subnet/',
		'POST',
		{
			subnet6: { subnet, interface: networkInterface }
		}
	);

	await opnsenseRequest('/api/kea/service/reconfigure', 'POST', {});

	return body;
}

export async function getDHCPv6Subnets(page: number): Promise<DHCPv6SubnetResponse | null> {
	return await opnsenseRequest<DHCPv6SubnetResponse>('/api/kea/dhcpv6/search_subnet', 'POST', {
		current: page,
		rowCount: 50,
		sort: {}
	});
}

export async function deleteDHCPv6Subnet(uuid: string) {
	await opnsenseRequest('/api/kea/dhcpv6/del_subnet/' + uuid, 'POST');

	await opnsenseRequest('/api/kea/service/reconfigure', 'POST', {});
}

export async function testFunction() {
	//console.log(await createDHCPv6Subnet("2001:db8:2231:aaed::/64", "lan"))
	//console.log(await createDHCPv4Subnet("192.168.128.0/24"))

	//console.log(await getDHCPv6Subnets(1))
	//console.log(await getDHCPv4Subnets(1))

	let dhcpv6_subnets = await getDHCPv6Subnets(1);

	if (!dhcpv6_subnets) {
		return;
	}

	console.log(
		await createDHCPv6Reservation(
			dhcpv6_subnets.rows[0].uuid,
			'2001:db8:2231:aaed::2',
			'AB:CD:EF:AB:CD:EF'
		)
	);

	let dhcpv4_subnets = await getDHCPv4Subnets(1);

	if (!dhcpv4_subnets) {
		return;
	}

	console.log(
		await createDHCPv4Reservation(
			dhcpv4_subnets.rows[0].uuid,
			'192.168.128.120',
			'AB:CD:EF:AB:CD:EF'
		)
	);

	//let reservations = await getDHCPv4ReservationsByAddress('192.168.10.127');

	//if (reservations['rows'].length < 1) {
	//	return;
	//}

	//let reservation_uuid = reservations['rows'][0]['uuid'];

	//await deleteDHCPv4Reservation(reservation_uuid);

	//const subnets = await getDHCPv4Subnets()

	//console.log(await getDHCPv4Reservations())
	//console.log(deleteDHCPv4Reservation("1938f4d4-f623-4837-8241-211bd9065fa9"))
	//console.log(await createDHCPv4Reservation((subnets as any)['rows'][0]['uuid'], "192.168.10.2", "AB:CD:EF:AB:CD:E2"))
}
