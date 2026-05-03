<script lang="ts">
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Play, Power, PowerOff, RotateCw } from '@lucide/svelte';
	import { killVm, rebootVm, startVm, stopVm } from '$lib/remote/vms.remote';
	import { getServerWithFallback } from '$lib/state/servers.svelte';
	import { serverTabs, type ServerTab } from './lib/server-detail';

	let { data, children } = $props();
	let powerLoading = $state(false);
	let selectedServer = $derived(getServerWithFallback(data.serverId, data.server));
	let serverId = $derived(selectedServer.id);
	let activeTab = $derived.by<ServerTab>(() => {
		const tab = page.url.pathname.split('/').pop();
		return serverTabs.some((entry) => entry.id === tab) ? (tab as ServerTab) : 'overview';
	});

	function tabHref(tab: ServerTab) {
		const base = `/projects/${page.params.projectid}/servers/${serverId}`;
		return tab === 'overview' ? base : `${base}/${tab}`;
	}

	async function power(action: 'start' | 'shutdown' | 'kill' | 'restart') {
		if (!selectedServer || powerLoading) return;
		powerLoading = true;

		try {
			if (action === 'start') {
				await startVm({ vmId: selectedServer.id });
			} else if (action === 'shutdown') {
				await stopVm({ vmId: selectedServer.id });
			} else if (action === 'restart') {
				await rebootVm({ vmId: selectedServer.id });
			} else {
				await killVm({ vmId: selectedServer.id });
			}
		} finally {
			powerLoading = false;
		}
	}
</script>

<div class="flex h-10 shrink-0 items-center justify-between border-b border-gray-800 px-4">
	<div class="flex items-center gap-2">
		<span class="text-sm font-medium text-gray-200">{selectedServer.name}</span>
		<Badge
			variant="outline"
			class="text-[10px] {!selectedServer.liveLoaded
				? 'border-gray-700 bg-gray-900/40 text-gray-400'
				: selectedServer.status === 'running'
					? 'border-emerald-800 bg-emerald-950/40 text-emerald-400'
					: selectedServer.status === 'provisioning'
						? 'border-blue-800 bg-blue-950/40 text-blue-400'
						: selectedServer.status === 'restarting'
							? 'border-amber-800 bg-amber-950/40 text-amber-400'
							: 'border-red-800 bg-red-950/40 text-red-400'}"
		>
			{!selectedServer.liveLoaded
				? 'unknown'
				: selectedServer.status === 'provisioning'
					? 'provisioning...'
					: selectedServer.status}
		</Badge>
	</div>
	<div class="flex items-center gap-1.5">
		<Button
			variant="outline"
			size="sm"
			class="h-7 gap-1.5 px-3 text-xs"
			disabled={powerLoading ||
				selectedServer.status === 'running' ||
				selectedServer.status === 'restarting' ||
				selectedServer.status === 'provisioning'}
			onclick={() => power('start')}
		>
			<Play class="h-3 w-3" />
			Start
		</Button>
		<Button
			variant="outline"
			size="sm"
			class="h-7 gap-1.5 px-3 text-xs"
			disabled={powerLoading ||
				selectedServer.status === 'stopped' ||
				selectedServer.status === 'restarting' ||
				selectedServer.status === 'provisioning'}
			onclick={() => power('restart')}
		>
			<RotateCw class="h-3 w-3 {selectedServer.status === 'restarting' ? 'animate-spin' : ''}" />
			Restart
		</Button>
		<Button
			variant="outline"
			size="sm"
			class="h-7 gap-1.5 px-3 text-xs"
			disabled={powerLoading ||
				selectedServer.status === 'stopped' ||
				selectedServer.status === 'provisioning'}
			onclick={() => power('shutdown')}
		>
			<Power class="h-3 w-3" />
			Shutdown
		</Button>
		<Button
			variant="outline"
			size="sm"
			class="h-7 gap-1.5 border-red-700 px-3 text-xs text-red-400 hover:bg-red-950"
			disabled={powerLoading ||
				selectedServer.status === 'stopped' ||
				selectedServer.status === 'provisioning'}
			onclick={() => power('kill')}
		>
			<PowerOff class="h-3 w-3" />
			Kill
		</Button>
	</div>
</div>

<div class="flex shrink-0 items-center gap-0 overflow-x-auto border-b border-gray-800 px-2">
	{#each serverTabs as tab (tab.id)}
		<a
			class="flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors duration-100 {activeTab ===
			tab.id
				? 'border-b-2 border-red-500 text-gray-50'
				: 'text-gray-500 hover:text-gray-300'}"
			href={tabHref(tab.id)}
			data-sveltekit-preload-data="hover"
		>
			<tab.icon class="h-3 w-3" />
			{tab.label}
		</a>
	{/each}
</div>

<div class="flex min-h-0 flex-1 flex-col overflow-hidden">
	{@render children()}
</div>
