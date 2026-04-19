<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { listVms } from '$lib/remote/vms.remote';
	import { HardDrive, Plus } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';

	let { data } = $props();

	type VmRow = {
		id: string;
		active: boolean;
		status: string;
		creationDate: string;
		vmType: { name: string; cores: number; ramCapacity: number; storageAmount: number } | null;
		live: {
			id: string;
			name: string;
			status: string;
			cores: number;
			memory: number;
			disk: number;
			uptime: number;
			networkInterfaces?: Record<string, { ipAddresses?: string[] }>;
		} | null;
	};

	let hasServers = $state(false);
	let loading = $state(true);

	onMount(async () => {
		const projectId = data.projects?.[0]?.id;
		if (!projectId) {
			loading = false;
			return;
		}

		try {
			const vms = await listVms({ projectId });
			const activeServers = vms.filter((v) => v.active);
			hasServers = activeServers.length > 0;

			if (hasServers) {
				goto(`/servers/${activeServers[0].id}`);
			}
		} catch (err) {
			console.error('Failed to load servers:', err);
		} finally {
			loading = false;
		}
	});
</script>

<div class="flex h-full flex-col items-center justify-center text-fyra-gray-500">
	{#if loading}
		<div class="flex flex-col items-center">
			<HardDrive class="mb-3 h-8 w-8 animate-pulse" />
			<p class="text-sm">Loading servers...</p>
		</div>
	{:else if !hasServers}
		<HardDrive class="mb-3 h-12 w-12" />
		<p class="mb-4 text-lg font-medium text-fyra-gray-300">No servers yet</p>
		<p class="mb-6 max-w-xs text-center text-sm">
			Get started by creating your first virtual private server.
		</p>
		<Button onclick={() => goto('/servers/create')}>
			<Plus class="mr-2 h-4 w-4" />
			Create Server
		</Button>
	{/if}
</div>
