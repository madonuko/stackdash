import { eq } from 'drizzle-orm';
import { vmTypes } from '$lib/server/db/schema';
import { RpcError, type RpcFunction } from '../types';
import { requireAdmin } from '../context';

type VmTypeRow = {
	id: string;
	name: string;
	isa: string;
	cores: number;
	ramCapacity: number;
	storageAmount: number;
	rate: string;
	cap: string;
};

export const list: RpcFunction<void, VmTypeRow[]> = async (_params, ctx) => {
	return ctx.db.query.vmTypes.findMany();
};

type CreateParams = {
	name: string;
	isa: 'x86' | 'arm' | 'risc-v';
	cores: number;
	ramCapacity: number;
	storageAmount: number;
	rate: string;
	cap: string;
};

export const create: RpcFunction<CreateParams, { id: string }> = async (params, ctx) => {
	await requireAdmin(ctx.db, ctx.user.id);

	const [inserted] = await ctx.db
		.insert(vmTypes)
		.values({
			name: params.name,
			isa: params.isa,
			cores: params.cores,
			ramCapacity: params.ramCapacity,
			storageAmount: params.storageAmount,
			rate: params.rate,
			cap: params.cap
		})
		.returning();

	return { id: inserted.id };
};

type UpdateParams = {
	id: string;
	name?: string;
	isa?: 'x86' | 'arm' | 'risc-v';
	cores?: number;
	ramCapacity?: number;
	storageAmount?: number;
	rate?: string;
	cap?: string;
};

export const update: RpcFunction<UpdateParams, void> = async (params, ctx) => {
	await requireAdmin(ctx.db, ctx.user.id);

	const existing = await ctx.db.query.vmTypes.findFirst({
		where: eq(vmTypes.id, params.id)
	});
	if (!existing) throw new RpcError(404, 'VM type not found');

	const { id, ...fields } = params;
	// Strip undefined values
	const updates = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
	if (Object.keys(updates).length === 0) return;

	await ctx.db.update(vmTypes).set(updates).where(eq(vmTypes.id, id));
};

type DeleteParams = { id: string };

export const del: RpcFunction<DeleteParams, void> = async ({ id }, ctx) => {
	await requireAdmin(ctx.db, ctx.user.id);

	const existing = await ctx.db.query.vmTypes.findFirst({
		where: eq(vmTypes.id, id)
	});
	if (!existing) throw new RpcError(404, 'VM type not found');

	try {
		await ctx.db.delete(vmTypes).where(eq(vmTypes.id, id));
	} catch {
		throw new RpcError(409, 'Cannot delete a VM type that is in use by existing VMs');
	}
};
