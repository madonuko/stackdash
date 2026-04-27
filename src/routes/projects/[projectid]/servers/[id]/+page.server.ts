import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
export const load: PageServerLoad = async ({ params, parent }) => {
	const { projectId, servers } = await parent();
	const fallbackServer = servers[0];

	if (!projectId) {
		error(404, 'Project not found');
	}

	const server = servers.find((listedServer) => listedServer.id === params.id);

	if (!server) {
		if (fallbackServer) {
			throw redirect(303, `/projects/${projectId}/servers/${fallbackServer.id}`);
		}

		error(404, 'Server not found');
	}

	return {
		server
	};
};
