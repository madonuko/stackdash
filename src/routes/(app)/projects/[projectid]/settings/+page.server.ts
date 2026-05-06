import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, parent }) => {
	const { projects } = await parent();
	const project = projects.find((item) => item.id === params.projectid);

	if (!project) {
		error(404, 'Project not found');
	}

	return { project };
};
