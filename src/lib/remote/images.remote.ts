import { query, command, getRequestEvent } from '$app/server';
import { error } from '@sveltejs/kit';
import { type } from 'arktype';
import { eq } from 'drizzle-orm';
import { initDrizzle } from '$lib/server/db';
import { baseImages } from '$lib/server/db/schema';
import { getBackend } from '$lib/server/backends';
import { requireAdmin } from '$lib/server/auth-context';

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

export const listImages = query(async () => {
	const event = getRequestEvent();
	if (!event?.locals.user) error(401, 'Authentication required');

	const db = initDrizzle();
	const rows = await db.query.baseImages.findMany();
	return rows.map((row) => ({
		id: row.id,
		filePath: row.filePath,
		name: row.name,
		version: row.version,
		description: row.description,
		shortName: row.shortName,
		icon: row.icon,
		color: row.color,
		isa: row.isa
	}));
});

const createParams = type({
	name: 'string',
	version: 'string',
	description: 'string',
	shortName: 'string',
	icon: 'string?',
	color: 'string',
	filePath: 'string',
	isa: "'x86' | 'arm' | 'risc-v'"
});
export const createImage = command(createParams, async (params) => {
	const event = getRequestEvent();
	if (!event?.locals.user) error(401, 'Authentication required');

	const db = initDrizzle();
	await requireAdmin(db, event.locals.user.id);

	const [inserted] = await db
		.insert(baseImages)
		.values({
			name: params.name,
			version: params.version,
			description: params.description,
			shortName: params.shortName,
			icon: params.icon,
			color: params.color,
			filePath: params.filePath,
			isa: params.isa
		})
		.returning();

	return { id: inserted.id };
});

const updateParams = type({
	imageId: 'string',
	name: 'string?',
	version: 'string?',
	description: 'string?',
	shortName: 'string?',
	icon: 'string?',
	color: 'string?',
	filePath: 'string?',
	isa: "'x86' | 'arm' | 'risc-v'?"
});
export const updateImage = command(updateParams, async (params) => {
	const event = getRequestEvent();
	if (!event?.locals.user) error(401, 'Authentication required');

	const db = initDrizzle();
	await requireAdmin(db, event.locals.user.id);

	const existing = await db.query.baseImages.findFirst({
		where: eq(baseImages.id, params.imageId)
	});
	if (!existing) error(404, 'Image not found');

	const { imageId, ...fields } = params;
	const updates = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
	if (Object.keys(updates).length === 0) return;

	await db.update(baseImages).set(updates).where(eq(baseImages.id, params.imageId));
});

const deleteParams = type({ imageId: 'string' });
export const deleteImage = command(deleteParams, async (params) => {
	const event = getRequestEvent();
	if (!event?.locals.user) error(401, 'Authentication required');

	const db = initDrizzle();
	await requireAdmin(db, event.locals.user.id);

	const existing = await db.query.baseImages.findFirst({
		where: eq(baseImages.id, params.imageId)
	});
	if (!existing) error(404, 'Image not found');

	await db.delete(baseImages).where(eq(baseImages.id, params.imageId));
});

export const listProxmoxIsos = query(async () => {
	const event = getRequestEvent();
	if (!event?.locals.user) error(401, 'Authentication required');

	await requireAdmin(initDrizzle(), event.locals.user.id);

	const backend = getBackend('proxmox');
	return backend.listIsos();
});
