import { dev } from '$app/environment';
import type { VmBackend } from './types';
import { ProxmoxBackend } from './proxmox';
import { ProxmoxClient } from './proxmox/client';
import { getBackendEnv } from './env';

export type { VmBackend, VmInfo, VmCreateParams, VmCreateResult, VmStatus } from './types';

let cached: { key: string; backend: VmBackend } | null = null;

function createProxmox(): ProxmoxBackend {
	const env = getBackendEnv();

	if (!env.PROXMOX_API_URL || !env.PROXMOX_TOKEN_ID || !env.PROXMOX_TOKEN_SECRET) {
		throw new Error(
			'Proxmox backend requires PROXMOX_API_URL, PROXMOX_TOKEN_ID, and PROXMOX_TOKEN_SECRET'
		);
	}

	const client = new ProxmoxClient({
		baseUrl: env.PROXMOX_API_URL,
		tokenId: env.PROXMOX_TOKEN_ID,
		tokenSecret: env.PROXMOX_TOKEN_SECRET,
		verifySsl: !dev
	});

	return new ProxmoxBackend(client);
}

export function getBackend(name: string): VmBackend {
	// Skip cache in dev — module-level state survives HMR and goes stale
	if (!dev && cached?.key === name) return cached.backend;

	let backend: VmBackend;

	switch (name) {
		case 'proxmox':
			backend = createProxmox();
			break;
		default:
			throw new Error(`Unknown VM backend: "${name}"`);
	}

	cached = { key: name, backend };
	return backend;
}
