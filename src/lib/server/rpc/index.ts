/**
 * RPC Barrel — maps every remote function to a dotted route name.
 *
 * Import this barrel from the API route handler; it gives you a flat
 * registry of every callable remote function and a typed `dispatch()`.
 *
 * Adding a new remote function:
 *   1. Create it in ./functions/<domain>.ts
 *   2. Import + register it in the `functions` map below
 *   3. It's automatically available at POST /api/rpc/<name>
 */

import { RpcError, type FunctionRegistry, type RpcContext } from './types';

// ── Function modules ────────────────────────────────────────────────
import * as vmFns from './functions/vms';
import * as projectFns from './functions/projects';
import * as sshKeyFns from './functions/ssh-keys';
import * as volumeFns from './functions/volumes';
import * as imageFns from './functions/images';
import * as networkingFns from './functions/networking';
import * as vmTypeFns from './functions/vm-types';

// ── The registry ────────────────────────────────────────────────────
// Each key becomes the HTTP route: POST /api/rpc/vms.list etc.

export const functions: FunctionRegistry = {
	// VMs
	'vms.list': vmFns.list,
	'vms.get': vmFns.get,
	'vms.create': vmFns.create,
	'vms.delete': vmFns.del,
	'vms.start': vmFns.start,
	'vms.stop': vmFns.stop,
	'vms.kill': vmFns.kill,
	'vms.reboot': vmFns.reboot,

	// Projects
	'projects.list': projectFns.list,
	'projects.get': projectFns.get,
	'projects.create': projectFns.create,
	'projects.delete': projectFns.del,
	'projects.addMember': projectFns.addMember,
	'projects.removeMember': projectFns.removeMember,

	// SSH Keys
	'sshKeys.list': sshKeyFns.list,
	'sshKeys.create': sshKeyFns.create,
	'sshKeys.delete': sshKeyFns.del,

	// Volumes
	'volumes.list': volumeFns.list,
	'volumes.get': volumeFns.get,
	'volumes.create': volumeFns.create,
	'volumes.delete': volumeFns.del,
	'volumes.attach': volumeFns.attach,
	'volumes.detach': volumeFns.detach,

	// Images
	'images.list': imageFns.list,
	'images.create': imageFns.create,
	'images.update': imageFns.update,
	'images.delete': imageFns.del,
	'images.listProxmoxIsos': imageFns.listProxmoxIsos,

	// Networking
	'networking.listIpBlocks': networkingFns.listIpBlocks,
	'networking.listAssignments': networkingFns.listAssignments,
	'networking.assignIp': networkingFns.assignIp,
	'networking.unassignIp': networkingFns.unassignIp,

	// VM Types (admin)
	'vmTypes.list': vmTypeFns.list,
	'vmTypes.create': vmTypeFns.create,
	'vmTypes.update': vmTypeFns.update,
	'vmTypes.delete': vmTypeFns.del
};

/** All registered function names (useful for introspection / client codegen). */
export const functionNames = Object.keys(functions) as (keyof typeof functions)[];

// ── Dispatcher ──────────────────────────────────────────────────────

export async function dispatch(name: string, params: unknown, ctx: RpcContext): Promise<unknown> {
	const fn = functions[name];
	if (!fn) {
		throw new RpcError(404, `Unknown function: "${name}"`);
	}
	return fn(params, ctx);
}

// Re-export types the route handler needs
export { RpcError } from './types';
export type { RpcContext } from './types';
