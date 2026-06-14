import { error } from '@sveltejs/kit';
import { Address4, Address6 } from 'ip-address';
import { and, asc, eq } from 'drizzle-orm';
import { initDrizzle } from '$lib/server/db';
import { ipamAllocations, ipamPrefixes } from '$lib/server/db/schema';
import { isOpnsenseConfigured, OpnsenseClient } from '$lib/server/opnsense';

export type IpFamily = 'ipv4' | 'ipv6';
export type VmNetworkingMode = 'both' | 'ipv6';

type Db = ReturnType<typeof initDrizzle>;
type Transaction = Parameters<Parameters<Db['transaction']>[0]>[0];
type QueryableDb = Db | Transaction;

type IpamPrefix = typeof ipamPrefixes.$inferSelect;
type IpamAllocation = typeof ipamAllocations.$inferSelect;

export type IpamPrefixInput = {
	name: string;
	cidr: string;
	gateway?: string | null;
	disabled?: boolean;
};

type ResolveOpnsensePrefixOptions = {
	createMissingDhcpv4Subnet?: boolean;
};

export type IpamPrefixWithStats = IpamPrefix & {
	allocated: number;
	capacity: string;
	available: string;
	hasCapacity: boolean;
};

export type IpamAvailability = {
	ipv4: { available: boolean; availableCount: string };
	ipv6: { available: boolean; availableCount: string };
};

type AddressRange = {
	family: IpFamily;
	start: bigint;
	end: bigint;
	prefixLength: number;
};

type PendingAllocation = IpamAllocation & {
	sourcePrefix: IpamPrefix;
};

const v6Bits = 128;
const vmIpv4PrefixLength = 32;
const vmIpv6PrefixLength = 64;

function uniqueViolation(err: unknown) {
	return (
		typeof err === 'object' &&
		err !== null &&
		'code' in err &&
		(err as { code?: unknown }).code === '23505'
	);
}

export function generateMacAddress() {
	const bytes = crypto.getRandomValues(new Uint8Array(6));
	bytes[0] = (bytes[0] & 0xfe) | 0x02;

	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0').toUpperCase()).join(':');
}

function parseCidr(cidr: string): AddressRange {
	if (Address4.isValid(cidr)) {
		const address = new Address4(cidr);
		return {
			family: 'ipv4',
			start: address.startAddress().bigInt(),
			end: address.endAddress().bigInt(),
			prefixLength: address.subnetMask
		};
	}

	if (Address6.isValid(cidr)) {
		const address = new Address6(cidr);
		return {
			family: 'ipv6',
			start: address.startAddress().bigInt(),
			end: address.endAddress().bigInt(),
			prefixLength: address.subnetMask
		};
	}

	error(400, `Invalid IP prefix "${cidr}"`);
}

function normalizeCidr(cidr: string) {
	if (Address4.isValid(cidr)) {
		const address = new Address4(cidr);
		return {
			cidr: address.networkForm(),
			family: 'ipv4' as const,
			prefixLength: address.subnetMask
		};
	}

	if (Address6.isValid(cidr)) {
		const address = new Address6(cidr);
		return {
			cidr: address.networkForm(),
			family: 'ipv6' as const,
			prefixLength: address.subnetMask
		};
	}

	error(400, `Invalid IP prefix "${cidr}"`);
}

function parseAddress(family: IpFamily, value: string) {
	if (family === 'ipv4') {
		if (!Address4.isValid(value)) error(400, `Invalid IPv4 address "${value}"`);
		return new Address4(value).bigInt();
	}

	if (!Address6.isValid(value)) error(400, `Invalid IPv6 address "${value}"`);
	return new Address6(value).bigInt();
}

function isCidrInside(parent: string, child: string) {
	const parentRange = parseCidr(parent);
	const childRange = parseCidr(child);

	return (
		parentRange.family === childRange.family &&
		childRange.start >= parentRange.start &&
		childRange.end <= parentRange.end
	);
}

function formatAddress(family: IpFamily, value: bigint) {
	return family === 'ipv4'
		? Address4.fromBigInt(value).correctForm()
		: Address6.fromBigInt(value).correctForm();
}

