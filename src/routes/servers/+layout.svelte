<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { setContext } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { HardDrive, Plus } from '@lucide/svelte';

	let { data, children } = $props();

	const SERVER_CONTEXT_KEY = Symbol('servers');

	export function getServers(): ServerInfo[] {
		return servers;
	}

	type ServerInfo = {
		id: string;
		name: string;
		vcpu: number;
		ram: string;
		disk: string;
		ip: string;
		ipv6: string;
		status: 'running' | 'stopped' | 'restarting' | 'provisioning';
		agentConnected: boolean;
		os: string;
		region: string;
		created: string;
		uptime: string;
		plan: string;
		backups: boolean;
	};

	let servers = $derived(data.servers ?? []);

	setContext(SERVER_CONTEXT_KEY, {
		get servers() {
			return servers;
		}
	});

	const currentPath = $derived(page.url.pathname);
	const isCreatePage = $derived(currentPath === '/servers/create');
	const selectedServerId = $derived(
		isCreatePage ? null : currentPath.startsWith('/servers/') ? currentPath.split('/').pop() : null
	);
</script>

<div class="flex h-full w-full overflow-hidden">
	<!-- Server list sidebar -->
	<div class="flex w-64 shrink-0 flex-col border-r border-gray-800">
		<div class="flex h-10 shrink-0 items-center justify-between border-b border-gray-800 px-4">
			<div class="flex items-center">
				<span class="text-sm font-semibold text-gray-100">Servers</span>
				<Badge variant="secondary" class="ml-2 text-[10px]">{servers.length}</Badge>
			</div>
			<Button
				variant="outline"
				size="sm"
				class="h-6 w-6 border-red-500/50 p-0 text-red-400 hover:border-red-500 hover:bg-red-950 hover:text-gray-100"
				onclick={() => goto('/servers/create')}
			>
				<Plus class="h-3.5 w-3.5" />
			</Button>
		</div>
		<div class="flex-1 overflow-y-auto">
			{#each servers as server (server.id)}
				<button
					class="flex w-full items-start justify-between border-b border-gray-800 px-4 py-3 text-left transition-colors duration-100 {selectedServerId ===
					server.id
						? 'bg-gray-800/60'
						: 'hover:bg-gray-800/30'}"
					onclick={() => goto(`/servers/${server.id}`)}
				>
					<div class="min-w-0">
						<p class="truncate text-sm font-semibold text-gray-100">{server.name}</p>
						<p class="mt-0.5 truncate text-xs text-gray-500">
							{server.vcpu} vCPU &bull; {server.ram} &bull; {server.ip}
						</p>
					</div>
					<span
						class="mt-1 ml-2 h-2 w-2 shrink-0 rounded-full {server.status === 'running'
							? 'bg-emerald-500'
							: server.status === 'provisioning'
								? 'animate-pulse bg-blue-500'
								: server.status === 'restarting'
									? 'animate-pulse bg-amber-500'
									: 'bg-red-500'}"
					></span>
				</button>
			{/each}

			{#if servers.length === 0}
				<div class="flex flex-col items-center justify-center py-16 text-gray-500">
					<HardDrive class="mb-3 h-6 w-6" />
					<p class="text-xs">No servers</p>
				</div>
			{/if}
		</div>
	</div>

	<!-- Main content -->
	<div class="flex flex-1 flex-col overflow-hidden">
		{@render children()}
	</div>
</div>
