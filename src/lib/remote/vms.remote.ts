import { query, command, getRequestEvent } from '$app/server';
import { error } from '@sveltejs/kit';
import { type } from 'arktype';
import { eq, sql } from 'drizzle-orm';
import { initDrizzle } from '$lib/server/db';
import { vms, vmTypes, sshKeys, baseImages } from '$lib/server/db/schema';
import { getBackend, type VmInfo } from '$lib/server/backends';
import { requireProjectAccess } from '$lib/server/auth-context';

type VmRow = {
	id: string;
	name: string;
	proxmoxId: number | null;
	active: boolean;
	ownerProjectId: string | null;
	vmTypeId: string;
	creationDate: string;
	backend: 'proxmox';
	status: 'provisioning' | 'ready' | 'error';
	vmTypeName: string | null;
	vmTypeCores: number | null;
	vmTypeRamCapacity: number | null;
	vmTypeStorageAmount: number | null;
};

function mapVmRow(row: VmRow, live: VmInfo | null) {
	return {
		id: row.id,
		name: row.name,
		proxmoxId: row.proxmoxId ?? undefined,
		active: row.active,
		ownerProjectId: row.ownerProjectId,
		vmTypeId: row.vmTypeId,
		creationDate: row.creationDate,
		backend: row.backend,
		status: row.status,
		vmType: row.vmTypeName
			? {
					name: row.vmTypeName,
					cores: row.vmTypeCores ?? 0,
					ramCapacity: row.vmTypeRamCapacity ?? 0,
					storageAmount: row.vmTypeStorageAmount ?? 0
				}
			: null,
		live
	};
}

function toDashboardStatus(
	status: VmRow['status'],
	liveStatus: VmInfo['status'] | null | undefined
): 'running' | 'stopped' | 'restarting' | 'provisioning' {
	if (status === 'provisioning') return 'provisioning';
	if (liveStatus === 'running') return 'running';
	if (liveStatus === 'paused') return 'restarting';
	return 'stopped';
}

const listParams = type({ projectId: 'string' });
export const listVms = query(listParams, async (params) => {
	const event = getRequestEvent();
	if (!event?.locals.user) error(401, 'Authentication required');

	const db = initDrizzle();
	await requireProjectAccess(db, event.locals.user.id, params.projectId);

	const result = await db.execute(sql`
		select
			${vms.id} as id,
			${vms.name} as name,
			${vms.proxmoxId} as "proxmoxId",
			${vms.active} as active,
			${vms.ownerProjectId} as "ownerProjectId",
			${vms.vmTypeId} as "vmTypeId",
			${vms.creationDate} as "creationDate",
			${vms.backend} as backend,
			${vms.status} as status,
			${vmTypes.name} as "vmTypeName",
			${vmTypes.cores} as "vmTypeCores",
			${vmTypes.ramCapacity} as "vmTypeRamCapacity",
			${vmTypes.storageAmount} as "vmTypeStorageAmount"
		from ${vms}
		left join ${vmTypes} on ${vmTypes.id} = ${vms.vmTypeId}
		where ${vms.ownerProjectId} = ${params.projectId}
	`);
	const rows = result.rows as VmRow[];

	let liveVms: VmInfo[] = [];
	try {
		const backend = getBackend('proxmox');
		liveVms = await backend.listVms();
	} catch {}

	const liveByProxmoxId = new Map(
		liveVms.filter((vm) => vm.proxmoxId != null).map((vm) => [vm.proxmoxId!, vm] as const)
	);
	const liveById = new Map(liveVms.map((vm) => [vm.id, vm]));

	return rows.map((row) =>
		mapVmRow(
			row,
			(row.proxmoxId != null ? liveByProxmoxId.get(row.proxmoxId) : null) ??
				liveById.get(row.id) ??
				null
		)
	);
});

