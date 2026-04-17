import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { initDrizzle } from '$lib/server/db';
import { dispatch } from '$lib/server/rpc';

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

	const db = initDrizzle();
	const ctx = { user: locals.user, session: locals.session, db };

	const [projects, sshKeys] = await Promise.all([
		dispatch('projects.list', undefined, ctx),
		dispatch('sshKeys.list', undefined, ctx)
	]);

	return {
		user: locals.user,
		projects: projects as { id: string; projectName: string; role: string }[],
		sshKeys: sshKeys as { id: string; name: string; fingerprint: string; publicKey: string }[]
	};
};
