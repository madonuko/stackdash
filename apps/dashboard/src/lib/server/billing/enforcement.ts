import { and, eq } from 'drizzle-orm';
import { initDrizzle } from '$lib/server/db';
import { projectBillingCustomers, vms } from '$lib/server/db/schema';
import { getBackend } from '$lib/server/backends';
import { getProjectBillingState } from './autumn';

const GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;
const PAST_DUE_STATUSES = new Set(['past_due', 'payment_required']);

async function suspendProjectVms(projectId: string) {
	const db = initDrizzle();
	const activeVms = await db.query.vms.findMany({
		where: and(eq(vms.ownerProjectId, projectId), eq(vms.active, true)),
		columns: { id: true, proxmoxId: true, backend: true }
	});

	let stopped = 0;
	for (const vm of activeVms) {
		try {
			await getBackend(vm.backend).stopVm(vm.id, vm.proxmoxId ?? undefined);
			stopped += 1;
		} catch (err) {
			console.warn(`Failed to suspend VM ${vm.id} for past-due project ${projectId}`, err);
		}
	}

	return stopped;
}

export async function enforceProjectBillingGrace(now = Date.now(), limit = 100) {
	const db = initDrizzle();
	const projects = await db
		.selectDistinct({ projectId: vms.ownerProjectId })
		.from(vms)
		.where(eq(vms.active, true))
		.limit(limit);

	let suspended = 0;
	for (const { projectId } of projects) {
		if (!projectId) continue;

		const state = await getProjectBillingState(projectId, { live: true });
		const customer = await db.query.projectBillingCustomers.findFirst({
			where: eq(projectBillingCustomers.projectId, projectId)
		});

		if (PAST_DUE_STATUSES.has(state.status)) {
			if (customer?.pastDueSince == null) {
				await db
					.update(projectBillingCustomers)
					.set({ pastDueSince: now, updatedAt: now })
					.where(eq(projectBillingCustomers.projectId, projectId));
				continue;
			}

			if (now - customer.pastDueSince >= GRACE_PERIOD_MS) {
				suspended += await suspendProjectVms(projectId);
			}
			continue;
		}

		if (state.status === 'active' && customer?.pastDueSince != null) {
			await db
				.update(projectBillingCustomers)
				.set({ pastDueSince: null, updatedAt: now })
				.where(eq(projectBillingCustomers.projectId, projectId));
		}
	}

	return { checked: projects.length, suspended };
}
