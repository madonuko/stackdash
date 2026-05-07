import {
	createImage,
	deleteImage,
	getProxmoxTaskStatus,
	importProxmoxImageFromUrl,
	listProxmoxImageImportTargets,
	listProxmoxImages,
	updateImage
} from '$lib/remote/images.remote';
import { invalidate } from '$app/navigation';
import { updateFeatureFlag } from '$lib/remote/feature-flags.remote';
import { createVmType, deleteVmType, updateVmType } from '$lib/remote/vm-types.remote';
import { untrack } from 'svelte';
import {
	defaultFeatureFlags,
	featureFlagKeys,
	type FeatureFlagKey,
	type FeatureFlags
} from '$lib/feature-flags';

export type VmIsa = 'x86';

export type VmType = {
	id: string;
	name: string;
	isa: string;
	cores: number;
	ramCapacity: number;
	storageAmount: number;
	rate: string;
	cap: string;
	autumnFeatureId: string | null;
};

export type BaseImage = {
	id: string;
	name: string;
	version: string;
	description: string;
	icon: string | null | undefined;
	color: string;
	isOfficial: boolean;
	logoSvg: string | null | undefined;
	accentColor: string;
	imageType: string;
	filePath: string;
	isa: string;
};

export type PveImage = {
	volid: string;
	filename: string;
	size: number;
	node: string;
	storage: string;
	content: 'import';
	format: string;
};

export type PveImageImportTarget = {
	node: string;
	storage: string;
};

type ImportChecksumAlgorithm = '' | 'md5' | 'sha1' | 'sha224' | 'sha256' | 'sha384' | 'sha512';
type ImportTask = {
	node: string;
	storage: string;
	upid: string;
	status: 'starting' | 'running' | 'stopped';
	exitstatus?: string;
};

export type AdminPageData = {
	vmTypes?: VmType[];
	images?: BaseImage[];
	featureFlags?: FeatureFlags;
};

export const colorOptions = [
	'bg-blue-500',
	'bg-sky-600',
	'bg-red-700',
	'bg-orange-600',
	'bg-yellow-600',
	'bg-indigo-600',
	'bg-cyan-700',
	'bg-red-600',
	'bg-emerald-600',
	'bg-purple-600',
	'bg-pink-600',
	'bg-gray-600'
];

function toIsa(value: string): VmIsa {
	return 'x86';
}

function createFeatureFlagSaving() {
	return Object.fromEntries(featureFlagKeys.map((key) => [key, false])) as Record<
		FeatureFlagKey,
		boolean
	>;
}

export class AdminState {
	vmTypes = $state<VmType[]>([]);
	images = $state<BaseImage[]>([]);
	featureFlags = $state<FeatureFlags>({ ...defaultFeatureFlags });
	featureFlagSaving = $state<Record<FeatureFlagKey, boolean>>(createFeatureFlagSaving());
	featureFlagError = $state('');
	featureFlagSyncCooldowns = $state<Partial<Record<FeatureFlagKey, number>>>({});
	vtDialogOpen = $state(false);
	vtEditing = $state<VmType | null>(null);
	vtSaving = $state(false);
	vtError = $state('');
	vtName = $state('');
	vtIsa = $state<VmIsa>('x86');
	vtCores = $state(1);
	vtRam = $state(512);
	vtStorage = $state(10);
	vtRate = $state('0.00');
	vtCap = $state('5.00');
	vtAutumnFeatureId = $state('');
	pveImages = $state<PveImage[]>([]);
	pveImageImportTargets = $state<PveImageImportTarget[]>([]);
	isoLoading = $state(false);
	isoError = $state('');
	importDialogOpen = $state(false);
	importUrl = $state('');
	importFilename = $state('');
	importStorage = $state('local');
	importChecksumAlgorithm = $state<ImportChecksumAlgorithm>('');
	importChecksum = $state('');
	importVerifyCertificates = $state(true);
	importSaving = $state(false);
	importError = $state('');
	importTasks = $state<ImportTask[]>([]);
	imgDialogOpen = $state(false);
	imgEditing = $state<BaseImage | null>(null);
	imgSaving = $state(false);
	imgError = $state('');
	imgName = $state('');
	imgVersion = $state('');
	imgDescription = $state('');
	imgIcon = $state('');
	imgColor = $state('bg-gray-600');
	imgIsOfficial = $state(false);
	imgLogoSvg = $state('');
	imgAccentColor = $state('#6b7280');
	imgFilePath = $state('');
	imgIsa = $state<VmIsa>('x86');

