import type { Handle } from '@sveltejs/kit';
import { building } from '$app/environment';
import { initAuth } from '$lib/server/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';

const ACTIVE_PROJECT_COOKIE = 'stack-active-project-id';

const handleBetterAuth: Handle = async ({ event, resolve }) => {
	const auth = initAuth();
	const session = await auth.api.getSession({ headers: event.request.headers });
	event.locals.activeProjectId = event.cookies.get(ACTIVE_PROJECT_COOKIE) ?? null;

	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;
	}

	return svelteKitHandler({ event, resolve, auth, building });
};

export const handle: Handle = handleBetterAuth;
