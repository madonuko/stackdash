import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { listProjects } from '$lib/remote/projects.remote';
import { listSshKeys } from '$lib/remote/ssh-keys.remote';
import { getRequestEvent } from '$app/server';

const publicRoutes = ['/login', '/signup', '/api/'];

export const load: LayoutServerLoad = async ({ locals, url }) => {
	const isPublic = publicRoutes.some((r) => url.pathname.startsWith(r));

	if (!locals.user || !locals.session) {
		if (!isPublic) throw redirect(303, '/login');
		return { user: null, projects: [], sshKeys: [] };
	}

	if (isPublic && !url.pathname.startsWith('/api/')) {
		throw redirect(303, '/');
	}

	const event = getRequestEvent();
	if (!event?.locals.user) throw redirect(303, '/login');

	const [projects, sshKeys] = await Promise.all([
		listProjects({}),
		listSshKeys({})
	]);

	return {
		user: locals.user,
		projects,
		sshKeys
	};
};
