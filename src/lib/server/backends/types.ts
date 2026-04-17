export type VmStatus = 'running' | 'stopped' | 'paused' | 'unknown';

export interface VmInfo {
	id: string;
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
	cores: number;
	memoryMb: number;
	diskGb: number;
	imageId?: string;
	sshKeys?: string[];
	/** Called when async provisioning (e.g. image import) finishes or fails. */
	onProvisionSettled?: (result: { ok: boolean; error?: string }) => void;
}

export interface VmCreateResult {
	id: string;
	taskId?: string;
}

export interface VmBackend {
	readonly name: string;
	listVms(): Promise<VmInfo[]>;
	getVm(id: string): Promise<VmInfo>;
	createVm(params: VmCreateParams): Promise<VmCreateResult>;
	deleteVm(id: string): Promise<void>;
	startVm(id: string): Promise<void>;
	stopVm(id: string): Promise<void>;
	killVm(id: string): Promise<void>;
	rebootVm(id: string): Promise<void>;
}
