import { ProxmoxClient } from './client';
import type { PveClusterResource } from './types';
import type { VmBackend, VmInfo, VmCreateParams, VmCreateResult, VmStatus } from '../types';

interface ResolvedVm {
	node: string;
	vmid: number;
}

export class ProxmoxBackend implements VmBackend {
	readonly name = 'proxmox' as const;
	private client: ProxmoxClient;

	constructor(client: ProxmoxClient) {
		this.client = client;
	}

	private mapStatus(status: string): VmStatus {
		switch (status) {
			case 'running':
				return 'running';
			case 'stopped':
				return 'stopped';
			case 'paused':
				return 'paused';
			default:
				return 'unknown';
		}
	}

	private async resolve(id: string): Promise<ResolvedVm> {
		const resources = await this.client.getClusterResources('vm');
		const match = resources.find((r) => r.type === 'qemu' && r.name === id);

		if (!match || !match.node || match.vmid == null) {
			throw new Error(`VM "${id}" not found on any Proxmox node`);
		}

		return { node: match.node, vmid: match.vmid };
	}

	private resourceToInfo(r: PveClusterResource): VmInfo {
		return {
			id: r.name ?? String(r.vmid),
			name: r.name ?? `VM ${r.vmid}`,
			status: this.mapStatus(r.status ?? 'unknown'),
			cores: r.maxcpu ?? 0,
			memory: r.maxmem ?? 0,
			disk: r.maxdisk ?? 0,
			uptime: r.uptime ?? 0
		};
	}

	async listVms(): Promise<VmInfo[]> {
		const resources = await this.client.getClusterResources('vm');
		return resources.filter((r) => r.type === 'qemu').map((r) => this.resourceToInfo(r));
	}

	async getVm(id: string): Promise<VmInfo> {
		const { node, vmid } = await this.resolve(id);
		const status = await this.client.getQemuVm(node, vmid);

		let networkInterfaces: VmInfo['networkInterfaces'] | undefined;
		if (status.status === 'running') {
			try {
				const ifaces = await this.client.getNetworkInterfaces(node, vmid);
				networkInterfaces = {};
				for (const iface of ifaces) {
					networkInterfaces[iface.name] = {
						ipAddresses: iface['ip-addresses']?.map((a) => a['ip-address'])
					};
				}
			} catch {
				// guest agent may not be installed
			}
		}

		return {
			id,
			name: status.name ?? `VM ${status.vmid}`,
			status: this.mapStatus(status.status),
			cores: status.cpus ?? 0,
			memory: status.maxmem ?? 0,
			disk: status.maxdisk ?? 0,
			uptime: status.uptime ?? 0,
			networkInterfaces
		};
	}

	async createVm(params: VmCreateParams): Promise<VmCreateResult> {
		const nodes = await this.client.listNodes();
		const node = nodes.find((n) => n.status === 'online');
		if (!node) throw new Error('No online Proxmox nodes available');

		const vmid = await this.client.getNextVmId();

		const sshKeysEncoded = params.sshKeys
			? encodeURIComponent(params.sshKeys.join('\n'))
			: undefined;

		const upid = await this.client.createQemuVm(node.node, {
			vmid,
			name: params.id,
			cores: params.cores,
			sockets: 1,
			memory: params.memoryMb,
			cpu: 'host',
			ostype: 'l26',
			scsihw: 'virtio-scsi-single',
			scsi0: `local-lvm:${params.diskGb}`,
			net0: 'virtio,bridge=vmbr0',
			boot: 'order=scsi0',
			...(params.imageId ? { ide2: `${params.imageId},media=cdrom` } : {}),
			...(sshKeysEncoded ? { sshkeys: sshKeysEncoded, ciuser: 'root' } : {}),
			...(sshKeysEncoded ? { ipconfig0: 'ip=dhcp' } : {})
		});

		return { id: params.id, taskId: upid };
	}

	async deleteVm(id: string): Promise<void> {
		const { node, vmid } = await this.resolve(id);

		try {
			const status = await this.client.getQemuVm(node, vmid);
			if (status.status === 'running') {
				const stopUpid = await this.client.stopVm(node, vmid);
				await this.client.waitForTask(node, stopUpid);
			}
		} catch {
			// already stopped or gone
		}

		const upid = await this.client.deleteQemuVm(node, vmid);
		await this.client.waitForTask(node, upid);
	}

	async startVm(id: string): Promise<void> {
		const { node, vmid } = await this.resolve(id);
		const upid = await this.client.startVm(node, vmid);
		await this.client.waitForTask(node, upid);
	}

	async stopVm(id: string): Promise<void> {
		const { node, vmid } = await this.resolve(id);
		const upid = await this.client.shutdownVm(node, vmid);
		await this.client.waitForTask(node, upid);
	}

	async killVm(id: string): Promise<void> {
		const { node, vmid } = await this.resolve(id);
		const upid = await this.client.stopVm(node, vmid);
		await this.client.waitForTask(node, upid);
	}

	async rebootVm(id: string): Promise<void> {
		const { node, vmid } = await this.resolve(id);
		const upid = await this.client.rebootVm(node, vmid);
		await this.client.waitForTask(node, upid);
	}
}
