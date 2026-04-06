import ky, { type KyInstance } from 'ky';
import type {
	PveResponse,
	PveNode,
	PveQemuVm,
	PveQemuConfig,
	PveQemuStatus,
	PveStorage,
	PveTaskStatus,
	PveNextId,
	PveCreateQemuParams,
	PveClusterResource,
	PveAgentNetworkInterface
} from './types';

export interface ProxmoxClientConfig {
	baseUrl: string;
	tokenId: string;
	tokenSecret: string;
	verifySsl?: boolean;
}

export class ProxmoxClient {
	private api: KyInstance;

	constructor(config: ProxmoxClientConfig) {
		const { baseUrl, tokenId, tokenSecret } = config;

		this.api = ky.create({
			prefix: `${baseUrl.replace(/\/+$/, '')}/api2/json`,
			headers: {
				Authorization: `PVEAPIToken=${tokenId}=${tokenSecret}`
			},
			timeout: 30_000
		});
	}

	// Nodes

	async listNodes(): Promise<PveNode[]> {
		const res = await this.api.get('nodes').json<PveResponse<PveNode[]>>();
		return res.data;
	}

	async getNode(node: string): Promise<PveNode> {
		const nodes = await this.listNodes();
		const found = nodes.find((n) => n.node === node);
		if (!found) throw new Error(`Proxmox node "${node}" not found`);
		return found;
	}

	// QEMU VMs

	async listQemuVms(node: string): Promise<PveQemuVm[]> {
		const res = await this.api
			.get(`nodes/${encodeURIComponent(node)}/qemu`)
			.json<PveResponse<PveQemuVm[]>>();
		return res.data;
	}

	async getQemuVm(node: string, vmid: number): Promise<PveQemuStatus> {
		const res = await this.api
			.get(`nodes/${encodeURIComponent(node)}/qemu/${vmid}/status/current`)
			.json<PveResponse<PveQemuStatus>>();
		return res.data;
	}

	async getQemuConfig(node: string, vmid: number): Promise<PveQemuConfig> {
		const res = await this.api
			.get(`nodes/${encodeURIComponent(node)}/qemu/${vmid}/config`)
			.json<PveResponse<PveQemuConfig>>();
		return res.data;
	}

	async createQemuVm(node: string, params: PveCreateQemuParams): Promise<string> {
		const res = await this.api
			.post(`nodes/${encodeURIComponent(node)}/qemu`, { json: params })
			.json<PveResponse<string>>();
		return res.data;
	}

	async deleteQemuVm(node: string, vmid: number): Promise<string> {
		const res = await this.api
			.delete(`nodes/${encodeURIComponent(node)}/qemu/${vmid}`)
			.json<PveResponse<string>>();
		return res.data;
	}

	// VM power actions

	async startVm(node: string, vmid: number): Promise<string> {
		const res = await this.api
			.post(`nodes/${encodeURIComponent(node)}/qemu/${vmid}/status/start`)
			.json<PveResponse<string>>();
		return res.data;
	}

	async stopVm(node: string, vmid: number): Promise<string> {
		const res = await this.api
			.post(`nodes/${encodeURIComponent(node)}/qemu/${vmid}/status/stop`)
			.json<PveResponse<string>>();
		return res.data;
	}

	async shutdownVm(node: string, vmid: number): Promise<string> {
		const res = await this.api
			.post(`nodes/${encodeURIComponent(node)}/qemu/${vmid}/status/shutdown`)
			.json<PveResponse<string>>();
		return res.data;
	}

	async rebootVm(node: string, vmid: number): Promise<string> {
		const res = await this.api
			.post(`nodes/${encodeURIComponent(node)}/qemu/${vmid}/status/reboot`)
			.json<PveResponse<string>>();
		return res.data;
	}

	// Storage

	async listStorage(node: string): Promise<PveStorage[]> {
		const res = await this.api
			.get(`nodes/${encodeURIComponent(node)}/storage`)
			.json<PveResponse<PveStorage[]>>();
		return res.data;
	}

	// Tasks

	async getTaskStatus(node: string, upid: string): Promise<PveTaskStatus> {
		const res = await this.api
			.get(`nodes/${encodeURIComponent(node)}/tasks/${encodeURIComponent(upid)}/status`)
			.json<PveResponse<PveTaskStatus>>();
		return res.data;
	}

	async waitForTask(
		node: string,
		upid: string,
		opts?: { intervalMs?: number; timeoutMs?: number }
	): Promise<PveTaskStatus> {
		const interval = opts?.intervalMs ?? 1_000;
		const timeout = opts?.timeoutMs ?? 120_000;
		const deadline = Date.now() + timeout;

		while (Date.now() < deadline) {
			const status = await this.getTaskStatus(node, upid);
			if (status.status === 'stopped') {
				if (status.exitstatus && status.exitstatus !== 'OK') {
					throw new Error(`Proxmox task failed: ${status.exitstatus} (UPID: ${upid})`);
				}
				return status;
			}
			await new Promise((r) => setTimeout(r, interval));
		}

		throw new Error(`Proxmox task timed out after ${timeout}ms (UPID: ${upid})`);
	}

	// Cluster

	async getNextVmId(): Promise<number> {
		const res = await this.api.get('cluster/nextid').json<PveResponse<PveNextId>>();
		return typeof res.data === 'string' ? parseInt(res.data, 10) : res.data;
	}

	async getClusterResources(type?: 'vm' | 'storage' | 'node'): Promise<PveClusterResource[]> {
		const searchParams: Record<string, string> = {};
		if (type) searchParams['type'] = type;

		const res = await this.api
			.get('cluster/resources', { searchParams })
			.json<PveResponse<PveClusterResource[]>>();
		return res.data;
	}

	// Guest agent

	async getNetworkInterfaces(
		node: string,
		vmid: number
	): Promise<PveAgentNetworkInterface[]> {
		const res = await this.api
			.get(
				`nodes/${encodeURIComponent(node)}/qemu/${vmid}/agent/network-get-interfaces`
			)
			.json<PveResponse<{ result: PveAgentNetworkInterface[] }>>();
		return res.data.result;
	}
}
