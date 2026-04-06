<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Plus, Trash2, Link, Unlink, HardDrive } from '@lucide/svelte';

	type Volume = {
		id: string;
		name: string;
		size: number;
		server: string | null;
		region: string;
		status: 'attached' | 'available' | 'deleting';
	};

	let volumes = $state<Volume[]>([
		{
			id: 'vol-a1b2c3',
			name: 'postgres-data',
			size: 50,
			server: 'vps-747762',
			region: 'Chicago',
			status: 'attached'
		},
		{
			id: 'vol-d4e5f6',
			name: 'redis-backup',
			size: 20,
			server: null,
			region: 'Chicago',
			status: 'available'
		},
		{
			id: 'vol-g7h8i9',
			name: 'media-storage',
			size: 100,
			server: 'vps-742736',
			region: 'Chicago',
			status: 'attached'
		},
		{
			id: 'vol-j1k2l3',
			name: 'logs-archive',
			size: 200,
			server: null,
			region: 'Chicago',
			status: 'available'
		}
	]);

	const serverOptions = ['vps-747762', 'vps-742736', 'vps-711980'];

	let createOpen = $state(false);
	let newName = $state('');
	let newSize = $state(25);

	let attachOpen = $state(false);
	let attachTarget = $state<Volume | null>(null);
	let attachServer = $state(serverOptions[0]);

	let counter = $state(0);

	function createVolume() {
		if (!newName.trim()) return;
		counter++;
		volumes.push({
			id: `vol-new${counter}`,
			name: newName.trim(),
			size: newSize,
			server: null,
			region: 'Chicago',
			status: 'available'
		});
		newName = '';
		newSize = 25;
		createOpen = false;
	}

	function deleteVolume(id: string) {
		const idx = volumes.findIndex((v) => v.id === id);
		if (idx === -1) return;
		volumes[idx].status = 'deleting';
		setTimeout(() => {
			volumes = volumes.filter((v) => v.id !== id);
		}, 800);
	}

	function detach(id: string) {
		const idx = volumes.findIndex((v) => v.id === id);
		if (idx === -1) return;
		volumes[idx].server = null;
		volumes[idx].status = 'available';
	}

	function openAttach(vol: Volume) {
		attachTarget = vol;
		attachServer = serverOptions[0];
		attachOpen = true;
	}

	function confirmAttach() {
		if (!attachTarget) return;
		const idx = volumes.findIndex((v) => v.id === attachTarget!.id);
		if (idx === -1) return;
		volumes[idx].server = attachServer;
		volumes[idx].status = 'attached';
		attachOpen = false;
		attachTarget = null;
	}
</script>

