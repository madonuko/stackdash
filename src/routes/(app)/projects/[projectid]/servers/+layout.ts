import type { LayoutLoad } from './$types';
import type { ServerInfo } from './lib/server-summary';

export const load: LayoutLoad = async ({ parent }) => {
	const { project } = await parent();

	if (!project) {
		return { projectId: null, servers: [] as ServerInfo[] };
	}

	return {
		projectId: project.id,
		servers: [] as ServerInfo[]
	};
};
