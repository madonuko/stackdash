import { eq } from 'drizzle-orm';
import { baseImages } from '$lib/server/db/schema';
import { getBackend } from '$lib/server/backends';
import { RpcError, type RpcFunction } from '../types';

// ── List base images from DB ────────────────────────────────────────

type ImageRow = {
	id: string;
	name: string;
	version: string;
	description: string;
	shortName: string;
	icon: string | null;
	color: string;
	filePath: string;
	isa: string;
};

export const list: RpcFunction<void, ImageRow[]> = async (_params, ctx) => {
	return ctx.db.query.baseImages.findMany();
};

// ── Create a base image ─────────────────────────────────────────────

type CreateParams = {
	name: string;
	version: string;
	description: string;
	shortName: string;
	icon?: string;
	color: string;
	filePath: string;
	isa: 'x86' | 'arm' | 'risc-v';
};

export const create: RpcFunction<CreateParams, { id: string }> = async (params, ctx) => {
	const [inserted] = await ctx.db
		.insert(baseImages)
		.values({
			name: params.name,
			version: params.version,
			description: params.description,
			shortName: params.shortName,
			icon: params.icon ?? null,
			color: params.color,
			filePath: params.filePath,
			isa: params.isa
		})
		.returning();

	return { id: inserted.id };
};

// ── Update a base image ─────────────────────────────────────────────

type UpdateParams = {
	id: string;
	name?: string;
	version?: string;
	description?: string;
	shortName?: string;
	icon?: string | null;
	color?: string;
	filePath?: string;
	isa?: 'x86' | 'arm' | 'risc-v';
};

export const update: RpcFunction<UpdateParams, void> = async (params, ctx) => {
	const existing = await ctx.db.query.baseImages.findFirst({
		where: eq(baseImages.id, params.id)
	});
	if (!existing) throw new RpcError(404, 'Image not found');

	const { id, ...fields } = params;
	const updates = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
	if (Object.keys(updates).length === 0) return;

	await ctx.db.update(baseImages).set(updates).where(eq(baseImages.id, id));
};

// ── Delete a base image ─────────────────────────────────────────────

export const del: RpcFunction<{ id: string }, void> = async ({ id }, ctx) => {
	const existing = await ctx.db.query.baseImages.findFirst({
		where: eq(baseImages.id, id)
	});
	if (!existing) throw new RpcError(404, 'Image not found');

	await ctx.db.delete(baseImages).where(eq(baseImages.id, id));
};

// ── List ISOs available on Proxmox ──────────────────────────────────

type ProxmoxIso = {
	volid: string;
	filename: string;
	size: number;
	node: string;
};

export const listProxmoxIsos: RpcFunction<void, ProxmoxIso[]> = async () => {
	const backend = getBackend('proxmox');
	// Access the underlying client through the backend
	// We need to list nodes, then for each node list the storage with ISO content
	const client = (backend as any).client;
	if (!client) throw new RpcError(500, 'Proxmox client not available');

	const nodes = await client.listNodes();
	const results: ProxmoxIso[] = [];
	const seen = new Set<string>();

	for (const node of nodes) {
		try {
			const storages = await client.listStorage(node.node);
			const isoStorages = storages.filter(
				(s: any) => s.content?.includes('iso') && s.active !== 0
			);

			for (const storage of isoStorages) {
				try {
					const contents = await client.listStorageContent(node.node, storage.storage, 'iso');
					for (const item of contents) {
						if (!seen.has(item.volid)) {
							seen.add(item.volid);
							const parts = item.volid.split('/');
							results.push({
								volid: item.volid,
								filename: parts[parts.length - 1] ?? item.volid,
								size: item.size,
								node: node.node
							});
						}
					}
				} catch {
					// storage may not be accessible on this node
				}
			}
		} catch {
			// node may be offline
		}
	}

	return results;
};
