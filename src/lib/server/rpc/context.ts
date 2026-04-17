import { eq, and, or } from 'drizzle-orm';
import { projects, projectPermissions } from '$lib/server/db/schema';
import { RpcError, type Database } from './types';

type PermissionLevel = 'read' | 'read_write' | 'admin';

const permissionRank: Record<PermissionLevel, number> = {
	read: 0,
	read_write: 1,
	admin: 2
};

/**
 * Verify the calling user has admin-level access to the platform.
 * A user is considered an admin if:
 * - They own at least one project (project owner), OR
 * - They have admin permission on at least one project
 *
 * Throws RpcError(403) if user is not an admin.
 */
export async function requireAdmin(db: Database, userId: string): Promise<void> {
	// Check if user owns any project
	const ownedProject = await db.query.projects.findFirst({
		where: eq(projects.ownerUserId, userId)
	});

	if (ownedProject) return;

	// Check if user has admin permission on any project
	const adminPerm = await db.query.projectPermissions.findFirst({
		where: and(
			eq(projectPermissions.userId, userId),
			eq(projectPermissions.permissions, 'admin')
		)
	});

	if (adminPerm) return;

	throw new RpcError(403, 'Admin permission required');
}

/**
 * Verify the calling user has at least `minLevel` access to a project.
 * The project owner always has implicit admin access.
 * Throws RpcError(403) on denial, RpcError(404) if project doesn't exist.
 */
export async function requireProjectAccess(
	db: Database,
	userId: string,
	projectId: string,
	minLevel: PermissionLevel = 'read'
): Promise<void> {
	const project = await db.query.projects.findFirst({
		where: eq(projects.id, projectId)
	});

	if (!project) {
		throw new RpcError(404, `Project "${projectId}" not found`);
	}

	// Owner always has admin
	if (project.ownerUserId === userId) return;

	const perm = await db.query.projectPermissions.findFirst({
		where: and(
			eq(projectPermissions.projectId, projectId),
			eq(projectPermissions.userId, userId)
		)
	});

	if (!perm || permissionRank[perm.permissions] < permissionRank[minLevel]) {
		throw new RpcError(403, 'Insufficient project permissions');
	}
}
