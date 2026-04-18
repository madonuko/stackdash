<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { officialImages, type OfficialImage } from '$lib/data/images';
	import { listVmTypes } from '$lib/remote/vm-types.remote';
	import { listImages } from '$lib/remote/images.remote';
	import {
		ArrowLeft,
		HardDrive,
		Server,
		Globe,
		Key,
		Loader2,
		Check,
		Circle,
		HardDriveUpload
	} from '@lucide/svelte';

	let { data } = $props();

	type VmType = {
		id: string;
		name: string;
		cores: number;
		ramCapacity: number;
		storageAmount: number;
		rate: string;
		cap: string;
	};

	type DbImage = {
		id: string;
		name: string;
		version: string;
		shortName: string;
		color: string;
		icon: string | null;
		filePath: string;
		description: string;
	};

	let vmTypes = $state<VmType[]>([]);
	let dbImages = $state<DbImage[]>([]);
	let loadingVmTypes = $state(true);
	let loadingImages = $state(true);

	let serverName = $state('');
	let selectedImageId = $state<string | null>(null);
	let selectedImageVersion = $state<string | null>(null);
	let selectedPlanId = $state<string | null>(null);
	let networkingOption = $state<'both' | 'ipv4' | 'ipv6' | 'none'>('both');
	let selectedSshKeyIds = $state<string[]>([]);
	let selectedVolumeIds = $state<string[]>([]);

	let creating = $state(false);
	let createError = $state('');

	let selectedImage = $derived(officialImages.find((i) => i.id === selectedImageId) ?? null);
	let selectedImageVersionObj = $derived(
		selectedImage?.versions.find((v) => v.version === selectedImageVersion) ?? null
	);
	let selectedPlan = $derived(vmTypes.find((t) => t.id === selectedPlanId) ?? null);

	type Section = {
		id: string;
		label: string;
		icon: typeof Server;
		isComplete: boolean;
	};

	let sections = $derived<Section[]>([
		{ id: 'name', label: 'Name', icon: Server, isComplete: serverName.trim().length > 0 },
		{
			id: 'image',
			label: 'Image',
			icon: HardDrive,
			isComplete: selectedImageId !== null && selectedImageVersion !== null
		},
		{ id: 'plan', label: 'Plan', icon: Server, isComplete: selectedPlanId !== null },
		{
			id: 'storage',
			label: 'Storage',
			icon: HardDriveUpload,
			isComplete: selectedPlanId !== null
		},
		{ id: 'networking', label: 'Networking', icon: Globe, isComplete: true },
		{ id: 'ssh', label: 'SSH Keys', icon: Key, isComplete: true }
	]);

	let imagesSearch = $state('');
	let imageTab = $state<'os' | 'snapshots' | 'apps'>('os');

	async function loadVmTypes() {
		loadingVmTypes = true;
		try {
			vmTypes = await listVmTypes({});
		} catch {}
		loadingVmTypes = false;
	}

	async function loadDbImages() {
		loadingImages = true;
		try {
			dbImages = await listImages({});
		} catch {}
		loadingImages = false;
	}

	onMount(() => {
		loadVmTypes();
		loadDbImages();
	});

	function filteredOfficialImages(): OfficialImage[] {
		if (!imagesSearch.trim()) return officialImages;
		const q = imagesSearch.toLowerCase();
		return officialImages.filter(
			(i) =>
				i.name.toLowerCase().includes(q) ||
				i.versions.some((v) => v.version.toLowerCase().includes(q))
		);
	}

	function selectImage(imageId: string) {
		if (selectedImageId === imageId) {
			selectedImageId = null;
			selectedImageVersion = null;
		} else {
			selectedImageId = imageId;
			const img = officialImages.find((i) => i.id === imageId);
			selectedImageVersion = img?.versions[0]?.version ?? null;
		}
	}

	function scrollTosSection(sectionId: string) {
		const el = document.getElementById(`section-${sectionId}`);
		if (el) {
			el.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}
	}

	function formatBytes(bytes: number): string {
		if (!bytes) return '0B';
		const gb = bytes / (1024 * 1024 * 1024);
		if (gb >= 1) return `${gb.toFixed(0)}GB`;
		const mb = bytes / (1024 * 1024);
		return `${mb.toFixed(0)}MB`;
	}

	function formatRam(mb: number): string {
		if (mb >= 1024) return `${(mb / 1024).toFixed(0)}GB`;
		return `${mb}MB`;
	}
</script>

<svelte:head>
	<title>Create Server / Stack</title>
</svelte:head>

