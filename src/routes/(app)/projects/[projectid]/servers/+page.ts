import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent }) => {
	const { projectId } = await parent();

	if (!projectId) {
		return { hasServers: false };
	}

	return { hasServers: false };
};
