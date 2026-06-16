import { error } from '@sveltejs/kit';
import { Address4, Address6 } from 'ip-address';
import { and, asc, eq } from 'drizzle-orm';
import { initDrizzle } from '$lib/server/db';
import { ipamAllocations, ipamPrefixes } from '$lib/server/db/schema';
import { isKeaConfigured, KeaClient } from '$lib/server/kea';

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
	whitelistStart?: string | null;
	whitelistEnd?: string | null;
	disabled?: boolean;
	ipv6UseTransitAddress?: boolean;
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

type AllocationKind = 'ipv4' | 'ipv6-transit' | 'ipv6-prefix';

type DhcpLeaseUsage = {
	ipv4Addresses: Set<string>;
	ipv6Addresses: Set<string>;
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

function defaultWhitelistBounds(range: AddressRange) {
	if (range.family === 'ipv4') {
		const excludesNetworkAndBroadcast = range.prefixLength < 31;
		const first = range.start + (excludesNetworkAndBroadcast ? 1n : 0n);
		const last = range.end - (excludesNetworkAndBroadcast ? 1n : 0n);
		return first <= last ? { first, last } : { first: range.start, last: range.end };
	}

	return {
		first: range.start < range.end ? range.start + 1n : range.start,
		last: range.end
	};
}

export function normalizeIpamPrefixInput(input: IpamPrefixInput) {
	const normalized = normalizeCidr(input.cidr.trim());
	const ipv6UseTransitAddress =
		normalized.family === 'ipv6' && (input.ipv6UseTransitAddress ?? false);
	const vmPrefixLength =
		normalized.family === 'ipv4'
			? vmIpv4PrefixLength
			: ipv6UseTransitAddress
				? v6Bits
				: vmIpv6PrefixLength;
	if (normalized.prefixLength > vmPrefixLength) {
		error(400, `${normalized.family} prefix is too small for VM allocations`);
	}

	let whitelistStart = input.whitelistStart?.trim() || null;
	let whitelistEnd = input.whitelistEnd?.trim() || null;
	if (whitelistStart || whitelistEnd) {
		const range = parseCidr(normalized.cidr);
		const defaults = defaultWhitelistBounds(range);
		const startValue = whitelistStart
			? parseAddress(normalized.family, whitelistStart)
			: defaults.first;
		const endValue = whitelistEnd ? parseAddress(normalized.family, whitelistEnd) : defaults.last;
		if (startValue < range.start || startValue > range.end) {
			error(400, 'Whitelist start must be inside the prefix');
		}
		if (endValue < range.start || endValue > range.end) {
			error(400, 'Whitelist end must be inside the prefix');
		}
		if (startValue > endValue) {
			error(400, 'Whitelist start must be <= whitelist end');
		}

		whitelistStart = formatAddress(normalized.family, startValue);
		whitelistEnd = formatAddress(normalized.family, endValue);
	}

	return {
		name: input.name.trim(),
		cidr: normalized.cidr,
		family: normalized.family,
		ipv6UseTransitAddress,
		whitelistStart,
		whitelistEnd,
		disabled: input.disabled ?? false
	};
}

export async function resolveKeaPrefixFields(prefix: ReturnType<typeof normalizeIpamPrefixInput>) {
	if (!isKeaConfigured()) {
		return {
			...prefix,
			keaSubnetId: null,
			keaInterface: null
		};
	}

	const client = new KeaClient();

	if (prefix.family === 'ipv4') {
		const subnets = await client.listDHCPv4Subnets();
		const subnet = subnets.find((item) => {
			const cidr = normalizeCidr(item.subnet).cidr;
			return cidr === prefix.cidr || isCidrInside(cidr, prefix.cidr);
		});

		return {
			...prefix,
			keaSubnetId: subnet ? String(subnet.id) : null,
			keaInterface: null
		};
	}

	if (!prefix.ipv6UseTransitAddress) {
		return {
			...prefix,
			keaSubnetId: null,
			keaInterface: null
		};
	}

	const dhcpv6Subnets = await client.listDHCPv6Subnets();
	const matchingSubnet = dhcpv6Subnets.find((item) => {
		const cidr = normalizeCidr(item.subnet).cidr;
		return cidr === prefix.cidr || isCidrInside(cidr, prefix.cidr);
	});

	return {
		...prefix,
		keaSubnetId: matchingSubnet ? String(matchingSubnet.id) : null,
		keaInterface: matchingSubnet?.interface ?? null
	};
}

function prefixCanAllocate(prefix: IpamPrefix) {
	if (prefix.disabled) return false;
	if (!isKeaConfigured()) return true;
	if (prefix.family === 'ipv4') return Boolean(prefix.keaSubnetId);
	if (!prefix.ipv6UseTransitAddress) return true;
	return Boolean(prefix.keaSubnetId);
}

function ipv4UsableRange(prefix: IpamPrefix) {
	const range = parseCidr(prefix.cidr);
	const excludesNetworkAndBroadcast = range.prefixLength < 31;
	const first = range.start + (excludesNetworkAndBroadcast ? 1n : 0n);
	const last = range.end - (excludesNetworkAndBroadcast ? 1n : 0n);

	return first <= last ? { first, last } : null;
}

function isIpv4ValueAllocatable(prefix: IpamPrefix, value: bigint) {
	if (prefix.family !== 'ipv4') return false;

	const usable = ipv4UsableRange(prefix);
	if (!usable) return false;
	if (value < usable.first || value > usable.last) return false;
	if (prefix.whitelistStart && value < parseAddress('ipv4', prefix.whitelistStart)) return false;
	if (prefix.whitelistEnd && value > parseAddress('ipv4', prefix.whitelistEnd)) return false;

	return true;
}

function ipv6AllocationPrefixLength(prefix: IpamPrefix) {
	return prefix.ipv6UseTransitAddress ? v6Bits : vmIpv6PrefixLength;
}

function ipv6AllocationSize(prefix: IpamPrefix) {
	return 1n << BigInt(v6Bits - ipv6AllocationPrefixLength(prefix));
}

function ipv6AllocationStart(prefix: IpamPrefix, value: bigint) {
	const range = parseCidr(prefix.cidr);
	const allocationSize = ipv6AllocationSize(prefix);
	return range.start + ((value - range.start) / allocationSize) * allocationSize;
}

function ceilToMultiple(value: bigint, base: bigint, size: bigint) {
	if (value <= base) return base;
	const offset = value - base;
	return base + ((offset + size - 1n) / size) * size;
}

function ipv6WhitelistBounds(prefix: IpamPrefix) {
	const range = parseCidr(prefix.cidr);
	const whitelistStart = prefix.whitelistStart
		? parseAddress('ipv6', prefix.whitelistStart)
		: range.start;
	const whitelistEnd = prefix.whitelistEnd ? parseAddress('ipv6', prefix.whitelistEnd) : range.end;
	const first = whitelistStart > range.start ? whitelistStart : range.start;
	const last = whitelistEnd < range.end ? whitelistEnd : range.end;

	return first <= last ? { first, last } : null;
}

function isIpv6ValueAllocatable(prefix: IpamPrefix, value: bigint) {
	if (prefix.family !== 'ipv6') return false;

	const range = parseCidr(prefix.cidr);
	const bounds = ipv6WhitelistBounds(prefix);
	if (!bounds) return false;
	if (value < bounds.first || value > bounds.last) return false;
	if (prefix.ipv6UseTransitAddress && value === range.start && range.start < range.end)
		return false;

	const allocationStart = ipv6AllocationStart(prefix, value);
	const allocationSize = ipv6AllocationSize(prefix);
	return allocationStart >= bounds.first && allocationStart + allocationSize - 1n <= bounds.last;
}

function prefixCapacity(prefix: IpamPrefix) {
	const range = parseCidr(prefix.cidr);

	if (prefix.family === 'ipv4') {
		const usable = ipv4UsableRange(prefix);
		if (!usable) return 0n;

		let capacity: bigint;
		if (prefix.whitelistStart && prefix.whitelistEnd) {
			// Whitelist set: only count IPs within the whitelist range
			const start = parseAddress('ipv4', prefix.whitelistStart);
			const end = parseAddress('ipv4', prefix.whitelistEnd);
			const overlapStart = start > usable.first ? start : usable.first;
			const overlapEnd = end < usable.last ? end : usable.last;
			capacity = overlapStart <= overlapEnd ? overlapEnd - overlapStart + 1n : 0n;
		} else {
			// No whitelist: entire usable range
			capacity = usable.last - usable.first + 1n;
		}

		return capacity > 0n ? capacity : 0n;
	}

	const bounds = ipv6WhitelistBounds(prefix);
	if (!bounds) return 0n;

	const allocationSize = ipv6AllocationSize(prefix);
	let first = ceilToMultiple(bounds.first, range.start, allocationSize);
	if (prefix.ipv6UseTransitAddress && first === range.start && range.start < range.end)
		first += allocationSize;
	const last = bounds.last - allocationSize + 1n;
	if (first > last) return 0n;

	return (last - first) / allocationSize + 1n;
}

function allocatedCount(
	prefix: IpamPrefix,
	allocations: Pick<IpamAllocation, 'address' | 'prefix'>[],
	dhcpLeases: DhcpLeaseUsage
) {
	if (prefix.family === 'ipv4') {
		const used = new Set(
			allocations.flatMap((allocation) =>
				allocation.address ? [parseAddress('ipv4', allocation.address).toString()] : []
			)
		);

		for (const lease of dhcpLeases.ipv4Addresses) {
			const value = BigInt(lease);
			if (isIpv4ValueAllocatable(prefix, value)) used.add(lease);
		}

		return BigInt(used.size);
	}

	const used = new Set(
		allocations.flatMap((allocation) => {
			if (allocation.prefix)
				return [new Address6(allocation.prefix).startAddress().bigInt().toString()];
			if (allocation.address) return [parseAddress('ipv6', allocation.address).toString()];
			return [];
		})
	);

	for (const lease of dhcpLeases.ipv6Addresses) {
		const value = BigInt(lease);
		if (!isIpv6ValueAllocatable(prefix, value)) continue;
		used.add(prefix.ipv6UseTransitAddress ? lease : ipv6AllocationStart(prefix, value).toString());
	}

	return BigInt(used.size);
}

async function getDhcpLeaseUsage(): Promise<DhcpLeaseUsage> {
	const empty = { ipv4Addresses: new Set<string>(), ipv6Addresses: new Set<string>() };
	if (!isKeaConfigured()) return empty;

	const client = new KeaClient();
	const [ipv4Leases, ipv6Leases] = await Promise.all([
		client.listDHCPv4Leases(),
		client.listDHCPv6Leases()
	]);

	const ipv4Addresses = new Set<string>();
	for (const lease of ipv4Leases) {
		const address = lease['ip-address'];
		if (!address || !Address4.isValid(address)) continue;
		ipv4Addresses.add(new Address4(address).bigInt().toString());
	}

	const ipv6Addresses = new Set<string>();
	for (const lease of ipv6Leases) {
		const address = lease['ip-address'];
		if (!address || !Address6.isValid(address)) continue;
		ipv6Addresses.add(new Address6(address).bigInt().toString());
	}

	return { ipv4Addresses, ipv6Addresses };
}

async function prefixStats(
	db: QueryableDb,
	prefix: IpamPrefix,
	dhcpLeases: DhcpLeaseUsage
): Promise<IpamPrefixWithStats> {
	const allocations = await db.query.ipamAllocations.findMany({
		where: eq(ipamAllocations.ipamPrefixId, prefix.id),
		columns: { address: true, prefix: true }
	});
	const capacity = prefixCanAllocate(prefix) ? prefixCapacity(prefix) : 0n;
	const allocated = allocatedCount(prefix, allocations, dhcpLeases);
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
	const dhcpLeases = await getDhcpLeaseUsage();

	return Promise.all(prefixes.map((prefix) => prefixStats(db, prefix, dhcpLeases)));
}

export async function getIpamAvailability(db: QueryableDb): Promise<IpamAvailability> {
	const prefixes = await listIpamPrefixesWithStats(db);
	const ipv4 = prefixes
		.filter((prefix) => prefix.family === 'ipv4')
		.reduce((total, prefix) => total + BigInt(prefix.available), 0n);
	const ipv6Transit = prefixes
		.filter((prefix) => prefix.family === 'ipv6' && prefix.ipv6UseTransitAddress)
		.reduce((total, prefix) => total + BigInt(prefix.available), 0n);
	const ipv6Prefixes = prefixes
		.filter((prefix) => prefix.family === 'ipv6' && !prefix.ipv6UseTransitAddress)
		.reduce((total, prefix) => total + BigInt(prefix.available), 0n);
	const ipv6 = ipv6Transit < ipv6Prefixes ? ipv6Transit : ipv6Prefixes;

	return {
		ipv4: { available: ipv4 > 0n, availableCount: ipv4.toString() },
		ipv6: { available: ipv6 > 0n, availableCount: ipv6.toString() }
	};
}

function nextIpv4Address(
	prefix: IpamPrefix,
	allocations: Pick<IpamAllocation, 'address'>[],
	dhcpLeases: DhcpLeaseUsage
) {
	const usable = ipv4UsableRange(prefix);
	if (!usable) return null;

	const used = new Set(
		allocations.flatMap((allocation) =>
			allocation.address ? [parseAddress('ipv4', allocation.address).toString()] : []
		)
	);

	for (const lease of dhcpLeases.ipv4Addresses) {
		const value = BigInt(lease);
		if (isIpv4ValueAllocatable(prefix, value)) used.add(lease);
	}

	const allocStart = prefix.whitelistStart
		? parseAddress('ipv4', prefix.whitelistStart)
		: usable.first;
	const allocEnd = prefix.whitelistEnd ? parseAddress('ipv4', prefix.whitelistEnd) : usable.last;

	for (let value = allocStart; value <= allocEnd; value++) {
		if (used.has(value.toString())) continue;
		return formatAddress('ipv4', value);
	}

	return null;
}

function nextIpv6Allocation(
	prefix: IpamPrefix,
	allocations: Pick<IpamAllocation, 'address' | 'prefix'>[],
	dhcpLeases: DhcpLeaseUsage
) {
	const range = parseCidr(prefix.cidr);
	const bounds = ipv6WhitelistBounds(prefix);
	if (!bounds) return null;

	const allocationPrefixLength = ipv6AllocationPrefixLength(prefix);
	const allocationSize = ipv6AllocationSize(prefix);
	const used = new Set(
		allocations.flatMap((allocation) => {
			if (allocation.prefix)
				return [new Address6(allocation.prefix).startAddress().bigInt().toString()];
			if (allocation.address) return [parseAddress('ipv6', allocation.address).toString()];
			return [];
		})
	);

	for (const lease of dhcpLeases.ipv6Addresses) {
		const value = BigInt(lease);
		if (!isIpv6ValueAllocatable(prefix, value)) continue;
		used.add(prefix.ipv6UseTransitAddress ? lease : ipv6AllocationStart(prefix, value).toString());
	}

	let value = ceilToMultiple(bounds.first, range.start, allocationSize);
	if (prefix.ipv6UseTransitAddress && value === range.start && range.start < range.end) {
		value += allocationSize;
	}

	while (value <= bounds.last) {
		if (value + allocationSize - 1n > bounds.last) return null;

		if (!used.has(value.toString())) {
			if (prefix.ipv6UseTransitAddress) {
				return { prefix: null, address: formatAddress('ipv6', value) };
			}

			return {
				prefix: formatPrefix('ipv6', value, allocationPrefixLength),
				address: null
			};
		}

		value += allocationSize;
	}

	return null;
}

async function createKindAllocation(
	db: QueryableDb,
	kind: AllocationKind,
	vmId: string,
	macAddress: string,
	dhcpLeases: DhcpLeaseUsage
): Promise<PendingAllocation> {
	const family: IpFamily = kind === 'ipv4' ? 'ipv4' : 'ipv6';
	const prefixes = await db
		.select()
		.from(ipamPrefixes)
		.where(and(eq(ipamPrefixes.family, family), eq(ipamPrefixes.disabled, false)))
		.orderBy(asc(ipamPrefixes.createdAt), asc(ipamPrefixes.cidr));

	for (const prefix of prefixes) {
		if (!prefixCanAllocate(prefix)) continue;
		if (kind === 'ipv6-transit' && !prefix.ipv6UseTransitAddress) continue;
		if (kind === 'ipv6-prefix' && prefix.ipv6UseTransitAddress) continue;

		const allocations = await db.query.ipamAllocations.findMany({
			where: eq(ipamAllocations.ipamPrefixId, prefix.id),
			columns: { address: true, prefix: true }
		});

		const next =
			kind === 'ipv4'
				? { address: nextIpv4Address(prefix, allocations, dhcpLeases), prefix: null }
				: nextIpv6Allocation(prefix, allocations, dhcpLeases);

		if (!next?.address && !next?.prefix) continue;

		const [inserted] = await db
			.insert(ipamAllocations)
			.values({
				ipamPrefixId: prefix.id,
				associatedVmId: vmId,
				family,
				address: next.address,
				prefix: next.prefix,
				prefixLength: family === 'ipv4' ? vmIpv4PrefixLength : ipv6AllocationPrefixLength(prefix),
				macAddress
			})
			.returning();

		return { ...inserted, sourcePrefix: prefix };
	}

	const label =
		kind === 'ipv4'
			? 'IPv4 addresses'
			: kind === 'ipv6-transit'
				? 'IPv6 transit addresses'
				: 'IPv6 prefixes';
	error(409, `No available ${label}`);
}

async function createLocalAllocation(
	db: QueryableDb,
	kind: AllocationKind,
	vmId: string,
	macAddress: string,
	dhcpLeases: DhcpLeaseUsage
) {
	for (let attempt = 0; attempt < 5; attempt++) {
		try {
			return await createKindAllocation(db, kind, vmId, macAddress, dhcpLeases);
		} catch (err) {
			if (uniqueViolation(err)) continue;
			throw err;
		}
	}

	const label =
		kind === 'ipv4'
			? 'IPv4 addresses'
			: kind === 'ipv6-transit'
				? 'IPv6 transit addresses'
				: 'IPv6 prefixes';
	error(409, `No available ${label}`);
}

async function syncKeaIpv4Allocation(db: QueryableDb, allocation: PendingAllocation) {
	if (allocation.family !== 'ipv4') {
		error(500, `Expected IPv4 allocation, received ${allocation.family}`);
	}

	if (!allocation.address) {
		error(500, `IPv4 allocation ${allocation.id} is missing an address`);
	}

	if (!isKeaConfigured()) return allocation;

	const client = new KeaClient();

	if (!allocation.sourcePrefix.keaSubnetId) {
		error(400, `${allocation.sourcePrefix.cidr} is missing a Kea DHCPv4 subnet id`);
	}

	const reservation = await client.createDHCPv4Reservation(
		allocation.sourcePrefix.keaSubnetId,
		allocation.address,
		allocation.macAddress
	);

	await db
		.update(ipamAllocations)
		.set({
			keaSubnetId: allocation.sourcePrefix.keaSubnetId,
			keaReservationAddress: reservation?.result === 'saved' ? String(reservation.id) : null
		})
		.where(eq(ipamAllocations.id, allocation.id));

	return allocation;
}

async function syncKeaIpv6Allocation(
	db: QueryableDb,
	transitAllocation: PendingAllocation,
	prefixAllocation: PendingAllocation
) {
	if (transitAllocation.family !== 'ipv6') {
		error(500, `Expected IPv6 transit allocation, received ${transitAllocation.family}`);
	}
	if (prefixAllocation.family !== 'ipv6') {
		error(500, `Expected IPv6 prefix allocation, received ${prefixAllocation.family}`);
	}
	if (!transitAllocation.sourcePrefix.ipv6UseTransitAddress) {
		error(
			500,
			`Expected ${transitAllocation.sourcePrefix.cidr} to be an IPv6 transit address block`
		);
	}
	if (prefixAllocation.sourcePrefix.ipv6UseTransitAddress) {
		error(
			500,
			`Expected ${prefixAllocation.sourcePrefix.cidr} to be an IPv6 delegated prefix block`
		);
	}
	if (!transitAllocation.address) {
		error(500, `IPv6 transit allocation ${transitAllocation.id} is missing an address`);
	}
	if (transitAllocation.prefix) {
		error(500, `IPv6 transit allocation ${transitAllocation.id} unexpectedly has a prefix`);
	}
	if (prefixAllocation.address) {
		error(500, `IPv6 prefix allocation ${prefixAllocation.id} unexpectedly has an address`);
	}
	if (!prefixAllocation.prefix) {
		error(500, `IPv6 prefix allocation ${prefixAllocation.id} is missing a prefix`);
	}

	if (!isKeaConfigured()) return;

	if (!transitAllocation.sourcePrefix.keaSubnetId) {
		error(400, `${transitAllocation.sourcePrefix.cidr} is missing a Kea DHCPv6 subnet id`);
	}

	const client = new KeaClient();
	const reservation = await client.createDHCPv6Reservation(
		transitAllocation.sourcePrefix.keaSubnetId,
		transitAllocation.address,
		prefixAllocation.prefix,
		transitAllocation.macAddress
	);

	await db
		.update(ipamAllocations)
		.set({
			keaSubnetId: transitAllocation.sourcePrefix.keaSubnetId,
			keaReservationAddress: reservation?.result === 'saved' ? String(reservation.id) : null
		})
		.where(eq(ipamAllocations.id, transitAllocation.id));
}

export async function allocateVmNetworking(
	db: Db,
	params: { vmId: string; macAddress: string; mode: VmNetworkingMode }
) {
	const allocations: PendingAllocation[] = [];

	try {
		const dhcpLeases = await getDhcpLeaseUsage();

		if (params.mode === 'both') {
			allocations.push(
				await db.transaction((tx) =>
					createLocalAllocation(tx, 'ipv4', params.vmId, params.macAddress, dhcpLeases)
				)
			);
		}

		const ipv6TransitAllocation = await db.transaction((tx) =>
			createLocalAllocation(tx, 'ipv6-transit', params.vmId, params.macAddress, dhcpLeases)
		);
		allocations.push(ipv6TransitAllocation);

		const ipv6PrefixAllocation = await db.transaction((tx) =>
			createLocalAllocation(tx, 'ipv6-prefix', params.vmId, params.macAddress, dhcpLeases)
		);
		allocations.push(ipv6PrefixAllocation);

		for (const allocation of allocations.filter((allocation) => allocation.family === 'ipv4')) {
			await syncKeaIpv4Allocation(db, allocation);
		}
		await syncKeaIpv6Allocation(db, ipv6TransitAllocation, ipv6PrefixAllocation);

		return allocations;
	} catch (err) {
		await releaseVmNetworking(db, params.vmId, true).catch(() => {});
		throw err;
	}
}

export async function releaseVmNetworking(
	db: QueryableDb,
	vmId: string,
	bestEffort = false,
	knownAddresses: { ipv4?: string | null; ipv6?: string | null } = {}
) {
	const allocations = await db.query.ipamAllocations.findMany({
		where: eq(ipamAllocations.associatedVmId, vmId)
	});

	if (isKeaConfigured()) {
		const client = new KeaClient();

		for (const allocation of allocations) {
			try {
				if (
					allocation.family === 'ipv4' &&
					allocation.keaSubnetId &&
					allocation.keaReservationAddress
				) {
					await client.deleteDHCPv4Reservation(
						allocation.keaSubnetId,
						allocation.keaReservationAddress
					);
				}

				if (
					allocation.family === 'ipv6' &&
					allocation.keaSubnetId &&
					allocation.keaReservationAddress
				) {
					await client.deleteDHCPv6Reservation(
						allocation.keaSubnetId,
						allocation.keaReservationAddress
					);
				}
			} catch (err) {
				if (!bestEffort) throw err;
				console.warn(`Failed to release ${allocation.family} reservation ${allocation.id}`, err);
			}
		}

		const ipv4Leases = new Set(
			allocations.flatMap((allocation) =>
				allocation.family === 'ipv4' && allocation.address ? [allocation.address] : []
			)
		);
		if (knownAddresses.ipv4) ipv4Leases.add(knownAddresses.ipv4);

		const ipv6Leases = new Set(
			allocations.flatMap((allocation) =>
				allocation.family === 'ipv6' && allocation.address ? [allocation.address] : []
			)
		);
		if (knownAddresses.ipv6) ipv6Leases.add(knownAddresses.ipv6);

		for (const address of ipv4Leases) {
			try {
				await client.deleteDHCPv4Lease(address);
			} catch (err) {
				if (!bestEffort) throw err;
				console.warn(`Failed to delete DHCPv4 lease ${address} for VM ${vmId}`, err);
			}
		}

		for (const address of ipv6Leases) {
			try {
				await client.deleteDHCPv6Lease(address);
			} catch (err) {
				if (!bestEffort) throw err;
				console.warn(`Failed to delete DHCPv6 lease ${address} for VM ${vmId}`, err);
			}
		}
	}

	await db.delete(ipamAllocations).where(eq(ipamAllocations.associatedVmId, vmId));
}
