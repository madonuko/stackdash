<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Dialog from '$lib/components/ui/dialog';
	import {
		createVmType,
		updateVmType,
		deleteVmType
	} from '$lib/remote/vm-types.remote';
	import { createImage, updateImage, deleteImage, listProxmoxIsos } from '$lib/remote/images.remote';
	import { Plus, Pencil, Trash2, Cpu, Disc, Loader2, AlertTriangle, RefreshCw } from '@lucide/svelte';

	type VmType = { id: string; name: string; isa: string; cores: number; ramCapacity: number; storageAmount: number; rate: string; cap: string };
	type BaseImage = { id: string; name: string; version: string; description: string; shortName: string; icon: string | null; color: string; filePath: string; isa: string };
	type PageData = {
		vmTypes: VmType[];
		images: BaseImage[];
	};

	let { data }: { data: PageData } = $props();

	type AdminTab = 'vmTypes' | 'images';
	let activeTab = $state<AdminTab>('vmTypes');
	let vmTypes = $state<VmType[]>([]);
	let images = $state<BaseImage[]>([]);
	$effect(() => {
		vmTypes = [...data.vmTypes];
		images = [...data.images];
	});
	let vtDialogOpen = $state(false);
	let vtEditing = $state<VmType | null>(null);
	let vtSaving = $state(false);
	let vtError = $state('');
	let vtName = $state(''); let vtIsa = $state<'x86' | 'arm' | 'risc-v'>('x86');
	let vtCores = $state(1); let vtRam = $state(512); let vtStorage = $state(10);
	let vtRate = $state('0.00'); let vtCap = $state('5.00');

	function vtOpenCreate() {
		vtEditing = null; vtName = ''; vtIsa = 'x86'; vtCores = 1; vtRam = 512; vtStorage = 10; vtRate = '0.00'; vtCap = '5.00'; vtError = ''; vtDialogOpen = true;
	}
	function vtOpenEdit(vt: VmType) {
		vtEditing = vt; vtName = vt.name; vtIsa = vt.isa as any; vtCores = vt.cores; vtRam = vt.ramCapacity; vtStorage = vt.storageAmount; vtRate = vt.rate; vtCap = vt.cap; vtError = ''; vtDialogOpen = true;
	}
	async function vtSave() {
		if (!vtName.trim()) return; vtSaving = true; vtError = '';
		try {
			const data = { name: vtName.trim(), isa: vtIsa, cores: vtCores, ramCapacity: vtRam, storageAmount: vtStorage, rate: vtRate, cap: vtCap };
			if (vtEditing) {
				await updateVmType({ vmTypeId: vtEditing.id, ...data });
				const idx = vmTypes.findIndex((v) => v.id === vtEditing!.id);
				if (idx !== -1) vmTypes[idx] = { ...vmTypes[idx], ...data };
			} else {
				const res = await createVmType(data);
				vmTypes.push({ id: res.id, ...data });
			}
			vtDialogOpen = false;
		} catch (err) { vtError = err instanceof Error ? err.message : 'Failed to save'; }
		finally { vtSaving = false; }
	}
	async function vtRemove(id: string) {
		try { await deleteVmType({ vmTypeId: id }); vmTypes = vmTypes.filter((v) => v.id !== id); }
		catch (err) { alert(err instanceof Error ? err.message : 'Failed to delete'); }
	}

	type PveIso = { volid: string; filename: string; size: number; node: string };
	let pveIsos = $state<PveIso[]>([]);
	let isoLoading = $state(false);
	let imgDialogOpen = $state(false);
	let imgEditing = $state<BaseImage | null>(null);
	let imgSaving = $state(false);
	let imgError = $state('');

	// Image form fields
	let imgName = $state('');
	let imgVersion = $state('');
	let imgDescription = $state('');
	let imgShortName = $state('');
	let imgIcon = $state('');
	let imgColor = $state('bg-gray-600');
	let imgFilePath = $state('');
	let imgIsa = $state<'x86' | 'arm' | 'risc-v'>('x86');

	const colorOptions = [
		'bg-blue-500', 'bg-sky-600', 'bg-red-700', 'bg-orange-600', 'bg-yellow-600',
		'bg-indigo-600', 'bg-cyan-700', 'bg-red-600', 'bg-emerald-600', 'bg-purple-600',
		'bg-pink-600', 'bg-gray-600'
	];

	async function loadPveIsos() {
		isoLoading = true;
		try { pveIsos = await listProxmoxIsos(); } catch {}
		isoLoading = false;
	}

	function imgOpenCreate() {
		imgEditing = null; imgName = ''; imgVersion = ''; imgDescription = ''; imgShortName = '';
		imgIcon = ''; imgColor = 'bg-gray-600'; imgFilePath = ''; imgIsa = 'x86'; imgError = '';
		imgDialogOpen = true;
		if (pveIsos.length === 0) loadPveIsos();
	}
	function imgOpenEdit(img: BaseImage) {
		imgEditing = img; imgName = img.name; imgVersion = img.version; imgDescription = img.description;
		imgShortName = img.shortName; imgIcon = img.icon ?? ''; imgColor = img.color;
		imgFilePath = img.filePath; imgIsa = img.isa as any; imgError = '';
		imgDialogOpen = true;
		if (pveIsos.length === 0) loadPveIsos();
	}
	async function imgSave() {
		if (!imgName.trim() || !imgFilePath.trim()) return;
		imgSaving = true; imgError = '';
		try {
			const data = { name: imgName.trim(), version: imgVersion.trim(), description: imgDescription.trim(), shortName: imgShortName.trim(), icon: imgIcon.trim() || null, color: imgColor, filePath: imgFilePath.trim(), isa: imgIsa as 'x86' | 'arm' | 'risc-v' };
			if (imgEditing) {
				await updateImage({ imageId: imgEditing.id, ...data });
				const idx = images.findIndex((i) => i.id === imgEditing!.id);
				if (idx !== -1) images[idx] = { ...images[idx], ...data };
			} else {
				const res = await createImage(data);
				images.push({ id: res.id, ...data });
			}
			imgDialogOpen = false;
		} catch (err) { imgError = err instanceof Error ? err.message : 'Failed to save'; }
		finally { imgSaving = false; }
	}
	async function imgRemove(id: string) {
		try { await deleteImage({ imageId: id }); images = images.filter((i) => i.id !== id); }
		catch (err) { alert(err instanceof Error ? err.message : 'Failed to delete'); }
	}

	function formatSize(bytes: number) {
		const mb = bytes / (1024 * 1024);
		if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
		return `${mb.toFixed(0)} MB`;
	}
