import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getVm } from '$lib/remote/vms.remote';
import { toServerInfo } from '../lib/server-summary';

export const load: PageServerLoad = async ({ params, parent }) => {
	const { projectId, servers } = await parent();
	const fallbackServer = servers[0];

	if (!projectId) {
		error(404, 'Project not found');
	}

	const vm = await getVm({ vmId: params.id });

	if (!vm.active || vm.ownerProjectId !== projectId) {
		if (fallbackServer) {
			throw redirect(303, `/servers/${fallbackServer.id}?projectId=${projectId}`);
		}

		error(404, 'Server not found');
	}

	const server = toServerInfo(vm);

	if (!servers.some((listedServer) => listedServer.id === server.id)) {
		if (fallbackServer) {
			throw redirect(303, `/servers/${fallbackServer.id}?projectId=${projectId}`);
		}

		error(404, 'Server not found');
	}

	return {
		server
	};
};