function formatPrefix(family: IpFamily, value: bigint, prefixLength: number) {
	return `${formatAddress(family, value)}/${prefixLength}`;
}

export function normalizeIpamPrefixInput(input: IpamPrefixInput) {
	const normalized = normalizeCidr(input.cidr.trim());
	const vmPrefixLength = normalized.family === 'ipv4' ? vmIpv4PrefixLength : vmIpv6PrefixLength;
	if (normalized.prefixLength > vmPrefixLength) {
		error(400, `${normalized.family} prefix is too small for VM allocations`);
	}

	const gateway = input.gateway?.trim() || null;
	if (gateway) {
		const gatewayValue = parseAddress(normalized.family, gateway);
		const range = parseCidr(normalized.cidr);
		if (gatewayValue < range.start || gatewayValue > range.end) {
			error(400, 'Gateway must be inside the prefix');
		}
	}

	return {
		name: input.name.trim(),
		cidr: normalized.cidr,
		family: normalized.family,
		gateway,
		disabled: input.disabled ?? false
	};
}

function interfaceCidrs(row: Awaited<ReturnType<OpnsenseClient['listInterfaces']>>[number]) {
	const cidrs = new Set<string>();

	for (const route of row.routes ?? []) {
		if (Address4.isValid(route)) cidrs.add(new Address4(route).networkForm());
		if (Address6.isValid(route)) cidrs.add(new Address6(route).networkForm());
	}

	if (row.addr4 && Address4.isValid(row.addr4)) cidrs.add(new Address4(row.addr4).networkForm());
	if (row.addr6 && Address6.isValid(row.addr6)) cidrs.add(new Address6(row.addr6).networkForm());

	for (const address of row.ipv4 ?? []) {
		if (address.ipaddr && Address4.isValid(address.ipaddr)) {
			cidrs.add(new Address4(address.ipaddr).networkForm());
		}
	}

	for (const address of row.ipv6 ?? []) {
		const cidr =
			address.ipaddr && address.subnetbits
				? `${address.ipaddr}/${address.subnetbits}`
				: address.ipaddr;
		if (cidr && Address6.isValid(cidr)) cidrs.add(new Address6(cidr).networkForm());
	}

	if (row.config?.ipaddr && row.config.subnet) {
		const cidr = `${row.config.ipaddr}/${row.config.subnet}`;
		if (Address4.isValid(cidr)) cidrs.add(new Address4(cidr).networkForm());
	}

	if (row.config?.ipaddrv6 && row.config.subnetv6) {
		const cidr = `${row.config.ipaddrv6}/${row.config.subnetv6}`;
		if (Address6.isValid(cidr)) cidrs.add(new Address6(cidr).networkForm());
	}

	return Array.from(cidrs);
}