</script>

<div class="flex flex-1 flex-col overflow-hidden">
	<!-- Tab bar -->
	<div class="flex h-10 shrink-0 items-center gap-0 border-b border-fyra-gray-800">
		<button
			class="flex h-full items-center gap-1.5 border-b-2 px-5 text-xs font-medium transition-colors {activeTab === 'vmTypes' ? 'border-fyra-red-500 text-fyra-gray-100' : 'border-transparent text-fyra-gray-500 hover:text-fyra-gray-300'}"
			onclick={() => (activeTab = 'vmTypes')}
		>
			<Cpu class="h-3.5 w-3.5" />
			VM Types
			<Badge variant="secondary" class="text-[10px]">{vmTypes.length}</Badge>
		</button>
		<button
			class="flex h-full items-center gap-1.5 border-b-2 px-5 text-xs font-medium transition-colors {activeTab === 'images' ? 'border-fyra-red-500 text-fyra-gray-100' : 'border-transparent text-fyra-gray-500 hover:text-fyra-gray-300'}"
			onclick={() => (activeTab = 'images')}
		>
			<Disc class="h-3.5 w-3.5" />
			Images
			<Badge variant="secondary" class="text-[10px]">{images.length}</Badge>
		</button>
		<div class="flex-1"></div>
		{#if activeTab === 'vmTypes'}
			<div class="px-4">
				<Button size="sm" class="h-7 gap-1.5 text-xs" onclick={vtOpenCreate}><Plus class="h-3 w-3" /> Create Type</Button>
			</div>
		{:else}
			<div class="px-4">
				<Button size="sm" class="h-7 gap-1.5 text-xs" onclick={imgOpenCreate}><Plus class="h-3 w-3" /> Add Image</Button>
			</div>
		{/if}
	</div>

	<!-- Content -->
	<div class="flex-1 overflow-auto">
		<!-- ═══ VM Types Tab ═══ -->
		{#if activeTab === 'vmTypes'}
			{#if vmTypes.length === 0}
				<div class="flex flex-col items-center justify-center py-20 text-fyra-gray-500">
					<Cpu class="mb-3 h-6 w-6" /><p class="text-xs">No VM types yet</p>
					<Button variant="outline" size="sm" class="mt-3 gap-1.5 text-xs" onclick={vtOpenCreate}><Plus class="h-3 w-3" /> Create Type</Button>
				</div>
			{:else}
				<table class="w-full">
					<thead><tr class="border-b border-fyra-gray-800">
						<th class="px-5 py-3 text-left text-xs font-medium text-fyra-gray-500">Name</th>
						<th class="px-5 py-3 text-left text-xs font-medium text-fyra-gray-500">ISA</th>
						<th class="px-5 py-3 text-left text-xs font-medium text-fyra-gray-500">Cores</th>
						<th class="px-5 py-3 text-left text-xs font-medium text-fyra-gray-500">RAM</th>
						<th class="px-5 py-3 text-left text-xs font-medium text-fyra-gray-500">Storage</th>
						<th class="px-5 py-3 text-left text-xs font-medium text-fyra-gray-500">Rate</th>
						<th class="px-5 py-3 text-left text-xs font-medium text-fyra-gray-500">Cap</th>
						<th class="px-5 py-3 text-right text-xs font-medium text-fyra-gray-500">Actions</th>
					</tr></thead>
					<tbody class="divide-y divide-fyra-gray-800/50">
						{#each vmTypes as vt (vt.id)}
							<tr class="transition-colors hover:bg-fyra-gray-800/20">
								<td class="px-5 py-3 text-sm font-medium text-fyra-gray-100">{vt.name}</td>
								<td class="px-5 py-3"><Badge variant="secondary" class="text-[10px]">{vt.isa}</Badge></td>
								<td class="px-5 py-3 text-sm text-fyra-gray-300">{vt.cores}</td>
								<td class="px-5 py-3 text-sm text-fyra-gray-300">{vt.ramCapacity} MB</td>
								<td class="px-5 py-3 text-sm text-fyra-gray-300">{vt.storageAmount} GB</td>
								<td class="px-5 py-3 text-sm text-fyra-gray-300">${vt.rate}/hr</td>
								<td class="px-5 py-3 text-sm text-fyra-gray-300">${vt.cap}/mo</td>
								<td class="px-5 py-3 text-right">
									<div class="flex items-center justify-end gap-1">
										<Button variant="ghost" size="sm" class="h-7 w-7 p-0 text-fyra-gray-400 hover:text-fyra-gray-100" onclick={() => vtOpenEdit(vt)}><Pencil class="h-3 w-3" /></Button>
										<Button variant="ghost" size="sm" class="h-7 w-7 p-0 text-fyra-red-400 hover:text-fyra-red-300" onclick={() => vtRemove(vt.id)}><Trash2 class="h-3 w-3" /></Button>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}

		<!-- ═══ Images Tab ═══ -->
		{:else}
			{#if images.length === 0}
				<div class="flex flex-col items-center justify-center py-20 text-fyra-gray-500">
					<Disc class="mb-3 h-6 w-6" /><p class="text-xs">No images configured</p>
					<Button variant="outline" size="sm" class="mt-3 gap-1.5 text-xs" onclick={imgOpenCreate}><Plus class="h-3 w-3" /> Add Image</Button>
				</div>
			{:else}
				<table class="w-full">
					<thead><tr class="border-b border-fyra-gray-800">
						<th class="px-5 py-3 text-left text-xs font-medium text-fyra-gray-500">Image</th>
						<th class="px-5 py-3 text-left text-xs font-medium text-fyra-gray-500">Version</th>
						<th class="px-5 py-3 text-left text-xs font-medium text-fyra-gray-500">ISA</th>
						<th class="px-5 py-3 text-left text-xs font-medium text-fyra-gray-500">Proxmox Path</th>
						<th class="px-5 py-3 text-left text-xs font-medium text-fyra-gray-500">Description</th>
						<th class="px-5 py-3 text-right text-xs font-medium text-fyra-gray-500">Actions</th>
					</tr></thead>
					<tbody class="divide-y divide-fyra-gray-800/50">
						{#each images as img (img.id)}
							<tr class="transition-colors hover:bg-fyra-gray-800/20">
								<td class="px-5 py-3">
									<div class="flex items-center gap-2.5">
										<span class="flex h-7 w-7 shrink-0 items-center justify-center text-[10px] font-bold text-white {img.color}">
											{#if img.icon}
												{@html img.icon}
											{:else}
												{img.shortName || img.name.slice(0, 2).toUpperCase()}
											{/if}
										</span>
										<span class="text-sm font-medium text-fyra-gray-100">{img.name}</span>
									</div>
								</td>
								<td class="px-5 py-3 text-sm text-fyra-gray-300">{img.version}</td>
								<td class="px-5 py-3"><Badge variant="secondary" class="text-[10px]">{img.isa}</Badge></td>
								<td class="px-5 py-3 max-w-xs truncate font-mono text-xs text-fyra-gray-500">{img.filePath}</td>
								<td class="px-5 py-3 max-w-xs truncate text-xs text-fyra-gray-400">{img.description}</td>
								<td class="px-5 py-3 text-right">
									<div class="flex items-center justify-end gap-1">
										<Button variant="ghost" size="sm" class="h-7 w-7 p-0 text-fyra-gray-400 hover:text-fyra-gray-100" onclick={() => imgOpenEdit(img)}><Pencil class="h-3 w-3" /></Button>
										<Button variant="ghost" size="sm" class="h-7 w-7 p-0 text-fyra-red-400 hover:text-fyra-red-300" onclick={() => imgRemove(img.id)}><Trash2 class="h-3 w-3" /></Button>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		{/if}
	</div>
</div>

<!-- VM Type Dialog -->
<Dialog.Root bind:open={vtDialogOpen}>
	<Dialog.Content class="border-fyra-gray-800 bg-fyra-gray-900 sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>{vtEditing ? 'Edit VM Type' : 'Create VM Type'}</Dialog.Title>
			<Dialog.Description>{vtEditing ? 'Update plan specifications.' : 'Define a new VM plan.'}</Dialog.Description>
		</Dialog.Header>
		<div class="flex flex-col gap-4 py-4">
			{#if vtError}
				<div class="flex items-center gap-2 border border-fyra-red-700 bg-fyra-red-950 px-3 py-2 text-sm text-fyra-red-400"><AlertTriangle class="h-3.5 w-3.5 shrink-0" />{vtError}</div>
			{/if}
			<div class="flex flex-col gap-2"><Label>Name</Label><Input bind:value={vtName} placeholder="STACK-XXS" /></div>
			<div class="flex flex-col gap-2"><Label>Architecture</Label>
				<select bind:value={vtIsa} class="h-9 w-full border border-fyra-gray-700 bg-fyra-gray-800 px-3 text-sm text-fyra-gray-100 focus:border-fyra-gray-500 focus:outline-none">
					<option value="x86">x86</option><option value="arm">arm</option><option value="risc-v">risc-v</option>
				</select>
			</div>
			<div class="grid grid-cols-3 gap-3">
				<div class="flex flex-col gap-2"><Label>Cores</Label><Input type="number" bind:value={vtCores} min="1" /></div>
				<div class="flex flex-col gap-2"><Label>RAM (MB)</Label><Input type="number" bind:value={vtRam} min="128" step="128" /></div>
				<div class="flex flex-col gap-2"><Label>Storage (GB)</Label><Input type="number" bind:value={vtStorage} min="1" /></div>
			</div>
			<div class="grid grid-cols-2 gap-3">
				<div class="flex flex-col gap-2"><Label>Rate ($/hr)</Label><Input bind:value={vtRate} placeholder="0.007" /></div>
				<div class="flex flex-col gap-2"><Label>Cap ($/mo)</Label><Input bind:value={vtCap} placeholder="5.00" /></div>
			</div>
		</div>
		<Dialog.Footer>
			<Button variant="outline" size="sm" onclick={() => (vtDialogOpen = false)}>Cancel</Button>
			<Button size="sm" onclick={vtSave} disabled={vtSaving || !vtName.trim()}>
				{#if vtSaving}<Loader2 class="h-3 w-3 animate-spin" />{/if}{vtEditing ? 'Save' : 'Create'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<!-- Image Dialog -->
<Dialog.Root bind:open={imgDialogOpen}>
	<Dialog.Content class="border-fyra-gray-800 bg-fyra-gray-900 sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>{imgEditing ? 'Edit Image' : 'Add Image'}</Dialog.Title>
			<Dialog.Description>Configure a base image for VM provisioning.</Dialog.Description>
		</Dialog.Header>
		<div class="flex flex-col gap-4 py-4">
			{#if imgError}
				<div class="flex items-center gap-2 border border-fyra-red-700 bg-fyra-red-950 px-3 py-2 text-sm text-fyra-red-400"><AlertTriangle class="h-3.5 w-3.5 shrink-0" />{imgError}</div>
			{/if}

			<div class="grid grid-cols-2 gap-3">
				<div class="flex flex-col gap-2"><Label>Name</Label><Input bind:value={imgName} placeholder="Fedora Server" /></div>
				<div class="flex flex-col gap-2"><Label>Version</Label><Input bind:value={imgVersion} placeholder="42" /></div>
			</div>

			<div class="grid grid-cols-2 gap-3">
				<div class="flex flex-col gap-2"><Label>Short Name</Label><Input bind:value={imgShortName} placeholder="Fe" maxlength={3} /></div>
				<div class="flex flex-col gap-2"><Label>Architecture</Label>
					<select bind:value={imgIsa} class="h-9 w-full border border-fyra-gray-700 bg-fyra-gray-800 px-3 text-sm text-fyra-gray-100 focus:border-fyra-gray-500 focus:outline-none">
						<option value="x86">x86</option><option value="arm">arm</option><option value="risc-v">risc-v</option>
					</select>
				</div>
			</div>

			<div class="flex flex-col gap-2">
				<Label>Description</Label>
				<textarea bind:value={imgDescription} placeholder="Short description of this image..." rows="2"
					class="w-full resize-none border border-fyra-gray-700 bg-fyra-gray-800 px-3 py-2 text-sm text-fyra-gray-100 placeholder:text-fyra-gray-600 focus:border-fyra-gray-500 focus:outline-none"
				></textarea>
			</div>

			<!-- Color picker -->
			<div class="flex flex-col gap-2">
				<Label>Color</Label>
				<div class="flex flex-wrap gap-1.5">
					{#each colorOptions as c}
						<button
							class="h-6 w-6 border-2 transition-colors {c} {imgColor === c ? 'border-white' : 'border-transparent hover:border-fyra-gray-500'}"
							onclick={() => (imgColor = c)}
							aria-label={`Select ${c}`}
						></button>
					{/each}
				</div>
			</div>

			<!-- Icon SVG -->
			<div class="flex flex-col gap-2">
				<Label>Icon <span class="font-normal text-fyra-gray-500">(SVG markup, optional)</span></Label>
				<textarea bind:value={imgIcon} placeholder='<svg viewBox="0 0 24 24" ...>...</svg>' rows="2"
					class="w-full resize-none border border-fyra-gray-700 bg-fyra-gray-800 px-3 py-2 font-mono text-xs text-fyra-gray-100 placeholder:text-fyra-gray-600 focus:border-fyra-gray-500 focus:outline-none"
				></textarea>
				{#if imgIcon.trim()}
					<div class="flex items-center gap-2 text-xs text-fyra-gray-500">
						Preview:
						<span class="flex h-7 w-7 items-center justify-center text-white {imgColor}">{@html imgIcon}</span>
					</div>
				{/if}
			</div>

			<!-- Proxmox ISO Path -->
			<div class="flex flex-col gap-2">
				<div class="flex items-center justify-between">
					<Label>Proxmox ISO Path</Label>
					<Button variant="ghost" size="sm" class="h-6 gap-1 px-2 text-[10px] text-fyra-gray-500" onclick={loadPveIsos} disabled={isoLoading}>
						{#if isoLoading}<Loader2 class="h-3 w-3 animate-spin" />{:else}<RefreshCw class="h-3 w-3" />{/if}
						Scan Nodes
					</Button>
				</div>
				<Input bind:value={imgFilePath} placeholder="local:iso/Fedora-Server-dvd-x86_64-42-1.1.iso" class="font-mono text-xs" />
				{#if pveIsos.length > 0}
					<div class="max-h-32 overflow-y-auto border border-fyra-gray-800">
						{#each pveIsos as iso}
							<button
								class="flex w-full items-center justify-between px-3 py-1.5 text-left text-xs transition-colors {imgFilePath === iso.volid ? 'bg-fyra-red-950/30 text-fyra-gray-100' : 'text-fyra-gray-400 hover:bg-fyra-gray-800/50'}"
								onclick={() => (imgFilePath = iso.volid)}
							>
								<span class="truncate font-mono">{iso.volid}</span>
								<span class="ml-2 shrink-0 text-fyra-gray-600">{formatSize(iso.size)}</span>
							</button>
						{/each}
					</div>
				{/if}
			</div>
		</div>
		<Dialog.Footer>
			<Button variant="outline" size="sm" onclick={() => (imgDialogOpen = false)}>Cancel</Button>
			<Button size="sm" onclick={imgSave} disabled={imgSaving || !imgName.trim() || !imgFilePath.trim()}>
				{#if imgSaving}<Loader2 class="h-3 w-3 animate-spin" />{/if}{imgEditing ? 'Save' : 'Create'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
