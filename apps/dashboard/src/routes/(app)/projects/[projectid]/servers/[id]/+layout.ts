import type { LayoutLoad } from './$types';
import type { ServerInfo } from '../lib/server-summary';
import { error } from '@sveltejs/kit';
import { getVm } from '$lib/remote/vms.remote';
import { vpsServerTabFeatureFlags } from '$lib/feature-flags';
import { toServerInfo } from '../lib/server-summary';

export const load: LayoutLoad = async ({ params, parent, url }) => {
	const { featureFlags, projectId } = await parent();
	const tab = url.pathname.split('/').pop();
	const featureFlag = vpsServerTabFeatureFlags[tab as keyof typeof vpsServerTabFeatureFlags];

	if (featureFlag && !featureFlags[featureFlag]) {
		error(404, 'Not found');
	}

	if (!projectId) {
		error(404, 'Project not found');
	}

	const vm = await getVm({ vmId: params.id });

	if (vm.ownerProjectId !== projectId) error(404, `VM "${params.id}" not found`);

	const server = toServerInfo(vm);

	return {
		server: server as ServerInfo,
		serverId: params.id
	};
};
