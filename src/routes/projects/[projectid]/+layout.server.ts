import { error, redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { listVms } from '$lib/remote/vms.remote';

export const load: LayoutServerLoad = async ({ params, parent }) => {
	const { user, projects } = await parent();

	if (!user) {
		throw redirect(303, '/login');
	}

	const project = projects.find((p) => p.id === params.projectid);

	if (!project) {
		error(404, 'Project not found');
	}

	const vms = await listVms({ projectId: project.id });

	return {
		project,
		vms
	};
};
