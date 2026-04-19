<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { onMount, setContext, getContext } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { listVms } from '$lib/remote/vms.remote';
	import { Loader2, HardDrive, Plus } from '@lucide/svelte';

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

	let servers = $state<ServerInfo[]>([]);
	let loadingVms = $state(false);
	let vmError = $state('');

	function formatBytes(bytes: number): string {
		if (!bytes) return '0B';
		const gb = bytes / (1024 * 1024 * 1024);
		if (gb >= 1) return `${gb.toFixed(0)}GB`;
		const mb = bytes / (1024 * 1024);
		return `${mb.toFixed(0)}MB`;
	}

	async function loadVms() {
		const projectId = data.projects?.[0]?.id;
		if (!projectId) {
			servers = [];
			return;
		}

		loadingVms = true;
		vmError = '';
		try {
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
			const vms = await listVms({ projectId });
			servers = vms
				.filter((v) => v.active)
				.map((vm) => {
					const ip = vm.live?.networkInterfaces
						? (Object.values(vm.live.networkInterfaces)
								.flatMap((i) => i.ipAddresses ?? [])
								.find((a) => a && !a.startsWith('127.') && !a.includes(':')) ?? '—')
						: '—';
					const ipv6 = vm.live?.networkInterfaces
						? (Object.values(vm.live.networkInterfaces)
								.flatMap((i) => i.ipAddresses ?? [])
								.find((a) => a?.includes(':')) ?? '—')
						: '—';
					const vmStatus: ServerInfo['status'] =
						vm.status === 'provisioning'
							? 'provisioning'
							: ((vm.live?.status ?? 'stopped') as 'running' | 'stopped' | 'restarting');
					return {
						id: vm.id,
						name: vm.live?.name ?? vm.id,
						vcpu: vm.live?.cores ?? vm.vmType?.cores ?? 0,
						ram: formatBytes(vm.live?.memory ?? (vm.vmType?.ramCapacity ?? 0) * 1024 * 1024),
						disk: formatBytes(
							vm.live?.disk ?? (vm.vmType?.storageAmount ?? 0) * 1024 * 1024 * 1024
						),
						ip,
						ipv6,
						status: vmStatus,
						agentConnected: vm.live?.status === 'running',
						os: vm.vmType?.name ?? 'Unknown',
						region: 'New York',
						created: vm.creationDate,
						uptime: '',
						plan: vm.vmType?.name ?? 'Custom',
						backups: false
					};
				});
			if (servers.some((s) => s.status === 'provisioning')) {
				setTimeout(() => loadVms(), 3000);
			}
		} catch (err) {
			vmError = err instanceof Error ? err.message : 'Failed to load VMs';
		} finally {
			loadingVms = false;
		}
	}

	onMount(() => {
		loadVms();
	});

	$effect(() => {
		setContext(SERVER_CONTEXT_KEY, servers);
	});

	const currentPath = $derived(page.url.pathname);
	const isCreatePage = $derived(currentPath === '/servers/create');
	const selectedServerId = $derived(
		isCreatePage ? null : currentPath.startsWith('/servers/') ? currentPath.split('/').pop() : null
	);
</script>

<div class="flex h-full overflow-hidden">
	<!-- Server list sidebar -->
	<div class="flex w-64 shrink-0 flex-col border-r border-fyra-gray-800">
		<div class="flex h-10 shrink-0 items-center justify-between border-b border-fyra-gray-800 px-4">
			<div class="flex items-center">
				<span class="text-sm font-semibold text-fyra-gray-100">Servers</span>
				<Badge variant="secondary" class="ml-2 text-[10px]">{servers.length}</Badge>
			</div>
			<Button
				variant="ghost"
				size="sm"
				class="h-6 w-6 p-0 text-fyra-gray-400 hover:text-fyra-gray-100"
				onclick={() => goto('/servers/create')}
			>
				<Plus class="h-3.5 w-3.5" />
			</Button>
		</div>
		<div class="flex-1 overflow-y-auto">
			{#each servers as server (server.id)}
				<button
					class="flex w-full items-start justify-between border-b border-fyra-gray-800 px-4 py-3 text-left transition-colors duration-100 {selectedServerId ===
					server.id
						? 'bg-fyra-gray-800/60'
						: 'hover:bg-fyra-gray-800/30'}"
					onclick={() => goto(`/servers/${server.id}`)}
				>
					<div class="min-w-0">
						<p class="truncate text-sm font-semibold text-fyra-gray-100">{server.name}</p>
						<p class="mt-0.5 truncate text-xs text-fyra-gray-500">
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
									: 'bg-fyra-red-500'}"
					></span>
				</button>
			{/each}

			{#if loadingVms}
				<div class="flex flex-col items-center justify-center py-16 text-fyra-gray-500">
					<Loader2 class="mb-3 h-5 w-5 animate-spin" />
					<p class="text-xs">Loading...</p>
				</div>
			{:else if servers.length === 0}
				<div class="flex flex-col items-center justify-center py-16 text-fyra-gray-500">
					<HardDrive class="mb-3 h-6 w-6" />
					<p class="text-xs">No servers</p>
					<Button
						variant="outline"
						size="sm"
						class="mt-3 gap-1.5 text-xs"
						onclick={() => goto('/servers/create')}
					>
						<Plus class="h-3 w-3" />
						Create Server
					</Button>
				</div>
			{/if}
		</div>

		<!-- Create Server link at bottom -->
		<button
			class="flex w-full items-center gap-2 border-t border-fyra-gray-800 px-4 py-3 text-left transition-colors duration-100 {isCreatePage
				? 'bg-fyra-gray-800/60'
				: 'hover:bg-fyra-gray-800/30'}"
			onclick={() => goto('/servers/create')}
		>
			<Plus class="h-4 w-4 text-fyra-gray-500" />
			<span class="text-sm font-medium text-fyra-gray-300">Create Server</span>
		</button>
	</div>

	<!-- Main content -->
	<div class="flex flex-1 flex-col overflow-hidden">
		{@render children()}
	</div>
</div>