<div class="flex h-full flex-col overflow-hidden">
	<div class="flex h-10 shrink-0 items-center justify-between border-b border-fyra-gray-800 px-5">
		<div class="flex items-center gap-3">
			<Button
				variant="ghost"
				size="sm"
				class="h-7 gap-1.5 px-2 text-xs text-fyra-gray-400 hover:text-fyra-gray-200"
				onclick={() => goto('/')}
			>
				<ArrowLeft class="h-3 w-3" />
				Back
			</Button>
			<span class="text-sm font-semibold text-fyra-gray-100">Create Server</span>
		</div>
	</div>

	<div class="flex flex-1 overflow-hidden">
		<div class="flex-1 overflow-y-auto">
			<div class="mx-auto max-w-3xl px-6 py-6">
				<div class="flex flex-col gap-8">
					<div id="section-name" class="scroll-mt-4">
						<div class="flex items-center gap-2 border-b border-fyra-gray-800 pb-2">
							<Server class="h-3.5 w-3.5 text-fyra-red-400" />
							<span class="text-xs font-semibold tracking-wider text-fyra-gray-400 uppercase"
								>Name</span
							>
						</div>
						<div class="mt-3">
							<Input bind:value={serverName} placeholder="my-server" class="h-9 text-sm" />
						</div>
					</div>

					<div id="section-image" class="scroll-mt-4">
						<div class="flex items-center gap-2 border-b border-fyra-gray-800 pb-2">
							<HardDrive class="h-3.5 w-3.5 text-fyra-red-400" />
							<span class="text-xs font-semibold tracking-wider text-fyra-gray-400 uppercase"
								>Image</span
							>
						</div>
						<div class="mt-3 flex gap-2">
							<button
								class="border px-3 py-1.5 text-xs font-medium transition-colors {imageTab === 'os'
									? 'border-fyra-red-500 bg-fyra-red-950/20 text-fyra-gray-100'
									: 'border-fyra-gray-700 text-fyra-gray-500 hover:border-fyra-gray-600 hover:text-fyra-gray-300'}"
								onclick={() => (imageTab = 'os')}>OS Images</button
							>
							<button
								class="border px-3 py-1.5 text-xs font-medium transition-colors {imageTab ===
								'snapshots'
									? 'border-fyra-red-500 bg-fyra-red-950/20 text-fyra-gray-100'
									: 'border-fyra-gray-700 text-fyra-gray-500 hover:border-fyra-gray-600 hover:text-fyra-gray-300'}"
								onclick={() => (imageTab = 'snapshots')}>Snapshots</button
							>
							<button
								class="border px-3 py-1.5 text-xs font-medium transition-colors {imageTab === 'apps'
									? 'border-fyra-red-500 bg-fyra-red-950/20 text-fyra-gray-100'
									: 'border-fyra-gray-700 text-fyra-gray-500 hover:border-fyra-gray-600 hover:text-fyra-gray-300'}"
								onclick={() => (imageTab = 'apps')}>Apps</button
							>
						</div>
						{#if imageTab === 'os'}
							<div class="mt-3">
								<div class="relative">
									<input
										bind:value={imagesSearch}
										placeholder="Search images..."
										class="h-8 w-full border border-fyra-gray-700 bg-fyra-gray-800 px-3 text-xs text-fyra-gray-100 placeholder:text-fyra-gray-600 focus:border-fyra-gray-500 focus:outline-none"
									/>
								</div>
								<div class="mt-3 grid grid-cols-2 gap-px bg-fyra-gray-900">
									{#each filteredOfficialImages() as img (img.id)}
										{@const isSelected = selectedImageId === img.id}
										<div class="contents">
											<button
												class="relative flex gap-4 overflow-hidden bg-fyra-gray-900 p-5 text-left transition-colors hover:bg-fyra-gray-800/40 {isSelected
													? 'ring-2 ring-fyra-red-500 ring-inset'
													: ''}"
												onclick={() => selectImage(img.id)}
											>
												<div
													class="pointer-events-none absolute inset-0 opacity-[0.08]"
													style="background: linear-gradient(135deg, {img.iconColor} 0%, transparent 60%)"
												></div>
												<div class="relative shrink-0">
													{#if img.icon}
														<svg viewBox="0 0 24 24" class="h-12 w-12" fill={img.iconColor}>
															<path d={img.icon} />
														</svg>
													{:else}
														<span
															class="flex h-12 w-12 items-center justify-center text-xl font-bold"
															style="color: {img.iconColor}">{img.shortName}</span
														>
													{/if}
												</div>
												<div class="relative flex min-w-0 flex-1 flex-col">
													<span class="text-sm font-semibold text-fyra-gray-50">{img.name}</span>
													<p
														class="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-fyra-gray-500"
													>
														{img.description}
													</p>
													<p class="mt-auto pt-2 text-[10px] leading-none text-fyra-gray-600">
														{img.versions[0]?.archs?.join('  ') ?? ''}
														{#if img.versions.length > 1}
															| {img.versions.length} versions
														{/if}
													</p>
												</div>
											</button>
											{#if isSelected && img.versions.length > 0}
												<div
													class="col-span-2 border-t border-fyra-gray-800 bg-fyra-gray-900/50 px-5 py-3"
												>
													<span class="text-xs text-fyra-gray-400">Version</span>
													<select
														bind:value={selectedImageVersion}
														class="mt-1.5 h-8 w-full border border-fyra-gray-700 bg-fyra-gray-800 px-2 text-xs text-fyra-gray-100 focus:border-fyra-red-500 focus:outline-none"
													>
														{#each img.versions as v (v.version)}
															<option value={v.version}>{v.version} ({v.archs.join(', ')})</option>
														{/each}
													</select>
												</div>
											{/if}
										</div>
									{/each}
								</div>
								{#if filteredOfficialImages().length === 0 && imagesSearch.trim()}
									<div class="py-6 text-center text-xs text-fyra-gray-500">
										No images match "{imagesSearch}"
									</div>
								{/if}
							</div>

							{#if dbImages.length > 0}
								<div class="mt-4">
									<div class="flex items-center gap-2 border-b border-fyra-gray-800/50 pb-2">
										<span
											class="text-[10px] font-semibold tracking-wider text-fyra-gray-500 uppercase"
											>Database Images</span
										>
									</div>
									<div class="mt-2 divide-y divide-fyra-gray-800/30">
										{#each dbImages as img (img.id)}
											<button
												class="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-fyra-gray-800/20 {selectedImageId ===
												`db-${img.id}`
													? 'border-l-2 border-l-fyra-red-500 bg-fyra-gray-800/40'
													: ''}"
												onclick={() => {
													if (selectedImageId === `db-${img.id}`) {
														selectedImageId = null;
														selectedImageVersion = null;
													} else {
														selectedImageId = `db-${img.id}`;
														selectedImageVersion = img.version || null;
													}
												}}
											>
												<HardDrive class="h-3.5 w-3.5 text-fyra-gray-500" />
												<span class="text-xs text-fyra-gray-200">{img.name}</span>
												{#if img.version}
													<span class="text-[10px] text-fyra-gray-500">{img.version}</span>
												{/if}
											</button>
										{/each}
									</div>
								</div>
							{/if}
						{:else if imageTab === 'snapshots'}
							<div class="mt-6 flex flex-col items-center justify-center py-8 text-center">
								<HardDrive class="mb-3 h-8 w-8 text-fyra-gray-600" />
								<p class="text-xs text-fyra-gray-500">Snapshots coming soon</p>
								<p class="mt-1 max-w-xs text-[11px] text-fyra-gray-600">
									Create point-in-time copies of your servers for quick recovery.
								</p>
							</div>
						{:else if imageTab === 'apps'}
							<div class="mt-6 flex flex-col items-center justify-center py-8 text-center">
								<Server class="mb-3 h-8 w-8 text-fyra-gray-600" />
								<p class="text-xs text-fyra-gray-500">Apps coming soon</p>
								<p class="mt-1 max-w-xs text-[11px] text-fyra-gray-600">
									One-click deploy popular applications like WordPress, Nextcloud, and more.
								</p>
							</div>
						{/if}
					</div>

					<div id="section-plan" class="scroll-mt-4">
						<div class="flex items-center gap-2 border-b border-fyra-gray-800 pb-2">
							<Server class="h-3.5 w-3.5 text-fyra-red-400" />
							<span class="text-xs font-semibold tracking-wider text-fyra-gray-400 uppercase"
								>Plan</span
							>
						</div>
						<div class="mt-3">
							{#if loadingVmTypes}
								<div class="flex items-center justify-center py-8 text-fyra-gray-500">
									<Loader2 class="mr-2 h-4 w-4 animate-spin" />
									<span class="text-xs">Loading plans...</span>
								</div>
							{:else if vmTypes.length === 0}
								<div class="flex flex-col items-center justify-center py-8 text-center">
									<Server class="mb-3 h-6 w-6 text-fyra-gray-600" />
									<p class="text-xs text-fyra-gray-500">No VM types available</p>
									<p class="mt-1 text-[11px] text-fyra-gray-600">
										Create a plan in the Admin panel to get started.
									</p>
								</div>
							{:else}
								<div class="grid grid-cols-2 gap-2">
									{#each vmTypes as plan (plan.id)}
										<button
											class="flex flex-col gap-1 border p-3 text-left transition-colors {selectedPlanId ===
											plan.id
												? 'border-fyra-red-500 bg-fyra-red-950/20'
												: 'border-fyra-gray-700 hover:border-fyra-gray-600'}"
											onclick={() => {
												selectedPlanId = selectedPlanId === plan.id ? null : plan.id;
											}}
										>
											<span class="text-sm font-semibold text-fyra-gray-100">{plan.name}</span>
											<div class="flex items-center gap-2 text-[11px] text-fyra-gray-400">
												<span>{plan.cores} vCPU</span>
												<span class="text-fyra-gray-700">&bull;</span>
												<span>{formatRam(plan.ramCapacity)}</span>
												<span class="text-fyra-gray-700">&bull;</span>
												<span>{plan.storageAmount}GB</span>
											</div>
											{#if plan.rate}
												<span class="text-xs font-medium text-fyra-gray-300">{plan.rate}</span>
											{/if}
										</button>
									{/each}
								</div>
							{/if}
						</div>
					</div>

					<div id="section-storage" class="scroll-mt-4">
						<div class="flex items-center gap-2 border-b border-fyra-gray-800 pb-2">
							<HardDriveUpload class="h-3.5 w-3.5 text-fyra-red-400" />
							<span class="text-xs font-semibold tracking-wider text-fyra-gray-400 uppercase"
								>Storage</span
							>
						</div>
						<div class="mt-3">
							{#if selectedPlan}
								<div class="flex items-center gap-2 text-xs text-fyra-gray-300">
									<span class="text-fyra-gray-500">Included disk:</span>
									<span class="font-medium">{selectedPlan.storageAmount}GB</span>
								</div>
							{:else}
								<p class="text-xs text-fyra-gray-500">Select a plan to see included disk size.</p>
							{/if}
							<div class="mt-4 border border-fyra-gray-800/50 bg-fyra-gray-900/50 p-3">
								<p class="text-[10px] tracking-wider text-fyra-gray-500 uppercase">
									Attach Volumes
								</p>
								<p class="mt-1 text-xs text-fyra-gray-600">Volume attachment coming soon.</p>
							</div>
						</div>
					</div>

					<div id="section-networking" class="scroll-mt-4">
						<div class="flex items-center gap-2 border-b border-fyra-gray-800 pb-2">
							<Globe class="h-3.5 w-3.5 text-fyra-red-400" />
							<span class="text-xs font-semibold tracking-wider text-fyra-gray-400 uppercase"
								>Networking</span
							>
						</div>
						<div class="mt-3">
							<div class="flex flex-col gap-2">
								{#each [{ value: 'both' as const, label: 'IPv4 and IPv6' }, { value: 'ipv4' as const, label: 'IPv4 only' }, { value: 'ipv6' as const, label: 'IPv6 only' }, { value: 'none' as const, label: 'No public network' }] as opt (opt.value)}
									<label
										class="flex cursor-pointer items-center gap-2 border p-3 text-xs transition-colors {networkingOption ===
										opt.value
											? 'border-fyra-red-500 bg-fyra-red-950/20 text-fyra-gray-100'
											: 'border-fyra-gray-700 text-fyra-gray-400 hover:border-fyra-gray-600'}"
									>
										<input
											type="radio"
											name="networking"
											value={opt.value}
											bind:group={networkingOption}
											class="accent-fyra-red-500"
										/>
										{opt.label}
									</label>
								{/each}
							</div>
							<div class="mt-4 border border-fyra-gray-800/50 bg-fyra-gray-900/50 p-3">
								<p class="text-[10px] tracking-wider text-fyra-gray-500 uppercase">VPC</p>
								<p class="mt-1 text-xs text-fyra-gray-600">VPC selection coming soon.</p>
							</div>
						</div>
					</div>

					<div id="section-ssh" class="scroll-mt-4 pb-8">
						<div class="flex items-center gap-2 border-b border-fyra-gray-800 pb-2">
							<Key class="h-3.5 w-3.5 text-fyra-red-400" />
							<span class="text-xs font-semibold tracking-wider text-fyra-gray-400 uppercase"
								>SSH Keys</span
							>
						</div>
						<div class="mt-3">
							{#if data.sshKeys && data.sshKeys.length > 0}
								<div class="flex flex-col gap-1">
									{#each data.sshKeys as key (key.id)}
										<label
											class="flex cursor-pointer items-center gap-3 border p-3 text-xs transition-colors {selectedSshKeyIds.includes(
												key.id
											)
												? 'border-fyra-red-500 bg-fyra-red-950/20'
												: 'border-fyra-gray-700 hover:border-fyra-gray-600'}"
										>
											<input
												type="checkbox"
												checked={selectedSshKeyIds.includes(key.id)}
												onchange={() => {
													if (selectedSshKeyIds.includes(key.id)) {
														selectedSshKeyIds = selectedSshKeyIds.filter((id) => id !== key.id);
													} else {
														selectedSshKeyIds = [...selectedSshKeyIds, key.id];
													}
												}}
												class="accent-fyra-red-500"
											/>
											<div class="flex flex-col">
												<span class="font-medium text-fyra-gray-200">{key.name}</span>
												<span class="font-mono text-[10px] text-fyra-gray-500"
													>{key.fingerprint}</span
												>
											</div>
										</label>
									{/each}
								</div>
							{:else}
								<div class="border border-fyra-gray-800/50 bg-fyra-gray-900/50 p-4 text-center">
									<p class="text-xs text-fyra-gray-500">No SSH keys available.</p>
									<p class="mt-1 text-[11px] text-fyra-gray-600">
										Password authentication will be used instead.
									</p>
								</div>
							{/if}
						</div>
					</div>
				</div>
			</div>
		</div>

		<aside class="sticky top-0 h-full w-72 shrink-0 border-l border-fyra-gray-800 bg-fyra-gray-900">
			<div class="flex h-full flex-col">
				<div class="border-b border-fyra-gray-800 px-4 py-3">
					<span class="text-xs font-semibold tracking-wider text-fyra-gray-400 uppercase"
						>Configure</span
					>
				</div>
				<div class="flex-1 overflow-y-auto px-4 py-3">
					<nav class="flex flex-col gap-1">
						{#each sections as section (section.id)}
							<button
								class="flex items-center gap-2 px-2 py-1.5 text-left text-xs transition-colors hover:bg-fyra-gray-800/50"
								onclick={() => scrollTosSection(section.id)}
							>
								{#if section.isComplete}
									<Check class="h-3 w-3 shrink-0 text-emerald-500" />
								{:else}
									<Circle class="h-3 w-3 shrink-0 text-fyra-gray-600" />
								{/if}
								<span class={section.isComplete ? 'text-fyra-gray-200' : 'text-fyra-gray-500'}
									>{section.label}</span
								>
							</button>
						{/each}
					</nav>

					<div class="mt-4 border-t border-fyra-gray-800 pt-4">
						<span class="text-[10px] font-semibold tracking-wider text-fyra-gray-500 uppercase"
							>Summary</span
						>
						<div class="mt-2 flex flex-col gap-2">
							<div class="flex items-center justify-between text-xs">
								<span class="text-fyra-gray-500">Image</span>
								<span class="text-fyra-gray-200">
									{selectedImage?.name ?? '—'}
									{#if selectedImageVersion}/ {selectedImageVersion}{/if}
								</span>
							</div>
							<div class="flex items-center justify-between text-xs">
								<span class="text-fyra-gray-500">Plan</span>
								<span class="text-fyra-gray-200">
									{selectedPlan
										? `${selectedPlan.name} (${selectedPlan.cores} vCPU, ${formatRam(selectedPlan.ramCapacity)})`
										: '—'}
								</span>
							</div>
							<div class="flex items-center justify-between text-xs">
								<span class="text-fyra-gray-500">Network</span>
								<span class="text-fyra-gray-200">
									{networkingOption === 'both'
										? 'IPv4 + IPv6'
										: networkingOption === 'ipv4'
											? 'IPv4 only'
											: networkingOption === 'ipv6'
												? 'IPv6 only'
												: 'None'}
								</span>
							</div>
							{#if selectedPlan?.rate}
								<div class="flex items-center justify-between text-xs">
									<span class="text-fyra-gray-500">Estimated</span>
									<span class="font-medium text-fyra-gray-100">{selectedPlan.rate}</span>
								</div>
							{/if}
						</div>
					</div>
				</div>

				<div class="border-t border-fyra-gray-800 px-4 py-3">
					<Button
						class="w-full"
						disabled={!serverName.trim() || !selectedPlanId || creating}
						onclick={() => {}}
					>
						{#if creating}
							<Loader2 class="mr-2 h-3 w-3 animate-spin" />
							Creating...
						{:else}
							Create Server
						{/if}
					</Button>
					{#if createError}
						<p class="mt-2 text-xs text-fyra-red-400">{createError}</p>
					{/if}
				</div>
			</div>
		</aside>
	</div>
</div>
