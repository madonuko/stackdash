import { getRequestEvent } from '$app/server';
import { dev } from '$app/environment';
import { env as privateEnv } from '$env/dynamic/private';

export interface BackendEnv {
	PROXMOX_API_URL?: string;
	PROXMOX_TOKEN_ID?: string;
	PROXMOX_TOKEN_SECRET?: string;
}

export function getBackendEnv(): BackendEnv {
	const platformEnv = getRequestEvent().platform?.env as
		| (Record<string, string | undefined> & BackendEnv)
		| undefined;

	if (platformEnv?.PROXMOX_API_URL) {
		return {
			PROXMOX_API_URL: platformEnv.PROXMOX_API_URL,
			PROXMOX_TOKEN_ID: platformEnv.PROXMOX_TOKEN_ID,
			PROXMOX_TOKEN_SECRET: platformEnv.PROXMOX_TOKEN_SECRET ?? platformEnv.PROXMOX_API_SECRET
		};
	}

	if (!dev) {
		throw new Error('Cloudflare bindings are unavailable on this request');
	}

	return {
		PROXMOX_API_URL: privateEnv.PROXMOX_API_URL,
		PROXMOX_TOKEN_ID: privateEnv.PROXMOX_TOKEN_ID,
		PROXMOX_TOKEN_SECRET: privateEnv.PROXMOX_TOKEN_SECRET ?? privateEnv.PROXMOX_API_SECRET
	};
}
