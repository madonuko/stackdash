import { eq } from 'drizzle-orm';
import { ipBlocks, ipAssignments, vms } from '$lib/server/db/schema';
import { RpcError, type RpcFunction } from '../types';
import { requireProjectAccess } from '../context';

// ── List all IP blocks ──────────────────────────────────────────────

type ListBlocksResult = { id: string; ipBlock: string }[];

export const listIpBlocks: RpcFunction<void, ListBlocksResult> = async (_params, ctx) => {
	return ctx.db.query.ipBlocks.findMany();
};

// ── List IP assignments for a VM ────────────────────────────────────

type ListAssignmentsParams = { vmId: string };
type ListAssignmentsResult = {
	ip: string;
	ipBlockId: string;
}[];

export const listAssignments: RpcFunction<ListAssignmentsParams, ListAssignmentsResult> = async (
	{ vmId },
	ctx
) => {
	const vm = await ctx.db.query.vms.findFirst({ where: eq(vms.id, vmId) });
	if (!vm) throw new RpcError(404, 'VM not found');
	if (vm.ownerProjectId) {
		await requireProjectAccess(ctx.db, ctx.user.id, vm.ownerProjectId);
	}

	return ctx.db.query.ipAssignments.findMany({
		where: eq(ipAssignments.associatedVmId, vmId),
		columns: { ip: true, ipBlockId: true }
	});
};

// ── Assign an IP to a VM ────────────────────────────────────────────

type AssignParams = { ip: string; ipBlockId: string; vmId: string };

export const assignIp: RpcFunction<AssignParams, void> = async (params, ctx) => {
	const vm = await ctx.db.query.vms.findFirst({ where: eq(vms.id, params.vmId) });
	if (!vm) throw new RpcError(404, 'VM not found');
	if (vm.ownerProjectId) {
		await requireProjectAccess(ctx.db, ctx.user.id, vm.ownerProjectId, 'admin');
	}

	await ctx.db.insert(ipAssignments).values({
		ip: params.ip,
		ipBlockId: params.ipBlockId,
		associatedVmId: params.vmId
	});
};

// ── Unassign an IP from a VM ────────────────────────────────────────

type UnassignParams = { ip: string; vmId: string };

export const unassignIp: RpcFunction<UnassignParams, void> = async (params, ctx) => {
	const vm = await ctx.db.query.vms.findFirst({ where: eq(vms.id, params.vmId) });
	if (!vm) throw new RpcError(404, 'VM not found');
	if (vm.ownerProjectId) {
		await requireProjectAccess(ctx.db, ctx.user.id, vm.ownerProjectId, 'admin');
	}

	await ctx.db
		.delete(ipAssignments)
		.where(eq(ipAssignments.ip, params.ip));
};
