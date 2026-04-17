import { eq } from 'drizzle-orm';
import { initDrizzle } from '$lib/server/db';
import { vms, vmTypes, sshKeys } from '$lib/server/db/schema';
import { getBackend, type VmInfo } from '$lib/server/backends';
import { requireProjectAccess } from '../context';
import { RpcError, type RpcFunction } from '../types';

type ListParams = { projectId: string };
type ListResult = {
	id: string;
	active: boolean;
	vmTypeId: string;
	creationDate: string;
	backend: string;
	status: string;
	vmType: { name: string; cores: number; ramCapacity: number; storageAmount: number } | null;
	live: VmInfo | null;
}[];

export const list: RpcFunction<ListParams, ListResult> = async ({ projectId }, ctx) => {
	await requireProjectAccess(ctx.db, ctx.user.id, projectId);

	const rows = await ctx.db.query.vms.findMany({
		where: eq(vms.ownerProjectId, projectId),
		with: { vmType: true }
	});

	let liveVms: VmInfo[] = [];
	try {
		const backend = getBackend('proxmox');
		liveVms = await backend.listVms();
	} catch {
		// backend may be unconfigured or unreachable — return DB-only data
	}

	const liveMap = new Map(liveVms.map((v) => [v.id, v]));

	return rows.map((row) => ({
		id: row.id,
		active: row.active,
		vmTypeId: row.vmTypeId,
		creationDate: row.creationDate,
		backend: row.backend,
		status: row.status,
		vmType: row.vmType
			? {
					name: row.vmType.name,
					cores: row.vmType.cores,
					ramCapacity: row.vmType.ramCapacity,
					storageAmount: row.vmType.storageAmount
				}
			: null,
		live: liveMap.get(row.id) ?? null
	}));
};

type GetParams = { vmId: string };
type GetResult = {
	id: string;
	active: boolean;
	vmTypeId: string;
	creationDate: string;
	backend: string;
	vmType: { name: string; cores: number; ramCapacity: number; storageAmount: number } | null;
	live: VmInfo | null;
};

export const get: RpcFunction<GetParams, GetResult> = async ({ vmId }, ctx) => {
	const row = await ctx.db.query.vms.findFirst({
		where: eq(vms.id, vmId),
		with: { vmType: true, project: true }
	});

	if (!row) throw new RpcError(404, `VM "${vmId}" not found`);
	if (row.ownerProjectId) {
		await requireProjectAccess(ctx.db, ctx.user.id, row.ownerProjectId);
	}

	let live: VmInfo | null = null;
	try {
		const backend = getBackend(row.backend);
		live = await backend.getVm(row.id);
	} catch {
		// backend unconfigured or unreachable
	}

	return {
		id: row.id,
		active: row.active,
		vmTypeId: row.vmTypeId,
		creationDate: row.creationDate,
		backend: row.backend,
		vmType: row.vmType
			? {
					name: row.vmType.name,
					cores: row.vmType.cores,
					ramCapacity: row.vmType.ramCapacity,
					storageAmount: row.vmType.storageAmount
				}
			: null,
		live
	};
};

type CreateParams = {
	projectId: string;
	vmTypeId: string;
	name: string;
	imageId?: string;
	sshKeyIds?: string[];
};
type CreateResult = { id: string; taskId?: string };

export const create: RpcFunction<CreateParams, CreateResult> = async (params, ctx) => {
	await requireProjectAccess(ctx.db, ctx.user.id, params.projectId, 'read_write');

	const vmType = await ctx.db.query.vmTypes.findFirst({
		where: eq(vmTypes.id, params.vmTypeId)
	});
	if (!vmType) throw new RpcError(400, `VM type "${params.vmTypeId}" not found`);

	// Resolve SSH public keys if provided
	let publicKeys: string[] = [];
	if (params.sshKeyIds?.length) {
		const keys = await ctx.db.query.sshKeys.findMany({
			where: eq(sshKeys.userId, ctx.user.id)
		});
		publicKeys = keys
			.filter((k) => params.sshKeyIds!.includes(k.id))
			.map((k) => k.publicKey);
	}

	// Insert the DB record (starts as "provisioning")
	const [inserted] = await ctx.db
		.insert(vms)
		.values({
			active: true,
			ownerProjectId: params.projectId,
			vmTypeId: params.vmTypeId,
			creationDate: new Date().toISOString().split('T')[0],
			backend: 'proxmox',
			status: 'provisioning'
		})
		.returning();

	// Create on the provider — roll back DB row if Phase 1 fails.
	// Phase 2 (image import) runs in the background via the callback.
	const vmId = inserted.id;
	let result;
	try {
		const backend = getBackend('proxmox');
		result = await backend.createVm({
			id: vmId,
			name: params.name,
			cores: vmType.cores,
			memoryMb: vmType.ramCapacity,
			diskGb: vmType.storageAmount,
			imageId: params.imageId,
			sshKeys: publicKeys,
			onProvisionSettled: ({ ok, error }) => {
				const db = initDrizzle();
				db.update(vms)
					.set(ok ? { status: 'ready' } : { status: 'error', statusError: error ?? 'Unknown error' })
					.where(eq(vms.id, vmId))
					.then(() => console.log(`VM ${vmId} provision ${ok ? 'succeeded' : 'failed'}`))
					.catch((err) => console.error(`VM ${vmId} status update failed:`, err));
			}
		});
	} catch (err) {
		await ctx.db.delete(vms).where(eq(vms.id, inserted.id));
		throw err;
	}

	return { id: inserted.id, taskId: result.taskId };
};

type DeleteParams = { vmId: string };

export const del: RpcFunction<DeleteParams, void> = async ({ vmId }, ctx) => {
	const row = await ctx.db.query.vms.findFirst({ where: eq(vms.id, vmId) });
	if (!row) throw new RpcError(404, `VM "${vmId}" not found`);
	if (row.ownerProjectId) {
		await requireProjectAccess(ctx.db, ctx.user.id, row.ownerProjectId, 'admin');
	}

	// Tear down on provider
	try {
		await getBackend(row.backend).deleteVm(row.id);
	} catch {
		// may already be gone on the provider side
	}

	// Soft-delete in DB
	await ctx.db.update(vms).set({ active: false }).where(eq(vms.id, vmId));
};

async function powerAction(
	vmId: string,
	action: 'startVm' | 'stopVm' | 'killVm' | 'rebootVm',
	ctx: { user: { id: string }; db: any }
) {
	const row = await ctx.db.query.vms.findFirst({ where: eq(vms.id, vmId) });
	if (!row) throw new RpcError(404, `VM "${vmId}" not found`);
	if (row.ownerProjectId) {
		await requireProjectAccess(ctx.db, ctx.user.id, row.ownerProjectId, 'read_write');
	}

	const backend = getBackend(row.backend);
	await backend[action](row.id);
}

type PowerParams = { vmId: string };

export const start: RpcFunction<PowerParams, void> = async (p, ctx) =>
	powerAction(p.vmId, 'startVm', ctx);

export const stop: RpcFunction<PowerParams, void> = async (p, ctx) =>
	powerAction(p.vmId, 'stopVm', ctx);

export const kill: RpcFunction<PowerParams, void> = async (p, ctx) =>
	powerAction(p.vmId, 'killVm', ctx);

export const reboot: RpcFunction<PowerParams, void> = async (p, ctx) =>
	powerAction(p.vmId, 'rebootVm', ctx);
