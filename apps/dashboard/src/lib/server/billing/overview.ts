import { and, eq } from 'drizzle-orm';
import {
	ensureProjectCustomer,
	getProjectBillingState,
	invalidateProjectBillingState
} from './autumn';
import { meterProjectActiveResources, syncProjectUsage } from './metering';
import { initDrizzle } from '$lib/server/db';
import { billingMeters } from '$lib/server/db/schema';

function statusLabel(status: Awaited<ReturnType<typeof getProjectBillingState>>['status']) {
	if (status === 'active') return 'Ready';
	if (status === 'past_due') return 'Past due';
	if (status === 'failed') return 'Needs attention';
	if (status === 'payment_required') return 'Payment method required';
	if (status === 'provider_unavailable') return 'Billing temporarily unavailable';
	return 'Not set up';
}

export async function refreshProjectBilling(projectId: string) {
	await ensureProjectCustomer(projectId).catch((err) => {
		console.warn(`Failed to refresh Autumn customer for project ${projectId}`, err);
	});
	await meterProjectActiveResources(projectId);
	await syncProjectUsage(projectId);
	invalidateProjectBillingState(projectId);
}

export async function getProjectBillingOverview(projectId: string) {
	const db = initDrizzle();
	const billingState = await getProjectBillingState(projectId);

	const activeResourceRows = await db
		.select({
			id: billingMeters.id,
			resourceType: billingMeters.resourceType,
			featureId: billingMeters.featureId,
			units: billingMeters.units
		})
		.from(billingMeters)
		.where(
			and(
				eq(billingMeters.projectId, projectId),
				eq(billingMeters.resourceType, 'vm'),
				eq(billingMeters.active, true)
			)
		);

	return {
		customer: billingState.customer,
		status: billingState.status,
		statusLabel: statusLabel(billingState.status),
		planLabel: 'Project billing',
		setupRequired:
			billingState.status !== 'active' && billingState.status !== 'provider_unavailable',
		syncError: billingState.syncError,
		lastUpdatedAt: Date.now(),
		activeResourceCount: activeResourceRows.length,
		activeResources: activeResourceRows.map((item) => ({
			id: item.id,
			label: item.featureId,
			resourceType: item.resourceType,
			quantity: Number(item.units),
			unit: 'active'
		}))
	};
}
