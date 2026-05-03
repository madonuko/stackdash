<script lang="ts">
	import { getServerWithFallback } from '$lib/state/servers.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Switch } from '$lib/components/ui/switch';

	let { data } = $props();
	let selectedServer = $derived(getServerWithFallback(data.serverId, data.server));
	let rescueEnabled = $state(false);
</script>

<div class="max-w-xl space-y-5 p-5">
	<div>
		<h2 class="text-sm font-semibold text-gray-100">Rescue Mode</h2>
		<p class="mt-1 text-xs text-gray-500">
			Boot {selectedServer.name} into a temporary rescue environment.
		</p>
	</div>
	<div class="flex items-center justify-between border border-gray-800 p-4">
		<div>
			<p class="text-sm font-medium text-gray-100">Enable rescue mode</p>
			<p class="mt-1 text-xs text-gray-500">Requires a restart to apply.</p>
		</div>
		<Switch bind:checked={rescueEnabled} />
	</div>
	{#if rescueEnabled}<div
			class="border border-amber-800 bg-amber-950/20 p-4 text-xs text-amber-300"
		>
			Temporary password: <span class="font-mono">xK9m$2pL!qR7</span>
		</div>{/if}
	<Button variant="outline" class="border-amber-700 text-amber-400 hover:bg-amber-950"
		>Apply Rescue Mode</Button
	>
</div>
