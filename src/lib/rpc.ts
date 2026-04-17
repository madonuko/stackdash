/**
 * Client-side RPC helper — call any remote function by name.
 *
 * Usage:
 *   import { rpc } from '$lib/rpc';
 *
 *   const vms = await rpc('vms.list', { projectId: 'abc' });
 *   await rpc('vms.start', { vmId: 'xyz' });
 */

export class RpcClientError extends Error {
	status: number;

	constructor(status: number, message: string) {
		super(message);
		this.status = status;
	}
}

export async function rpc<T = unknown>(fn: string, params?: unknown): Promise<T> {
	const res = await fetch(`/api/rpc/${fn}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(params ?? {})
	});

	const data = await res.json();

	if (!data.ok) {
		throw new RpcClientError(res.status, data.error ?? 'Unknown error');
	}

	return data.data as T;
}

/**
 * List all available remote functions (GET /api/rpc).
 */
export async function listFunctions(): Promise<string[]> {
	const res = await fetch('/api/rpc');
	const data = await res.json();
	return data.functions ?? [];
}
