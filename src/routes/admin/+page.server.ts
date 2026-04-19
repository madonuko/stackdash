import { getRequestEvent } from '$app/server';
import type { PageServerLoad } from './$types';
import { listVmTypes } from '$lib/remote/vm-types.remote';
import { listImages } from '$lib/remote/images.remote';
import { initDrizzle } from '$lib/server/db';
import { requireAdmin } from '$lib/server/auth-context';

export const load: PageServerLoad = async () => {
	const event = getRequestEvent();
	const userId = event?.locals.user?.id;

	if (!userId) {
		return {
			vmTypes: [],
			images: []
		};
	}

	await requireAdmin(initDrizzle(), userId);

	const [vmTypes, images] = await Promise.all([listVmTypes(), listImages()]);

	return {
		vmTypes,
		images
	};
};