export async function resolveOpnsensePrefixFields(
	prefix: ReturnType<typeof normalizeIpamPrefixInput>,
	options: ResolveOpnsensePrefixOptions = {}
) {
	if (!isOpnsenseConfigured()) {
		if (options.createMissingDhcpv4Subnet) error(400, 'OPNsense is not configured');

		return {
			...prefix,
			opnsenseSubnetUuid: null,
			opnsenseInterface: null
		};
	}

	const client = new OpnsenseClient();

	if (prefix.family === 'ipv4') {
		const subnets = await client.listDHCPv4Subnets();
		const subnet = subnets.find((item) => {
			const cidr = normalizeCidr(item.subnet).cidr;
			return cidr === prefix.cidr || isCidrInside(cidr, prefix.cidr);
		});
		let opnsenseSubnetUuid = subnet?.uuid ?? null;

		if (!opnsenseSubnetUuid && options.createMissingDhcpv4Subnet) {
			const created = await client.createDHCPv4Subnet(prefix.cidr, {
				gateway: prefix.gateway,
				description: prefix.name
			});
			if (created?.result !== 'saved') error(502, 'Failed to create OPNsense DHCPv4 subnet');
			opnsenseSubnetUuid = created.uuid;
		}

		return {
			...prefix,
			gateway: prefix.gateway ?? subnet?.['option_data.routers']?.split(',')[0]?.trim() ?? null,
			opnsenseSubnetUuid,
			opnsenseInterface: null
		};
	}

	const dhcpv6Subnets = await client.listDHCPv6Subnets();
	const matchingSubnet = dhcpv6Subnets.find((item) => {
		const cidr = normalizeCidr(item.subnet).cidr;
		return cidr === prefix.cidr || isCidrInside(cidr, prefix.cidr);
	});
	if (matchingSubnet?.interface) {
		return {
			...prefix,
			opnsenseSubnetUuid: matchingSubnet.uuid,
			opnsenseInterface: matchingSubnet.interface
		};
	}

	const interfaces = await client.listInterfaces();
	const matches = interfaces.filter((row) => {
		const identifier = row.identifier ?? row.config?.identifier;
		if (!identifier) return false;

		return interfaceCidrs(row).some(
			(cidr) => cidr === prefix.cidr || isCidrInside(cidr, prefix.cidr)
		);
	});

	if (matches.length === 0) error(400, `No matching OPNsense interface found for ${prefix.cidr}`);
	if (matches.length > 1) {
		error(
			400,
			`Multiple OPNsense interfaces match ${prefix.cidr}: ${matches
				.map((row) => row.identifier ?? row.config?.identifier)
				.join(', ')}`
		);
	}

	return {
		...prefix,
		opnsenseSubnetUuid: matchingSubnet?.uuid ?? null,
		opnsenseInterface: matches[0].identifier ?? matches[0].config?.identifier ?? null
	};
}

function prefixCanAllocate(prefix: IpamPrefix) {
	if (prefix.disabled) return false;
	if (!isOpnsenseConfigured()) return true;
	if (prefix.family === 'ipv4') return Boolean(prefix.opnsenseSubnetUuid);
	return Boolean(prefix.opnsenseInterface);
}

function ipv4UsableRange(prefix: IpamPrefix) {
	const range = parseCidr(prefix.cidr);
	const excludesNetworkAndBroadcast = range.prefixLength < 31;
	const first = range.start + (excludesNetworkAndBroadcast ? 1n : 0n);
	const last = range.end - (excludesNetworkAndBroadcast ? 1n : 0n);

	return first <= last ? { first, last } : null;
}

function prefixCapacity(prefix: IpamPrefix) {
	const range = parseCidr(prefix.cidr);

	if (prefix.family === 'ipv4') {
		const usable = ipv4UsableRange(prefix);
		if (!usable) return 0n;
		const gateway = prefix.gateway ? parseAddress('ipv4', prefix.gateway) : usable.first;
		const gatewayIsUsable = gateway >= usable.first && gateway <= usable.last;
		return usable.last - usable.first + 1n - (gatewayIsUsable ? 1n : 0n);
	}

	const childBits = BigInt(vmIpv6PrefixLength - range.prefixLength);
	return childBits >= 0n ? 1n << childBits : 0n;
}

function allocatedCount(
	prefix: IpamPrefix,
	allocations: Pick<IpamAllocation, 'address' | 'prefix'>[]
) {
	if (prefix.family === 'ipv4') {
		return BigInt(allocations.filter((allocation) => allocation.address).length);
	}

	return BigInt(allocations.filter((allocation) => allocation.prefix).length);
}

async function prefixStats(db: QueryableDb, prefix: IpamPrefix): Promise<IpamPrefixWithStats> {
	const allocations = await db.query.ipamAllocations.findMany({
		where: eq(ipamAllocations.ipamPrefixId, prefix.id),
		columns: { address: true, prefix: true }
	});
	const capacity = prefixCanAllocate(prefix) ? prefixCapacity(prefix) : 0n;
	const allocated = allocatedCount(prefix, allocations);
	const available = capacity > allocated ? capacity - allocated : 0n;

	return {
		...prefix,
		allocated: Number(allocated),
		capacity: capacity.toString(),
		available: available.toString(),
		hasCapacity: available > 0n
	};
}

