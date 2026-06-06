import { getRuntimeEnv } from '$lib/server/env';

type OpnsenseMethod = 'GET' | 'POST';

type CreateVMIPMappingParams = {
	macAddress: string;
  ipv4Addresses: string[];
	ipv6Addresses: string[];
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
		apiUrl: env.OPNSENSE_API_URL.replace(/\/+$/, ''),
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

async function opnsenseRequest<T>(route: string, method: OpnsenseMethod, data?: unknown): Promise<T | null> {
	const config = getOpnsenseConfig();
	if (!config) return null;

	const response = await fetch(`${config.apiUrl}${route}`, {
		headers: {
			'Authorization': 'Basic ' + Buffer.from(config.apiKey + ":" + config.apiSecret).toString('base64'),
      'Content-Type': 'application/json',
			'Accept': 'application/json, text/javascript',
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



async function getAvaliableLocalIPv4() {
  // todo
  return "192.168.1.50"
}

async function getAvaliableLocalIPv6() {
  // todo
  return ""
}

async function assignLocalIPToMacAddress(localIP: string, macAddress: string) {
  // todo: subnet needs to be configurable
  // kea has subnets that contain localIPs. We need to include the subnet for the specific localIP.
  // you can get the subnets that exist by running
  // await opnsenseRequest("/api/kea/dhcpv4/search_subnet", "POST", {"current":1,"rowCount":50,"sort":{}})

  await opnsenseRequest(
    "/api/kea/dhcpv4/add_reservation/",
    "POST",
    {
      reservation: {
        subnet: 'a04e9b27-d84e-43c1-bfca-31a1268d1eb2',
        ip_address: localIP,
        hw_address: macAddress,
        hostname: '',
        description: ''
      }
    }
  )

  // the webui also runs /api/kea/dhcpv4/set, but I am not sure what that actually does.
  await opnsenseRequest(
    "/api/kea/service/reconfigure",
    "POST",
    {}
  )
}

async function createVirtualIP(ipAddress: string) {
  await opnsenseRequest(
    "/api/interfaces/vip_settings/add_item/",
    "POST",
    {
      "vip": {
        "mode": "ipalias",
        "interface": "wan",
        "network": ipAddress+"/32",
      }
    }
  )

  await opnsenseRequest(
    "/api/interfaces/vip_settings/reconfigure",
    "POST",
    {}
  )
}

async function createOneToOneNAT(externalIP: string, internalIP: string) {
  await opnsenseRequest(
    "/api/firewall/one_to_one/add_rule/",
    "POST",
    {
      "rule":
      {
        "enabled": "1",
        "sequence": "100",
        "categories": "",
        "description": "",
        "interface": "wan",
        "type": "binat",
        "external": externalIP,
        "source_not": "0",
        "source_net": internalIP,
        "destination_not": "0",
        "destination_net": "any",
        "log": "0",
        "natreflection": ""
      }
    }
  )

  await opnsenseRequest(
    "/api/firewall/one_to_one/apply",
    "POST",
    {}
  )
}

async function createAllowFirewallRule(ipAddress: string) {
  await opnsenseRequest(
    "/api/firewall/filter/add_rule/",
    "POST",
    {"rule":{"enabled":"1","sequence":"100","categories":"","nosync":"0","description":"","interfacenot":"0","interface":"","quick":"1","action":"pass","allowopts":"0","direction":"in","ipprotocol":"inet","protocol":"any","icmptype":"","icmp6type":"","source_not":"0","source_net":"any","source_port":"","destination_not":"0","destination_net":ipAddress,"destination_port":"","log":"0","tcpflags1":"","tcpflags2":"","tcpflags_any":"0","sched":"","divert-to":"","statetype":"keep","state-policy":"","nopfsync":"0","statetimeout":"","udp-first":"","udp-single":"","udp-multiple":"","adaptivestart":"","adaptiveend":"","max":"","max-src-nodes":"","max-src-states":"","max-src-conn":"","max-src-conn-rate":"","max-src-conn-rates":"","overload":"","shaper1":"","shaper2":"","gateway":"","disablereplyto":"0","replyto":"","prio":"","set-prio":"","set-prio-low":"","tos":"","tag":"","tagged":""}}
  )



  await opnsenseRequest(
    "/api/firewall/filter/apply",
    "POST",
    {}
  )
}


async function createVMToIPMapping({
	macAddress,
  ipv4Addresses,
	ipv6Addresses
}: CreateVMIPMappingParams) {
  // todo: determine way to automatically determine local IP assignment
  const localIPv4 = await getAvaliableLocalIPv4()
  const localIPv6 = await getAvaliableLocalIPv6() // todo: should this just use SLAAC?

  const promises = []

  promises.push(assignLocalIPToMacAddress(localIPv4, macAddress))


  for (const ipv4Address of ipv4Addresses) {
    promises.push(assignPublicIPv4ToLocalIPv4(ipv4Address, localIPv4))
  }

  for (const ipv6Address of ipv6Addresses) {
    promises.push(assignPublicIPv6ToLocalIPv6(ipv6Address, localIPv6))
  }

  await Promise.all(promises)
}

async function assignPublicIPv4ToLocalIPv4(externalIPv4: string, localIPv4: string) {
  await Promise.all([
    createVirtualIP(externalIPv4 + "/32"),
    createOneToOneNAT(externalIPv4, localIPv4),
    createAllowFirewallRule(externalIPv4)
  ])
}

async function removePublicIPv4Assignment(externalIPv4: string, localIPv4: string) {
  // todo
}

async function removeLocalIPToMacAssignment(externalIPv4: string, localIPv4: string) {
  // todo
}


async function assignPublicIPv6ToLocalIPv6(externalIPv6: string, localIPv6: string) {
  // todo
}

async function removePublicIPv6Assignment(externalIPv4: string, localIPv4: string) {
  // todo
}
