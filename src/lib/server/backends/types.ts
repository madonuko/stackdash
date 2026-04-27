export type VmStatus = 'running' | 'stopped' | 'paused' | 'unknown';

export interface VmInfo {
	id: string;
	proxmoxId?: number;
	name: string;
	status: VmStatus;
	cores: number;
	memory: number;
	disk: number;
	uptime: number;
	networkInterfaces?: Record<string, { ipAddresses?: string[] }>;
}

export interface VmCreateParams {
	id: string;
	name: string;
	proxmoxId?: number;
	cores: number;
	memoryMb: number;
	diskGb: number;
	imageId?: string;
	imageSource?: string;
	sshKeys?: string[];
	/** Called when async provisioning (e.g. image import) finishes or fails. */
	onProvisionSettled?: (result: { ok: boolean; error?: string }) => void;
}

export interface VmCreateResult {
	id: string;
	proxmoxId?: number;
	taskId?: string;
}

export interface VmBackend {
	readonly name: string;
	listVms(): Promise<VmInfo[]>;
	getVm(id: string, proxmoxId?: number): Promise<VmInfo>;
	createVm(params: VmCreateParams): Promise<VmCreateResult>;
	deleteVm(id: string, proxmoxId?: number): Promise<void>;
	startVm(id: string, proxmoxId?: number): Promise<void>;
	stopVm(id: string, proxmoxId?: number): Promise<void>;
	killVm(id: string, proxmoxId?: number): Promise<void>;
	rebootVm(id: string, proxmoxId?: number): Promise<void>;
}