	sync(data: AdminPageData) {
		this.vmTypes = [...(data.vmTypes ?? [])];
		this.images = [...(data.images ?? [])];
		const incoming = data.featureFlags ?? { ...defaultFeatureFlags };
		this.featureFlags = untrack(() =>
			Object.fromEntries(
				featureFlagKeys.map((key) => [
					key,
					this.featureFlagSyncCooldowns[key] && Date.now() < this.featureFlagSyncCooldowns[key]
						? this.featureFlags[key]
						: incoming[key]
				])
			)
		) as FeatureFlags;
	}

	async toggleFeatureFlag(flag: FeatureFlagKey, enabled: boolean) {
		const previousEnabled = this.featureFlags[flag];
		this.featureFlagError = '';
		this.featureFlagSaving[flag] = true;
		this.featureFlagSyncCooldowns[flag] = Date.now() + 2000;
		this.featureFlags = { ...this.featureFlags, [flag]: enabled };
		try {
			await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
			const result = await updateFeatureFlag({ flag, enabled });
			this.featureFlags = result.featureFlags;
			await invalidate('app:feature-flags');
		} catch (err) {
			this.featureFlags = { ...this.featureFlags, [flag]: previousEnabled };
			this.featureFlagError = err instanceof Error ? err.message : 'Failed to update feature flag';
		} finally {
			this.featureFlagSaving[flag] = false;
		}
	}

	vtOpenCreate() {
		this.vtEditing = null;
		this.vtName = '';
		this.vtIsa = 'x86';
		this.vtCores = 1;
		this.vtRam = 512;
		this.vtStorage = 10;
		this.vtRate = '0.00';
		this.vtCap = '5.00';
		this.vtAutumnFeatureId = '';
		this.vtError = '';
		this.vtDialogOpen = true;
	}

	vtOpenEdit(vt: VmType) {
		this.vtEditing = vt;
		this.vtName = vt.name;
		this.vtIsa = toIsa(vt.isa);
		this.vtCores = vt.cores;
		this.vtRam = vt.ramCapacity;
		this.vtStorage = vt.storageAmount;
		this.vtRate = vt.rate;
		this.vtCap = vt.cap;
		this.vtAutumnFeatureId = vt.autumnFeatureId ?? '';
		this.vtError = '';
		this.vtDialogOpen = true;
	}

	async vtSave() {
		if (!this.vtName.trim()) return;
		this.vtSaving = true;
		this.vtError = '';
		try {
			const data = {
				name: this.vtName.trim(),
				isa: this.vtIsa,
				cores: this.vtCores,
				ramCapacity: this.vtRam,
				storageAmount: this.vtStorage,
				rate: this.vtRate,
				cap: this.vtCap,
				autumnFeatureId: this.vtAutumnFeatureId.trim()
			};

			if (this.vtEditing) {
				await updateVmType({ vmTypeId: this.vtEditing.id, ...data });
				const index = this.vmTypes.findIndex((vmType) => vmType.id === this.vtEditing?.id);
				if (index !== -1) this.vmTypes[index] = { ...this.vmTypes[index], ...data };
			} else {
				const result = await createVmType(data);
				this.vmTypes.push({ id: result.id, ...data });
			}

			this.vtDialogOpen = false;
		} catch (err) {
			this.vtError = err instanceof Error ? err.message : 'Failed to save';
		} finally {
			this.vtSaving = false;
		}
	}

	async vtRemove(id: string) {
		try {
			await deleteVmType({ vmTypeId: id });
			this.vmTypes = this.vmTypes.filter((vmType) => vmType.id !== id);
		} catch (err) {
			alert(err instanceof Error ? err.message : 'Failed to delete');
		}
	}

	async loadPveImages() {
		this.isoLoading = true;
		this.isoError = '';
		try {
			const [images, targets] = await Promise.all([
				listProxmoxImages().run(),
				listProxmoxImageImportTargets().run()
			]);
			this.pveImages = images;
			this.pveImageImportTargets = targets;
		} catch (err) {
			this.isoError = err instanceof Error ? err.message : 'Failed to scan Proxmox images';
		} finally {
			this.isoLoading = false;
		}
	}

	async loadPveIsos() {
		await this.loadPveImages();
	}

	imgImportOpen() {
		this.importUrl = '';
		this.importFilename = '';
		this.importChecksumAlgorithm = '';
		this.importChecksum = '';
		this.importVerifyCertificates = true;
		this.importSaving = false;
		this.importError = '';
		this.importStorage = 'local';
		this.importTasks = [];
		this.importDialogOpen = true;
		this.loadPveImages();
	}

	imgImportClose() {
		if (this.importSaving) return;
		this.importDialogOpen = false;
	}

	importFilenameFromUrl() {
		const fallback = this.importUrl.split('/').pop()?.split('?')[0]?.split('#')[0] ?? '';
		try {
			const url = new URL(this.importUrl);
			this.importFilename = decodeURIComponent(url.pathname.split('/').pop() || fallback);
		} catch {
			this.importFilename = decodeURIComponent(fallback);
		}
		return this.importFilename;
	}

