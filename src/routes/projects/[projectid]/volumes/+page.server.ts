import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { listVolumes } from '$lib/remote/volumes.remote';
import { listVms } from '$lib/remote/vms.remote';
import { requireFeatureFlag } from '$lib/server/feature-flags';

export const load: PageServerLoad = async ({ parent }) => {
	await requireFeatureFlag('volumes');

	const { project } = await parent();

	if (!project) {
		error(404, 'Project not found');
	}

	const [volumes, vms] = await Promise.all([
		listVolumes({ projectId: project.id }),
		listVms({ projectId: project.id })
	]);

	return {
		volumes,
		vms
	};
};
