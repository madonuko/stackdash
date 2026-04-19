import type { PageServerLoad } from './$types';
import { listVmTypes } from '$lib/remote/vm-types.remote';
import { listImages } from '$lib/remote/images.remote';

export const load: PageServerLoad = async () => {
	const [vmTypes, images] = await Promise.all([listVmTypes(), listImages()]);

	return {
		vmTypes,
		images
	};
};
