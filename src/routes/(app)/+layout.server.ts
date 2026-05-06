import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { listProjects } from '$lib/remote/projects.remote';
import { getRequestEvent } from '$app/server';
import { getFeatureFlags } from '$lib/server/feature-flags';

const ACTIVE_PROJECT_COOKIE = 'stack-active-project-id';
export const load: LayoutServerLoad = async ({ locals, url, depends }) => {
	depends('app:projects');
	depends('app:feature-flags');
	const pathname = url.pathname;

	if (!locals.user || !locals.session) {
		throw redirect(303, '/login');
	}

	const event = getRequestEvent();
	if (!event?.locals.user) throw redirect(303, '/login');

	const [projects, featureFlags] = await Promise.all([listProjects(), getFeatureFlags()]);
	const requestedProjectId = url.searchParams.get('projectId');
	const pathMatch = pathname.match(/^\/projects\/([^/]+)/);
	const activeProjectId = requestedProjectId ?? pathMatch?.[1] ?? locals.activeProjectId;
	const isOnRootPage = pathname === '/';
	const currentProject = isOnRootPage
		? null
		: (projects.find((project) => project.id === activeProjectId) ??
			(requestedProjectId ? null : (projects[0] ?? null)));
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
		featureFlags
	};
};
