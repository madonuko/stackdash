import type { LayoutServerLoad } from './$types';
import { listVms } from '$lib/remote/vms.remote';
import { toServerInfo } from './lib/server-summary';

export const load: LayoutServerLoad = async ({ parent }) => {
	const { project } = await parent();

	if (!project) {
		return { projectId: null, servers: [] };
	}

	const vms = await listVms({ projectId: project.id });
	const servers = vms.filter((vm) => vm.active).map(toServerInfo);

	return {
		projectId: project.id,
		servers
	};
};
