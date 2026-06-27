import { redirect, type Handle } from '@sveltejs/kit';
import { building } from '$app/environment';
import { initAuth } from '$lib/server/auth';
import { closeRequestDb } from '$lib/server/db';
import { svelteKitHandler } from 'better-auth/svelte-kit';

const publicRoutes = ['/login', '/register', '/signup', '/accept-invitation', '/api/'];

const handleBetterAuth: Handle = async ({ event, resolve }) => {
	try {
		const auth = initAuth();
		const session = await auth.api.getSession({ headers: event.request.headers });

		if (session) {
			event.locals.session = session.session;
			event.locals.user = session.user;
			event.locals.activeProjectId = session.session.activeOrganizationId ?? null;
		}

		const isPublic = publicRoutes.some((route) => event.url.pathname.startsWith(route));

		if (!session && !isPublic) {
			throw redirect(303, '/login');
		}

		if (session && isPublic && !event.url.pathname.startsWith('/api/')) {
			throw redirect(303, '/');
		}

		return await svelteKitHandler({ event, resolve, auth, building });
	} finally {
		closeRequestDb(event);
	}
};

export const handle: Handle = handleBetterAuth;
