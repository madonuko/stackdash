import { getRuntimeEnv } from '$lib/server/env';

type OpnsenseMethod = 'GET' | 'POST';

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

export async function createDHCPv4Reservation(address: string, macAddress: string) {
	// todo: subnet needs to be configurable
	// kea has subnets that contain localIPs. We need to include the subnet for the specific localIP.
	// you can get the subnets that exist by running
	// await opnsenseRequest("/api/kea/dhcpv4/search_subnet", "POST", {"current":1,"rowCount":50,"sort":{}})

	let data = await opnsenseRequest('/api/kea/dhcpv4/add_reservation/', 'POST', {
		reservation: {
			subnet: '1ae80d5f-7cb9-4bea-852c-bc3ad1fcd0df',
			ip_address: address,
			hw_address: macAddress,
			hostname: '',
			description: ''
		}
	});

	// the webui also runs /api/kea/dhcpv4/set, but I am not sure what that actually does.
	await opnsenseRequest('/api/kea/service/reconfigure', 'POST', {});

	return data;
}

export async function deleteDHCPv4Reservation(uuid: string) {
	console.log('deleting ' + uuid);
	await opnsenseRequest('/api/kea/dhcpv4/del_reservation/' + uuid, 'POST', {});

	await opnsenseRequest('/api/kea/service/reconfigure', 'POST', {});
	console.log('finished ' + uuid);
}

export async function getDHCPv4Reservations(): Promise<DHCPv4SearchResponse> {
	let data = await opnsenseRequest('/api/kea/dhcpv4/search_reservation', 'POST', {
		current: 1,
		rowCount: 50,
		sort: {}
	});

	return data as DHCPv4SearchResponse;
}

export async function getDHCPv4ReservationsByAddress(
	address: string
): Promise<DHCPv4SearchResponse> {
	let data = await opnsenseRequest('/api/kea/dhcpv4/search_reservation', 'POST', {
		current: 1,
		rowCount: 50,
		searchPhrase: address,
		sort: {}
	});

	return data as DHCPv4SearchResponse;
}

export async function testFunction() {
	let reservations = await getDHCPv4ReservationsByAddress('192.168.10.127');

	if (reservations['rows'].length < 1) {
		return;
	}

	let reservation_uuid = reservations['rows'][0]['uuid'];

	await deleteDHCPv4Reservation(reservation_uuid);

	//console.log(await getDHCPv4Reservations())
	//console.log(deleteDHCPv4Reservation("1938f4d4-f623-4837-8241-211bd9065fa9"))
	//console.log(await createDHCPv4Reservation("192.168.10.2", "AB:CD:EF:AB:CD:E2"))
}
