import type { LayoutLoad } from './$types';
import type { ServerInfo } from '../lib/server-summary';
import { error } from '@sveltejs/kit';
import { listVms } from '$lib/remote/vms.remote';
import { toServerInfo } from '../lib/server-summary';

export const load: LayoutLoad = async ({ params, parent }) => {
	const { projectId } = await parent();

	if (!projectId) {
		error(404, 'Project not found');
	}

	const vms = await listVms({ projectId }).run();
	const vm = vms.find((item) => item.id === params.id);

	if (!vm) {
		error(404, `VM "${params.id}" not found`);
	}

	const server = toServerInfo(vm);

	return {
		server: server as ServerInfo,
		serverId: params.id
	};
};
