import type { User, Session } from 'better-auth';

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Locals {
			user?: User;
			session?: Session;
			activeProjectId?: string | null;
		}

		interface Platform {
			env: {
				ORIGIN: string;
				BETTER_AUTH_SECRET: string;
				HYPERDRIVE: {
					connectionString: string;
				};
				FEATURE_FLAGS?: KVNamespace;
				PROXMOX_CACHE?: KVNamespace;
				// OAuth (set as Cloudflare Worker secrets)
				GITHUB_CLIENT_ID?: string;
				GITHUB_CLIENT_SECRET?: string;
				GOOGLE_CLIENT_ID?: string;
				GOOGLE_CLIENT_SECRET?: string;
				// Proxmox VE backend
				PROXMOX_API_URL?: string;
				PROXMOX_TOKEN_ID?: string;
				PROXMOX_TOKEN_SECRET?: string;
			};
		}

		interface PageData {
			featureFlags?: {
				colocation: boolean;
				firewall: boolean;
				images: boolean;
				volumes: boolean;
			};
		}
		// interface PageState {}
	}
}

export {};
