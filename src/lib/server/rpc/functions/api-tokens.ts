import { eq, and } from 'drizzle-orm';
import { apiTokens } from '$lib/server/db/schema';
import { RpcError, type RpcFunction } from '../types';

function generateToken(): string {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function hashToken(token: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(token);
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

type ListResult = {
	id: string;
	name: string;
	createdAt: number;
	lastUsedAt: number | null;
}[];

export const list: RpcFunction<void, ListResult> = async (_params, ctx) => {
	const tokens = await ctx.db.query.apiTokens.findMany({
		where: eq(apiTokens.userId, ctx.user.id)
	});

	return tokens.map((t) => ({
		id: t.id,
		name: t.name,
		createdAt: t.createdAt,
		lastUsedAt: null
	}));
};

type CreateParams = { name: string };
type CreateResult = { id: string; token: string };

export const create: RpcFunction<CreateParams, CreateResult> = async ({ name }, ctx) => {
	const plainToken = generateToken();
	const tokenHash = await hashToken(plainToken);

	const [inserted] = await ctx.db
		.insert(apiTokens)
		.values({
			userId: ctx.user.id,
			name,
			tokenHash,
			createdAt: Date.now()
		})
		.returning();

	return { id: inserted.id, token: plainToken };
};

type RevokeParams = { tokenId: string };

export const revoke: RpcFunction<RevokeParams, void> = async ({ tokenId }, ctx) => {
	const token = await ctx.db.query.apiTokens.findFirst({
		where: and(eq(apiTokens.id, tokenId), eq(apiTokens.userId, ctx.user.id))
	});

	if (!token) throw new RpcError(404, 'API token not found');

	await ctx.db
		.delete(apiTokens)
		.where(and(eq(apiTokens.id, tokenId), eq(apiTokens.userId, ctx.user.id)));
};
