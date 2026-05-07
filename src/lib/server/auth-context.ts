import { error } from '@sveltejs/kit';
import { and, eq, inArray } from 'drizzle-orm';
import { hasProjectRole, type PermissionLevel } from '$lib/auth/organization-permissions';
import { member, organization } from '$lib/server/db/schema';

type AdminRole = 'owner' | 'admin';

export async function requireAdmin(db: any, userId: string): Promise<void> {
	const adminMember = await db.query.member.findFirst({
		where: and(
			eq(member.userId, userId),
			inArray(member.role, ['owner', 'admin'] satisfies AdminRole[])
		)
	});

	if (adminMember) return;

	error(403, 'Admin permission required');
}

export async function requireProjectAccess(
	db: any,
	userId: string,
	projectId: string,
	minLevel: PermissionLevel | 'owner' = 'read'
): Promise<void> {
	const project = await db.query.organization.findFirst({
		where: eq(organization.id, projectId)
	});

	if (!project) {
		error(404, `Project "${projectId}" not found`);
	}

	const projectMember = await db.query.member.findFirst({
		where: and(eq(member.organizationId, projectId), eq(member.userId, userId))
	});

	if (!projectMember || !hasProjectRole(projectMember.role, minLevel)) {
		error(403, 'Insufficient project permissions');
	}
}
