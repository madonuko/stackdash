import type { PageServerLoad } from './$types';
import { listImages, listProxmoxIsos } from '$lib/remote/images.remote';
import { requireFeatureFlag } from '$lib/server/feature-flags';

export const load: PageServerLoad = async () => {
	await requireFeatureFlag('images');

	const [images, proxmoxIsos] = await Promise.all([listImages(), listProxmoxIsos()]);

	return {
		images,
		proxmoxIsos
	};
};
