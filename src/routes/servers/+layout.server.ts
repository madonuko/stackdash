import type { LayoutServerLoad } from './$types';
import { listVms } from '$lib/remote/vms.remote';

type ServerStatus = 'running' | 'stopped' | 'restarting' | 'provisioning';

function formatBytes(bytes: number): string {
	if (!bytes) return '0B';
	const gb = bytes / (1024 * 1024 * 1024);
	if (gb >= 1) return `${gb.toFixed(0)}GB`;
	const mb = bytes / (1024 * 1024);
	return `${mb.toFixed(0)}MB`;
}

export const load: LayoutServerLoad = async ({ parent }) => {
	const { currentProject } = await parent();

	if (!currentProject) {
		return { servers: [] };
	}

	const vms = await listVms({ projectId: currentProject.id });
	const servers = vms
		.filter((vm) => vm.active)
		.map((vm) => {
			const ip = vm.live?.networkInterfaces
				? (Object.values(vm.live.networkInterfaces)
						.flatMap((networkInterface) => networkInterface.ipAddresses ?? [])
						.find((address) => address && !address.startsWith('127.') && !address.includes(':')) ??
					'—')
				: '—';
			const ipv6 = vm.live?.networkInterfaces
				? (Object.values(vm.live.networkInterfaces)
						.flatMap((networkInterface) => networkInterface.ipAddresses ?? [])
						.find((address) => address?.includes(':')) ?? '—')
				: '—';

			return {
				id: vm.id,
				name: vm.live?.name ?? vm.id,
				vcpu: vm.live?.cores ?? vm.vmType?.cores ?? 0,
				ram: formatBytes(vm.live?.memory ?? (vm.vmType?.ramCapacity ?? 0) * 1024 * 1024),
				disk: formatBytes(
					vm.live?.disk ?? (vm.vmType?.storageAmount ?? 0) * 1024 * 1024 * 1024
				),
				ip,
				ipv6,
				status:
					vm.status === 'provisioning'
						? 'provisioning'
						: ((vm.live?.status ?? 'stopped') as ServerStatus),
				agentConnected: vm.live?.status === 'running',
				os: vm.vmType?.name ?? 'Unknown',
				region: 'New York',
				created: vm.creationDate,
				uptime: '',
				plan: vm.vmType?.name ?? 'Custom',
				backups: false
			};
		});

	return { servers };
};