	private waitForTaskPoll() {
		return new Promise<void>((resolve) => setTimeout(resolve, 1500));
	}

	async importImageFromUrl() {
		if (!this.importUrl.trim()) return;
		if (!this.importFilename.trim()) this.importFilenameFromUrl();
		if (!this.importFilename.trim()) return;

		this.importSaving = true;
		this.importError = '';
		this.importTasks = [];
		try {
			const result = await importProxmoxImageFromUrl({
				storage: this.importStorage,
				url: this.importUrl.trim(),
				filename: this.importFilename.trim(),
				checksumAlgorithm: this.importChecksumAlgorithm || undefined,
				checksum: this.importChecksum.trim() || undefined,
				verifyCertificates: this.importVerifyCertificates
			});
			this.importStorage = result.storage;
			this.importTasks = result.tasks.map((task) => ({ ...task, status: 'starting' as const }));

			while (true) {
				await this.waitForTaskPoll();
				const statuses = await Promise.all(
					this.importTasks.map(async (task) => {
						if (task.status === 'stopped') return task;
						const status = await getProxmoxTaskStatus({ node: task.node, upid: task.upid }).run();
						return { ...task, status: status.status, exitstatus: status.exitstatus };
					})
				);
				this.importTasks = statuses;
				const failed = statuses.find((task) => task.exitstatus && task.exitstatus !== 'OK');
				if (failed) throw new Error(`Import failed on ${failed.node}: ${failed.exitstatus}`);
				if (statuses.every((task) => task.status === 'stopped')) {
					await this.loadPveImages();
					this.importDialogOpen = false;
					break;
				}
			}
		} catch (err) {
			this.importError = err instanceof Error ? err.message : 'Failed to import image';
		} finally {
			this.importSaving = false;
		}
	}

	imgOpenCreate() {
		this.imgEditing = null;
		this.imgName = '';
		this.imgVersion = '';
		this.imgDescription = '';
		this.imgIcon = '';
		this.imgColor = 'bg-gray-600';
		this.imgIsOfficial = false;
		this.imgLogoSvg = '';
		this.imgAccentColor = '#6b7280';
		this.imgFilePath = '';
		this.imgIsa = 'x86';
		this.imgError = '';
		this.imgDialogOpen = true;
		if (this.pveImages.length === 0) this.loadPveImages();
	}

	imgOpenEdit(img: BaseImage) {
		this.imgEditing = img;
		this.imgName = img.name;
		this.imgVersion = img.version;
		this.imgDescription = img.description;
		this.imgIcon = img.icon ?? '';
		this.imgColor = img.color;
		this.imgIsOfficial = img.isOfficial;
		this.imgLogoSvg = img.logoSvg ?? '';
		this.imgAccentColor = img.accentColor;
		this.imgFilePath = img.filePath;
		this.imgIsa = 'x86';
		this.imgError = '';
		this.imgDialogOpen = true;
		if (this.pveImages.length === 0) this.loadPveImages();
	}

	async imgSave() {
		const selectedImage = this.pveImages.find((image) => image.volid === this.imgFilePath);
		if (!this.imgName.trim() || !selectedImage) return;
		this.imgSaving = true;
		this.imgError = '';
		try {
			const icon = this.imgIcon.trim();
			const logoSvg = this.imgLogoSvg.trim();
			const data = {
				name: this.imgName.trim(),
				version: this.imgVersion.trim(),
				description: this.imgDescription.trim(),
				color: this.imgColor,
				isOfficial: this.imgIsOfficial,
				accentColor: this.imgAccentColor.trim() || '#6b7280',
				filePath: selectedImage.volid,
				isa: 'x86' as const,
				...(icon ? { icon } : {}),
				...(this.imgIsOfficial && logoSvg ? { logoSvg } : {})
			};
			const localData = {
				...data,
				icon: icon || null,
				logoSvg: this.imgIsOfficial ? logoSvg || null : null,
				imageType: selectedImage.format || 'qcow2'
			};

			if (this.imgEditing) {
				await updateImage({ imageId: this.imgEditing.id, ...data });
				const index = this.images.findIndex((image) => image.id === this.imgEditing?.id);
				if (index !== -1) this.images[index] = { ...this.images[index], ...localData };
			} else {
				const result = await createImage(data);
				this.images.push({ id: result.id, ...localData });
			}

			this.imgDialogOpen = false;
		} catch (err) {
			this.imgError = err instanceof Error ? err.message : 'Failed to save';
		} finally {
			this.imgSaving = false;
		}
	}

	async imgRemove(id: string) {
		try {
			await deleteImage({ imageId: id });
			this.images = this.images.filter((image) => image.id !== id);
		} catch (err) {
			alert(err instanceof Error ? err.message : 'Failed to delete');
		}
	}
}
