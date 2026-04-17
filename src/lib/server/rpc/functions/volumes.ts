import { eq, and, isNull } from 'drizzle-orm';
import { volumes, vms } from '$lib/server/db/schema';
import { RpcError, type RpcFunction } from '../types';
import { requireProjectAccess } from '../context';

// ── List volumes for a project ──────────────────────────────────────

type ListParams = { projectId: string };
type ListResult = {
	id: string;
	name: string;
	size: number;
	associatedVmId: string | null;
}[];

export const list: RpcFunction<ListParams, ListResult> = async ({ projectId }, ctx) => {
	const pid = validateId(projectId, 'projectId');
	await requireProjectAccess(ctx.db, ctx.user.id, pid);

	return ctx.db.query.volumes.findMany({
		where: eq(volumes.ownerProjectId, projectId),
		columns: { id: true, name: true, size: true, associatedVmId: true }
	});
};

// ── Get a single volume ─────────────────────────────────────────────

type GetParams = { volumeId: string };
type GetResult = {
	id: string;
	name: string;
	size: number;
	ownerProjectId: string;
	associatedVmId: string | null;
};

export const get: RpcFunction<GetParams, GetResult> = async ({ volumeId }, ctx) => {
	const vid = validateId(volumeId, 'volumeId');
	const vol = await ctx.db.query.volumes.findFirst({
		where: eq(volumes.id, volumeId)
	});

	if (!vol) throw new RpcError(404, 'Volume not found');
	await requireProjectAccess(ctx.db, ctx.user.id, vol.ownerProjectId);
	return vol;
};

// ── Input validation helpers ──────────────────────────────────────

function validateId(id: unknown, fieldName: string): string {
	if (typeof id !== 'string' || id.length === 0) {
		throw new RpcError(400, `${fieldName} is required`);
	}
	return id;
}

function validateRequired(value: unknown, fieldName: string): string {
	if (typeof value !== 'string' || value.trim().length === 0) {
		throw new RpcError(400, `${fieldName} is required`);
	}
	return value.trim();
}

function validatePositiveInteger(value: unknown, fieldName: string): number {
	if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
		throw new RpcError(400, `${fieldName} must be a positive integer`);
	}
	return value;
}

// ── Create a volume ─────────────────────────────────────────────────

type CreateParams = { projectId: string; name: string; sizeGb: number };
type CreateResult = { id: string };

export const create: RpcFunction<CreateParams, CreateResult> = async (params, ctx) => {
	// Validate input
	const projectId = validateId(params.projectId, 'projectId');
	const name = validateRequired(params.name, 'name');
	const sizeGb = validatePositiveInteger(params.sizeGb, 'sizeGb');

	await requireProjectAccess(ctx.db, ctx.user.id, projectId, 'read_write');

	const [inserted] = await ctx.db
		.insert(volumes)
		.values({
			name,
			size: sizeGb,
			ownerProjectId: projectId
		})
		.returning();

	return { id: inserted.id };
};

// ── Delete a volume ─────────────────────────────────────────────────

type DeleteParams = { volumeId: string };

export const del: RpcFunction<DeleteParams, void> = async ({ volumeId }, ctx) => {
	const vol = await ctx.db.query.volumes.findFirst({
		where: eq(volumes.id, volumeId)
	});

	if (!vol) throw new RpcError(404, 'Volume not found');
	await requireProjectAccess(ctx.db, ctx.user.id, vol.ownerProjectId, 'admin');

	if (vol.associatedVmId) {
		throw new RpcError(409, 'Detach the volume from its VM before deleting');
	}

	await ctx.db.delete(volumes).where(eq(volumes.id, volumeId));
};

// ── Attach a volume to a VM ─────────────────────────────────────────

type AttachParams = { volumeId: string; vmId: string };

export const attach: RpcFunction<AttachParams, void> = async ({ volumeId, vmId }, ctx) => {
	const vol = await ctx.db.query.volumes.findFirst({
		where: eq(volumes.id, volumeId)
	});
	if (!vol) throw new RpcError(404, 'Volume not found');

	await requireProjectAccess(ctx.db, ctx.user.id, vol.ownerProjectId, 'read_write');

	if (vol.associatedVmId) {
		throw new RpcError(409, 'Volume is already attached to a VM');
	}

	// Verify the VM exists and belongs to the same project
	const vm = await ctx.db.query.vms.findFirst({ where: eq(vms.id, vmId) });
	if (!vm) throw new RpcError(404, 'VM not found');
	if (vm.ownerProjectId !== vol.ownerProjectId) {
		throw new RpcError(400, 'Volume and VM must belong to the same project');
	}

	await ctx.db
		.update(volumes)
		.set({ associatedVmId: vmId })
		.where(eq(volumes.id, volumeId));
};

// ── Detach a volume from its VM ─────────────────────────────────────

type DetachParams = { volumeId: string };

export const detach: RpcFunction<DetachParams, void> = async ({ volumeId }, ctx) => {
	const vol = await ctx.db.query.volumes.findFirst({
		where: eq(volumes.id, volumeId)
	});
	if (!vol) throw new RpcError(404, 'Volume not found');

	await requireProjectAccess(ctx.db, ctx.user.id, vol.ownerProjectId, 'read_write');

	await ctx.db
		.update(volumes)
		.set({ associatedVmId: null })
		.where(eq(volumes.id, volumeId));
};