export async function listIpamPrefixesWithStats(db: QueryableDb) {
	const prefixes = await db
		.select()
		.from(ipamPrefixes)
		.orderBy(asc(ipamPrefixes.family), asc(ipamPrefixes.cidr));

	return Promise.all(prefixes.map((prefix) => prefixStats(db, prefix)));
}

export async function getIpamAvailability(db: QueryableDb): Promise<IpamAvailability> {
	const prefixes = await listIpamPrefixesWithStats(db);
	const availableCount = (family: IpFamily) =>
		prefixes
			.filter((prefix) => prefix.family === family)
			.reduce((total, prefix) => total + BigInt(prefix.available), 0n);
	const ipv4 = availableCount('ipv4');
	const ipv6 = availableCount('ipv6');

	return {
		ipv4: { available: ipv4 > 0n, availableCount: ipv4.toString() },
		ipv6: { available: ipv6 > 0n, availableCount: ipv6.toString() }
	};
}

function nextIpv4Address(prefix: IpamPrefix, allocations: Pick<IpamAllocation, 'address'>[]) {
	const usable = ipv4UsableRange(prefix);
	if (!usable) return null;

	const used = new Set(
		allocations.flatMap((allocation) =>
			allocation.address ? [parseAddress('ipv4', allocation.address).toString()] : []
		)
	);
	const gateway = prefix.gateway ? parseAddress('ipv4', prefix.gateway) : usable.first;

	for (let value = usable.first; value <= usable.last; value++) {
		if (value === gateway || used.has(value.toString())) continue;
		return formatAddress('ipv4', value);
	}

	return null;
}

function nextIpv6Prefix(prefix: IpamPrefix, allocations: Pick<IpamAllocation, 'prefix'>[]) {
	const range = parseCidr(prefix.cidr);
	const prefixSize = 1n << BigInt(v6Bits - vmIpv6PrefixLength);
	const used = new Set(
		allocations.flatMap((allocation) =>
			allocation.prefix ? [new Address6(allocation.prefix).startAddress().bigInt().toString()] : []
		)
	);

	for (let value = range.start; value <= range.end; value += prefixSize) {
		if (value + prefixSize - 1n > range.end) return null;
		if (used.has(value.toString())) continue;

		return {
			prefix: formatPrefix('ipv6', value, vmIpv6PrefixLength),
			address: formatAddress('ipv6', value + 1n)
		};
	}

	return null;
}

async function createFamilyAllocation(
	db: QueryableDb,
	family: IpFamily,
	vmId: string,
	macAddress: string
): Promise<PendingAllocation> {
	const prefixes = await db
		.select()
		.from(ipamPrefixes)
		.where(and(eq(ipamPrefixes.family, family), eq(ipamPrefixes.disabled, false)))
		.orderBy(asc(ipamPrefixes.createdAt), asc(ipamPrefixes.cidr));

	for (const prefix of prefixes) {
		if (!prefixCanAllocate(prefix)) continue;

		const allocations = await db.query.ipamAllocations.findMany({
			where: eq(ipamAllocations.ipamPrefixId, prefix.id),
			columns: { address: true, prefix: true }
		});

		const next =
			family === 'ipv4'
				? { address: nextIpv4Address(prefix, allocations), prefix: null }
				: nextIpv6Prefix(prefix, allocations);

		if (!next?.address) continue;

		const [inserted] = await db
			.insert(ipamAllocations)
			.values({
				ipamPrefixId: prefix.id,
				associatedVmId: vmId,
				family,
				address: next.address,
				prefix: next.prefix,
				prefixLength: family === 'ipv4' ? vmIpv4PrefixLength : vmIpv6PrefixLength,
				macAddress
			})
			.returning();

		return { ...inserted, sourcePrefix: prefix };
	}

	error(409, `No available ${family === 'ipv4' ? 'IPv4 addresses' : 'IPv6 prefixes'}`);
}

