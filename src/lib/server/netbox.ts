import { getRuntimeEnv } from '$lib/server/env';

/*
docs for how to get this working:

you need to make a site and cluster*/

async function netbox(route: String, method: String, data: any) {
	const env = getRuntimeEnv();

	const apiToken = env.NETBOX_API_TOKEN;
	const netboxAPIURL = env.NETBOX_API_URL;

	const response = await fetch(`${netboxAPIURL}${route}`, {
		headers: {
			Authorization: `Bearer ${apiToken}`,
			'Content-Type': 'application/json'
		},
		method: method,
		body: JSON.stringify(data)
	});

	let res_body: any;
	try {
		res_body = await response.json();
	} catch {
		res_body = await response.text();
	}

	return res_body;
}

export async function setupVMIPAM() {
	// todo: get these from db
	const ipv4_address = '135.17.80.85';
	const vmid = '01KRA74DC5GA63Y8QE9RNTWBT5';
	const mac_address = 'aa:bb:cc:11:22:35';
	const ipv6_block = '';

	let vm_create = await netbox('/api/virtualization/virtual-machines/', 'POST', {
		name: vmid,
		status: 'offline',
		site: 1,
		cluster: 1,
		vcpus: 2,
		memory: 8,
		disk: 60,
		description: 'should work'
	});

	console.log('vm_create');
	console.log(vm_create);

	let vm_interface_create = await netbox('/api/virtualization/interfaces/', 'POST', {
		virtual_machine: vm_create.id,
		name: 'interface1'
	});

	console.log('vm_interface_create');
	console.log(vm_interface_create);

	let mac_address_create = await netbox('/api/dcim/mac-addresses/', 'POST', {
		mac_address: mac_address,
		assigned_object_type: 'virtualization.vminterface',
		assigned_object_id: vm_interface_create.id
	});

	console.log('mac_address_create');
	console.log(mac_address_create);

	let ip_address_create = await netbox('/api/ipam/ip-addresses/', 'POST', {
		address: ipv4_address,
		assigned_object_type: 'virtualization.vminterface',
		assigned_object_id: vm_interface_create.id
	});

	console.log('ip_address_create');
	console.log(ip_address_create);

	let vm_interface_patch_add_mac = await netbox('/api/virtualization/interfaces/', 'PATCH', [
		{
			id: vm_interface_create.id,
			primary_mac_address: mac_address_create.id
		}
	]);

	console.log('vm_interface_patch_add_mac');
	console.log(vm_interface_patch_add_mac);
}