const getParams = type({ vmId: 'string' });
export const getVm = query(getParams, async (params) => {
	const event = getRequestEvent();
	if (!event?.locals.user) error(401, 'Authentication required');

	const db = initDrizzle();
	const result = await db.execute(sql`
		select
			${vms.id} as id,
			${vms.name} as name,
			${vms.proxmoxId} as "proxmoxId",
			${vms.active} as active,
			${vms.ownerProjectId} as "ownerProjectId",
			${vms.vmTypeId} as "vmTypeId",
			${vms.creationDate} as "creationDate",
			${vms.backend} as backend,
			${vms.status} as status,
			${vmTypes.name} as "vmTypeName",
			${vmTypes.cores} as "vmTypeCores",
			${vmTypes.ramCapacity} as "vmTypeRamCapacity",
			${vmTypes.storageAmount} as "vmTypeStorageAmount"
		from ${vms}
		left join ${vmTypes} on ${vmTypes.id} = ${vms.vmTypeId}
		where ${vms.id} = ${params.vmId}
		limit 1
	`);
	const row = (result.rows as VmRow[])[0];

	if (!row) error(404, `VM "${params.vmId}" not found`);
	if (row.ownerProjectId) {
		await requireProjectAccess(db, event.locals.user.id, row.ownerProjectId);
	}

	let live: VmInfo | null = null;
	try {
		const backend = getBackend(row.backend);
		live = await backend.getVm(row.id, row.proxmoxId ?? undefined);
	} catch {}

	return mapVmRow(row, live);
});

const statusParams = type({ projectId: 'string' });
export const listVmStatuses = query(statusParams, async (params) => {
	const event = getRequestEvent();
	if (!event?.locals.user) error(401, 'Authentication required');

	const db = initDrizzle();
	await requireProjectAccess(db, event.locals.user.id, params.projectId);

	const result = await db.execute(sql`
		select
			${vms.id} as id,
			${vms.name} as name,
			${vms.proxmoxId} as "proxmoxId",
			${vms.active} as active,
			${vms.ownerProjectId} as "ownerProjectId",
			${vms.vmTypeId} as "vmTypeId",
			${vms.creationDate} as "creationDate",
			${vms.backend} as backend,
			${vms.status} as status,
			${vmTypes.name} as "vmTypeName",
			${vmTypes.cores} as "vmTypeCores",
			${vmTypes.ramCapacity} as "vmTypeRamCapacity",
			${vmTypes.storageAmount} as "vmTypeStorageAmount"
		from ${vms}
		left join ${vmTypes} on ${vmTypes.id} = ${vms.vmTypeId}
		where ${vms.ownerProjectId} = ${params.projectId}
	`);
	const rows = (result.rows as VmRow[]).filter((row) => row.active);

	let liveVms: VmInfo[] = [];
	try {
		const backend = getBackend('proxmox');
		liveVms = await backend.listVms();
	} catch {}

	const liveByProxmoxId = new Map(
		liveVms.filter((vm) => vm.proxmoxId != null).map((vm) => [vm.proxmoxId!, vm] as const)
	);
	const liveById = new Map(liveVms.map((vm) => [vm.id, vm]));

	return rows.map((row) => {
		const live =
			(row.proxmoxId != null ? liveByProxmoxId.get(row.proxmoxId) : null) ??
			liveById.get(row.id) ??
			null;
		const mapped = mapVmRow(row, live);
		return {
			id: mapped.id,
			status: toDashboardStatus(row.status, mapped.live?.status),
			liveStatus: mapped.live?.status ?? null,
			uptime: mapped.live?.uptime ?? 0,
			memory: mapped.live?.memory ?? null,
			disk: mapped.live?.disk ?? null,
			networkInterfaces: mapped.live?.networkInterfaces ?? null
		};
	});
});

