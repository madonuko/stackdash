export function normalizeMacAddress(macAddress: string) {
	return macAddress.trim().toLowerCase().replaceAll('-', ':');
}

export function duidLlFromMacAddress(macAddress: string) {
	const octets = normalizeMacAddress(macAddress).split(':');
	if (octets.length !== 6 || octets.some((octet) => !/^[0-9a-f]{2}$/.test(octet))) {
		throw new Error(`Invalid MAC address: ${macAddress}`);
	}

	// DUID-LL: type 3, hardware type 1 (Ethernet), followed by link-layer address.
	return ['00', '03', '00', '01', ...octets].join(':');
}
