import { eq, and, or, like, sql } from 'drizzle-orm';
import { projects, projectPermissions } from '$lib/server/db/schema';
import { user } from '$lib/server/db/auth.schema';
import { RpcError, type RpcFunction } from '../types';
import { requireProjectAccess } from '../context';

type ListResult = {
	id: string;
	projectName: string;
	ownerUserId: string;
	creationDate: number;
	role: 'owner' | 'admin' | 'read_write' | 'read';
}[];

export const list: RpcFunction<void, ListResult> = async (_params, ctx) => {
	// Projects the user owns
	const owned = await ctx.db.query.projects.findMany({
		where: eq(projects.ownerUserId, ctx.user.id)
	});

	// Projects the user has explicit permissions on
	const shared = await ctx.db.query.projectPermissions.findMany({
		where: eq(projectPermissions.userId, ctx.user.id),
		with: { project: true }
	});

	const results: ListResult = owned.map((p) => ({
		...p,
		role: 'owner' as const
	}));

	for (const perm of shared) {
		// Skip if we already listed as owner
		if (perm.project && !results.some((r) => r.id === perm.project.id)) {
			results.push({
				...perm.project,
				role: perm.permissions
			});
		}
	}

	return results;
};

type GetParams = { projectId: string };
type MemberInfo = { userId: string; name: string; email: string; permissions: string };
type GetResult = {
	id: string;
	projectName: string;
	ownerUserId: string;
	ownerName: string;
	ownerEmail: string;
	creationDate: number;
	members: MemberInfo[];
};

export const get: RpcFunction<GetParams, GetResult> = async ({ projectId }, ctx) => {
	await requireProjectAccess(ctx.db, ctx.user.id, projectId);

	const project = await ctx.db.query.projects.findFirst({
		where: eq(projects.id, projectId),
		with: { permissions: true }
	});

	if (!project) throw new RpcError(404, 'Project not found');

	// Get owner user details
	const ownerUser = await ctx.db.query.user.findFirst({
		where: eq(user.id, project.ownerUserId)
	});

	// Get member user details
	const memberUserIds = project.permissions.map((p: { userId: string }) => p.userId);
	const memberUsers = await ctx.db.query.user.findMany({
		where: or(...memberUserIds.map((id: string) => eq(user.id, id)))
	});

	const memberUserMap = new Map(memberUsers.map((u) => [u.id, u]));

	return {
		id: project.id,
		projectName: project.projectName,
		ownerUserId: project.ownerUserId,
		ownerName: ownerUser?.name ?? 'Unknown',
		ownerEmail: ownerUser?.email ?? '',
		creationDate: project.creationDate,
		members: project.permissions.map((p: { userId: string; permissions: string }) => {
			const memberUser = memberUserMap.get(p.userId);
			return {
				userId: p.userId,
				name: memberUser?.name ?? 'Unknown',
				email: memberUser?.email ?? '',
				permissions: p.permissions
			};
		})
	};
};

type CreateParams = { name: string };
type CreateResult = { id: string };

export const create: RpcFunction<CreateParams, CreateResult> = async ({ name }, ctx) => {
	const [inserted] = await ctx.db
		.insert(projects)
		.values({
			projectName: name,
			ownerUserId: ctx.user.id,
			creationDate: Date.now()
		})
		.returning();

	return { id: inserted.id };
};

type DeleteParams = { projectId: string };

export const del: RpcFunction<DeleteParams, void> = async ({ projectId }, ctx) => {
	const project = await ctx.db.query.projects.findFirst({
		where: eq(projects.id, projectId)
	});

	if (!project) throw new RpcError(404, 'Project not found');
	if (project.ownerUserId !== ctx.user.id) {
		throw new RpcError(403, 'Only the project owner can delete it');
	}

	// Remove permissions first, then the project
	await ctx.db
		.delete(projectPermissions)
		.where(eq(projectPermissions.projectId, projectId));
	await ctx.db.delete(projects).where(eq(projects.id, projectId));
};

type UpdateParams = { projectId: string; name: string };

export const update: RpcFunction<UpdateParams, void> = async ({ projectId, name }, ctx) => {
	await requireProjectAccess(ctx.db, ctx.user.id, projectId, 'admin');

	const project = await ctx.db.query.projects.findFirst({
		where: eq(projects.id, projectId)
	});

	if (!project) throw new RpcError(404, 'Project not found');

	await ctx.db
		.update(projects)
		.set({ projectName: name })
		.where(eq(projects.id, projectId));
};

type AddMemberParams = {
	projectId: string;
	userId: string;
	permissions: 'admin' | 'read_write' | 'read';
};

export const addMember: RpcFunction<AddMemberParams, void> = async (params, ctx) => {
	await requireProjectAccess(ctx.db, ctx.user.id, params.projectId, 'admin');

	// Upsert: delete existing then insert
	await ctx.db
		.delete(projectPermissions)
		.where(
			and(
				eq(projectPermissions.projectId, params.projectId),
				eq(projectPermissions.userId, params.userId)
			)
		);

	await ctx.db.insert(projectPermissions).values({
		projectId: params.projectId,
		userId: params.userId,
		permissions: params.permissions
	});
};

type RemoveMemberParams = { projectId: string; userId: string };

export const removeMember: RpcFunction<RemoveMemberParams, void> = async (params, ctx) => {
	await requireProjectAccess(ctx.db, ctx.user.id, params.projectId, 'admin');

	await ctx.db
		.delete(projectPermissions)
		.where(
			and(
				eq(projectPermissions.projectId, params.projectId),
				eq(projectPermissions.userId, params.userId)
			)
		);
};

type SearchUsersParams = { query: string; limit?: number };
type SearchUsersResult = { id: string; name: string; email: string }[];

export const searchUsers: RpcFunction<SearchUsersParams, SearchUsersResult> = async (
	{ query, limit = 10 },
	ctx
) => {
	await requireProjectAccess(ctx.db, ctx.user.id, ctx.user.id); // Just check they're logged in

	// Search users by email or name
	const results = await ctx.db
		.select({
			id: user.id,
			name: user.name,
			email: user.email
		})
		.from(user)
		.where(
			sql`${user.email} ILIKE ${'%' + query + '%'} OR ${user.name} ILIKE ${'%' + query + '%'}`
		)
		.limit(limit);

	// Exclude current user
	return results.filter((r) => r.id !== ctx.user.id);
};