const createParams = type({
	projectId: 'string',
	vmTypeId: 'string',
	name: 'string',
	imageId: 'string?',
	sshKeyIds: 'string[]?'
});
export const createVm = command(createParams, async (params) => {
	const event = getRequestEvent();
	if (!event?.locals.user) error(401, 'Authentication required');

	const db = initDrizzle();
	await requireProjectAccess(db, event.locals.user.id, params.projectId, 'read_write');

	const vmType = await db.query.vmTypes.findFirst({
		where: eq(vmTypes.id, params.vmTypeId)
	});
	if (!vmType) error(400, `VM type "${params.vmTypeId}" not found`);

	const baseImage = params.imageId
		? await db.query.baseImages.findFirst({
				where: eq(baseImages.id, params.imageId)
			})
		: null;
	if (params.imageId && !baseImage) error(400, `Image "${params.imageId}" not found`);

	let publicKeys: string[] = [];
	if (params.sshKeyIds?.length) {
		const keys = await db.query.sshKeys.findMany({
			where: eq(sshKeys.userId, event.locals.user.id)
		});
		publicKeys = keys.filter((k) => params.sshKeyIds!.includes(k.id)).map((k) => k.publicKey);
	}

	const [inserted] = await db
		.insert(vms)
		.values({
			name: params.name,
			proxmoxId: null,
			active: true,
			ownerProjectId: params.projectId,
			vmTypeId: params.vmTypeId,
			creationDate: new Date().toISOString().split('T')[0],
			backend: 'proxmox',
			status: 'provisioning'
		})
		.returning();

	const vmId = inserted.id;
	let result;
	try {
		const backend = getBackend('proxmox');
		result = await backend.createVm({
			id: vmId,
			name: params.name,
			proxmoxId: inserted.proxmoxId ?? undefined,
			cores: vmType.cores,
			memoryMb: vmType.ramCapacity,
			diskGb: vmType.storageAmount,
			imageId: params.imageId,
			imageSource: baseImage?.filePath,
			sshKeys: publicKeys,
			onProvisionSettled: ({ ok, error: err }) => {
				const db = initDrizzle();
				db.update(vms)
					.set(ok ? { status: 'ready' } : { status: 'error', statusError: err ?? 'Unknown error' })
					.where(eq(vms.id, vmId))
					.then(() => console.log(`VM ${vmId} provision ${ok ? 'succeeded' : 'failed'}`))
					.catch((err) => console.error(`VM ${vmId} status update failed:`, err));
			}
		});
	} catch (err) {
		await db.delete(vms).where(eq(vms.id, inserted.id));
		throw err;
	}

	await db
		.update(vms)
		.set({ proxmoxId: result.proxmoxId ?? null })
		.where(eq(vms.id, vmId));

	return { id: inserted.id, taskId: result.taskId };
});

const deleteParams = type({ vmId: 'string' });
export const deleteVm = command(deleteParams, async (params) => {
	const event = getRequestEvent();
	if (!event?.locals.user) error(401, 'Authentication required');

	const db = initDrizzle();
	const row = await db.query.vms.findFirst({ where: eq(vms.id, params.vmId) });
	if (!row) error(404, `VM "${params.vmId}" not found`);
	if (row.ownerProjectId) {
		await requireProjectAccess(db, event.locals.user.id, row.ownerProjectId, 'admin');
	}

	try {
		await getBackend(row.backend).deleteVm(row.id, row.proxmoxId ?? undefined);
	} catch {}

	await db.update(vms).set({ active: false }).where(eq(vms.id, params.vmId));
});

const powerParams = type({ vmId: 'string' });
async function powerAction(vmId: string, action: 'startVm' | 'stopVm' | 'killVm' | 'rebootVm') {
	const event = getRequestEvent();
	if (!event?.locals.user) error(401, 'Authentication required');

	const db = initDrizzle();
	const row = await db.query.vms.findFirst({ where: eq(vms.id, vmId) });
	if (!row) error(404, `VM "${vmId}" not found`);
	if (row.ownerProjectId) {
		await requireProjectAccess(db, event.locals.user.id, row.ownerProjectId, 'read_write');
	}

	const backend = getBackend(row.backend);
	await backend[action](row.id, row.proxmoxId ?? undefined);
}

export const startVm = command(powerParams, async (p) => powerAction(p.vmId, 'startVm'));
export const stopVm = command(powerParams, async (p) => powerAction(p.vmId, 'killVm'));
export const killVm = command(powerParams, async (p) => powerAction(p.vmId, 'killVm'));
export const rebootVm = command(powerParams, async (p) => powerAction(p.vmId, 'rebootVm'));
