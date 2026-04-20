import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { listProjects } from '$lib/remote/projects.remote';
import { listSshKeys } from '$lib/remote/ssh-keys.remote';
import { getRequestEvent } from '$app/server';
import { getFeatureFlags } from '$lib/server/feature-flags';

const publicRoutes = ['/login', '/signup', '/api/'];
const ACTIVE_PROJECT_COOKIE = 'stack-active-project-id';
export const load: LayoutServerLoad = async ({ locals, url }) => {
	const isPublic = publicRoutes.some((r) => url.pathname.startsWith(r));

	if (!locals.user || !locals.session) {
		if (!isPublic) throw redirect(303, '/login');
		return { user: null, projects: [], sshKeys: [], featureFlags: await getFeatureFlags() };
	}

	if (isPublic && !url.pathname.startsWith('/api/')) {
		throw redirect(303, '/');
	}

	const event = getRequestEvent();
	if (!event?.locals.user) throw redirect(303, '/login');

	const [projects, sshKeys, featureFlags] = await Promise.all([
		listProjects(),
		listSshKeys(),
		getFeatureFlags()
	]);
	const requestedProjectId = url.searchParams.get('projectId');
	const activeProjectId = requestedProjectId ?? locals.activeProjectId;
	const fallbackProject = projects[0] ?? null;
	const currentProject =
		projects.find((project) => project.id === activeProjectId) ??
		(requestedProjectId ? null : fallbackProject);
	const responseEvent = getRequestEvent();

	if (responseEvent) {
		if (currentProject) {
			responseEvent.cookies.set(ACTIVE_PROJECT_COOKIE, currentProject.id, {
				path: '/',
				httpOnly: true,
				sameSite: 'strict',
				secure: url.protocol === 'https:',
				maxAge: 60 * 60 * 24 * 365
			});
		} else {
			responseEvent.cookies.delete(ACTIVE_PROJECT_COOKIE, { path: '/' });
		}
	}

	return {
		user: locals.user,
		projects,
		currentProject,
		sshKeys,
		featureFlags
	};
};
