import { redirect, type Handle } from '@sveltejs/kit';
import { building } from '$app/environment';
import { initAuth } from '$lib/server/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';

const ACTIVE_PROJECT_COOKIE = 'stack-active-project-id';
const publicRoutes = ['/login', '/register', '/signup', '/api/'];

const handleBetterAuth: Handle = async ({ event, resolve }) => {
	const auth = initAuth();
	const session = await auth.api.getSession({ headers: event.request.headers });
	event.locals.activeProjectId = event.cookies.get(ACTIVE_PROJECT_COOKIE) ?? null;

	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;
	}

	const isPublic = publicRoutes.some((route) => event.url.pathname.startsWith(route));

	if (!session && !isPublic) {
		throw redirect(303, '/login');
	}

	if (session && isPublic && !event.url.pathname.startsWith('/api/')) {
		throw redirect(303, '/');
	}

	return svelteKitHandler({ event, resolve, auth, building });
};

export const handle: Handle = handleBetterAuth;
