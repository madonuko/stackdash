import type { PageServerLoad } from './$types';
import { requireFeatureFlag } from '$lib/server/feature-flags';

export const load: PageServerLoad = async () => {
	await requireFeatureFlag('colocation');
};
