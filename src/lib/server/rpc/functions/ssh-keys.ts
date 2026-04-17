import { eq, and } from 'drizzle-orm';
import { sshKeys } from '$lib/server/db/schema';
import { RpcError, type RpcFunction } from '../types';

type ListResult = {
	id: string;
	name: string;
	fingerprint: string;
	publicKey: string;
	description: string | null;
}[];

export const list: RpcFunction<void, ListResult> = async (_params, ctx) => {
	return ctx.db.query.sshKeys.findMany({
		where: eq(sshKeys.userId, ctx.user.id)
	});
};

type CreateParams = {
	name: string;
	publicKey: string;
	description?: string;
};
type CreateResult = { id: string; fingerprint: string };

export const create: RpcFunction<CreateParams, CreateResult> = async (params, ctx) => {
	// Derive a simple fingerprint from the public key (base64 portion → SHA-256)
	const parts = params.publicKey.trim().split(/\s+/);
	if (parts.length < 2) throw new RpcError(400, 'Invalid SSH public key format');

	const keyData = parts[1];
	const raw = Uint8Array.from(atob(keyData), (c) => c.charCodeAt(0));
	const hash = await crypto.subtle.digest('SHA-256', raw);
	const fingerprint =
		'SHA256:' +
		btoa(String.fromCharCode(...new Uint8Array(hash)))
			.replace(/=+$/, '');

	const [inserted] = await ctx.db
		.insert(sshKeys)
		.values({
			userId: ctx.user.id,
			name: params.name,
			publicKey: params.publicKey.trim(),
			fingerprint,
			description: params.description ?? null
		})
		.returning();

	return { id: inserted.id, fingerprint: inserted.fingerprint };
};

type DeleteParams = { keyId: string };

export const del: RpcFunction<DeleteParams, void> = async ({ keyId }, ctx) => {
	const key = await ctx.db.query.sshKeys.findFirst({
		where: and(eq(sshKeys.id, keyId), eq(sshKeys.userId, ctx.user.id))
	});

	if (!key) throw new RpcError(404, 'SSH key not found');

	await ctx.db
		.delete(sshKeys)
		.where(and(eq(sshKeys.id, keyId), eq(sshKeys.userId, ctx.user.id)));
};