<div class="flex flex-1 flex-col overflow-hidden">
	<!-- Header -->
	<div
		class="flex h-10 shrink-0 items-center justify-between border-b border-fyra-gray-800 px-5"
	>
		<div class="flex items-center gap-2">
			<HardDrive class="h-4 w-4 text-fyra-gray-400" />
			<span class="text-sm font-semibold text-fyra-gray-100">Volumes</span>
			<Badge variant="secondary" class="text-[10px]">{volumes.length}</Badge>
		</div>
		<Button
			variant="outline"
			size="sm"
			class="h-7 gap-1.5 px-3 text-xs"
			onclick={() => (createOpen = true)}
		>
			<Plus class="h-3 w-3" />
			Create Volume
		</Button>
	</div>

	<!-- Table -->
	<div class="flex-1 overflow-auto">
		<table class="w-full">
			<thead>
				<tr class="border-b border-fyra-gray-800">
					<th class="px-5 py-3 text-left text-xs font-medium text-fyra-gray-500">Name</th>
					<th class="px-5 py-3 text-left text-xs font-medium text-fyra-gray-500">Size</th>
					<th class="px-5 py-3 text-left text-xs font-medium text-fyra-gray-500">Server</th>
					<th class="px-5 py-3 text-left text-xs font-medium text-fyra-gray-500">Region</th>
					<th class="px-5 py-3 text-left text-xs font-medium text-fyra-gray-500">Status</th>
					<th class="px-5 py-3 text-right text-xs font-medium text-fyra-gray-500">Actions</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-fyra-gray-800/50">
				{#each volumes as vol (vol.id)}
					<tr
						class="transition-colors duration-100 hover:bg-fyra-gray-800/20 {vol.status ===
						'deleting'
							? 'opacity-40'
							: ''}"
					>
						<td class="px-5 py-3">
							<span class="text-sm font-medium text-fyra-gray-100">{vol.name}</span>
							<span class="ml-2 text-xs text-fyra-gray-600">{vol.id}</span>
						</td>
						<td class="px-5 py-3 text-sm text-fyra-gray-300">{vol.size} GB</td>
						<td class="px-5 py-3 text-sm text-fyra-gray-300">
							{vol.server ?? '—'}
						</td>
						<td class="px-5 py-3 text-sm text-fyra-gray-400">{vol.region}</td>
						<td class="px-5 py-3">
							{#if vol.status === 'attached'}
								<Badge
									variant="outline"
									class="border-emerald-800 bg-emerald-950/40 text-[10px] text-emerald-400"
									>Attached</Badge
								>
							{:else if vol.status === 'deleting'}
								<Badge variant="outline" class="text-[10px]">Deleting...</Badge>
							{:else}
								<Badge variant="secondary" class="text-[10px]">Available</Badge>
							{/if}
						</td>
						<td class="px-5 py-3">
							<div class="flex items-center justify-end gap-1">
								{#if vol.status === 'attached'}
									<Button
										variant="ghost"
										size="sm"
										class="h-7 gap-1.5 px-2 text-xs"
										onclick={() => detach(vol.id)}
									>
										<Unlink class="h-3 w-3" />
										Detach
									</Button>
								{:else if vol.status === 'available'}
									<Button
										variant="ghost"
										size="sm"
										class="h-7 gap-1.5 px-2 text-xs"
										onclick={() => openAttach(vol)}
									>
										<Link class="h-3 w-3" />
										Attach
									</Button>
								{/if}
								<Button
									variant="ghost"
									size="sm"
									class="h-7 px-2 text-xs text-fyra-red-400 hover:text-fyra-red-300"
									disabled={vol.status === 'deleting' || vol.status === 'attached'}
									onclick={() => deleteVolume(vol.id)}
								>
									<Trash2 class="h-3 w-3" />
								</Button>
							</div>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>

		{#if volumes.length === 0}
			<div class="flex flex-col items-center justify-center py-20 text-fyra-gray-500">
				<HardDrive class="mb-3 h-8 w-8" />
				<p class="text-sm">No volumes yet</p>
			</div>
		{/if}
	</div>
</div>

<!-- Create Volume Dialog -->
<Dialog.Root bind:open={createOpen}>
	<Dialog.Content class="border-fyra-gray-800 bg-fyra-gray-900 sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Create Volume</Dialog.Title>
			<Dialog.Description>Provision a new block storage volume in Chicago.</Dialog.Description>
		</Dialog.Header>
		<div class="flex flex-col gap-4 py-4">
			<div class="flex flex-col gap-2">
				<Label>Name</Label>
				<Input bind:value={newName} placeholder="my-volume" />
			</div>
			<div class="flex flex-col gap-2">
				<Label>Size (GB)</Label>
				<div class="flex items-center gap-3">
					<input
						type="range"
						min="10"
						max="500"
						step="10"
						bind:value={newSize}
						class="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-fyra-gray-700 accent-fyra-red-500"
					/>
					<span class="w-16 text-right text-sm font-medium text-fyra-gray-200"
						>{newSize} GB</span
					>
				</div>
				<p class="text-xs text-fyra-gray-500">
					${(newSize * 0.1).toFixed(2)}/mo at $0.10/GB
				</p>
			</div>
		</div>
		<Dialog.Footer>
			<Button variant="outline" size="sm" onclick={() => (createOpen = false)}>Cancel</Button>
			<Button size="sm" onclick={createVolume} disabled={!newName.trim()}>Create</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<!-- Attach Volume Dialog -->
<Dialog.Root bind:open={attachOpen}>
	<Dialog.Content class="border-fyra-gray-800 bg-fyra-gray-900 sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Attach Volume</Dialog.Title>
			<Dialog.Description>
				Attach <strong>{attachTarget?.name}</strong> to a server.
			</Dialog.Description>
		</Dialog.Header>
		<div class="flex flex-col gap-2 py-4">
			<Label>Server</Label>
			<select
				bind:value={attachServer}
				class="w-full appearance-none border border-fyra-gray-700 bg-fyra-gray-800 px-3 py-2 text-sm text-fyra-gray-100 focus:border-fyra-gray-500 focus:outline-none"
			>
				{#each serverOptions as s (s)}
					<option value={s}>{s}</option>
				{/each}
			</select>
		</div>
		<Dialog.Footer>
			<Button variant="outline" size="sm" onclick={() => (attachOpen = false)}>Cancel</Button>
			<Button size="sm" onclick={confirmAttach}>Attach</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
