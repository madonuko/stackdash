import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { currentProject } = await parent();

	if (!currentProject) {
		return { hasServers: false };
	}

	const { servers } = await parent();

	if (servers.length > 0) {
		throw redirect(303, `/servers/${servers[0].id}`);
	}

	return { hasServers: false };
};
