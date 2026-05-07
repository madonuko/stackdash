import type { PageServerLoad } from './$types';
import { listImages } from '$lib/remote/images.remote';
import { requireFeatureFlag } from '$lib/server/feature-flags';

export const load: PageServerLoad = async () => {
	await requireFeatureFlag('images');

	const images = await listImages();

	return {
		images
	};
};
