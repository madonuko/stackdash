import type { PageLoad } from './$types';
import { getVmMetricsHistory } from '$lib/remote/vms.remote';

export const load: PageLoad = async ({ params }) => {
	const metricsHistory = await getVmMetricsHistory({ vmId: params.id, timeframe: 'hour' }).catch(
		(error) => {
			console.warn(`Failed to load VM metrics history for ${params.id}`, error);
			return [];
		}
	);

	return { metricsHistory };
};