async function createLocalAllocation(
	db: QueryableDb,
	family: IpFamily,
	vmId: string,
	macAddress: string
) {
	for (let attempt = 0; attempt < 5; attempt++) {
		try {
			return await createFamilyAllocation(db, family, vmId, macAddress);
		} catch (err) {
			if (uniqueViolation(err)) continue;
			throw err;
		}
	}

	error(409, `No available ${family === 'ipv4' ? 'IPv4 addresses' : 'IPv6 prefixes'}`);
}

async function syncOpnsenseAllocation(db: QueryableDb, allocation: PendingAllocation) {
	if (!isOpnsenseConfigured()) return allocation;

	const client = new OpnsenseClient();

	if (allocation.family === 'ipv4') {
		if (!allocation.sourcePrefix.opnsenseSubnetUuid) {
			error(400, `${allocation.sourcePrefix.cidr} is missing an OPNsense DHCPv4 subnet UUID`);
		}

		const reservation = await client.createDHCPv4Reservation(
			allocation.sourcePrefix.opnsenseSubnetUuid,
			allocation.address!,
			allocation.macAddress
		);

		await db
			.update(ipamAllocations)
			.set({
				opnsenseSubnetUuid: allocation.sourcePrefix.opnsenseSubnetUuid,
				opnsenseReservationUuid: reservation?.result === 'saved' ? reservation.uuid : null
			})
			.where(eq(ipamAllocations.id, allocation.id));

		return allocation;
  }

	if (!allocation.sourcePrefix.opnsenseSubnetUuid) {
		error(400, `${allocation.sourcePrefix.cidr} is missing an OPNsense DHCPv6 subnet UUID`);
	}

	if (!allocation.sourcePrefix.opnsenseInterface) {
		error(400, `${allocation.sourcePrefix.cidr} is missing an OPNsense IPv6 interface`);
	}

	const reservation = await client.createDHCPv6Reservation(
		allocation.sourcePrefix.opnsenseSubnetUuid,
		allocation.address!,
		allocation.prefix!,
		allocation.macAddress
	);

	await db
		.update(ipamAllocations)
		.set({
			opnsenseSubnetUuid: allocation.sourcePrefix.opnsenseSubnetUuid,
			opnsenseReservationUuid: reservation?.result === 'saved' ? reservation.uuid : null
		})
		.where(eq(ipamAllocations.id, allocation.id));

	return allocation;
}

export async function allocateVmNetworking(
	db: Db,
	params: { vmId: string; macAddress: string; mode: VmNetworkingMode }
) {
	const families: IpFamily[] = params.mode === 'both' ? ['ipv4', 'ipv6'] : ['ipv6'];
	const allocations: PendingAllocation[] = [];

	try {
		for (const family of families) {
			allocations.push(
				await db.transaction((tx) =>
					createLocalAllocation(tx, family, params.vmId, params.macAddress)
				)
			);
		}

		for (const allocation of allocations) {
			await syncOpnsenseAllocation(db, allocation);
		}

		return allocations;
	} catch (err) {
		await releaseVmNetworking(db, params.vmId, true).catch(() => {});
		throw err;
	}
}

export async function releaseVmNetworking(db: QueryableDb, vmId: string, bestEffort = false) {
	const allocations = await db.query.ipamAllocations.findMany({
		where: eq(ipamAllocations.associatedVmId, vmId)
	});

	if (isOpnsenseConfigured()) {
		const client = new OpnsenseClient();

		for (const allocation of allocations) {
			try {
				if (allocation.family === 'ipv4' && allocation.opnsenseReservationUuid) {
					await client.deleteDHCPv4Reservation(allocation.opnsenseReservationUuid);
				}

				if (allocation.family === 'ipv6' && allocation.opnsenseReservationUuid) {
					await client.deleteDHCPv6Reservation(allocation.opnsenseReservationUuid);
				}
			} catch (err) {
				if (!bestEffort) throw err;
				console.warn(`Failed to release ${allocation.family} allocation ${allocation.id}`, err);
			}
		}
	}

	await db.delete(ipamAllocations).where(eq(ipamAllocations.associatedVmId, vmId));
}
