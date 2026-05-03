<script lang="ts">
	import { getServerWithFallback } from '$lib/state/servers.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';

	let { data } = $props();
	let selectedServer = $derived(getServerWithFallback(data.serverId, data.server));
	let nameValue = $derived(selectedServer.name);
</script>

<div class="max-w-xl space-y-5 p-5">
	<div>
		<h2 class="text-sm font-semibold text-gray-100">Server Settings</h2>
		<p class="mt-1 text-xs text-gray-500">Manage basic settings for {selectedServer.name}.</p>
	</div>
	<div class="space-y-2"><Label>Server Name</Label><Input bind:value={nameValue} /></div>
	<div class="space-y-2">
		<Label>Server ID</Label><Input value={selectedServer.id} disabled class="font-mono" />
	</div>
	<div class="flex gap-2">
		<Button size="sm">Save Changes</Button><Button
			variant="outline"
			size="sm"
			class="border-red-700 text-red-400 hover:bg-red-950">Delete Server</Button
		>
	</div>
</div>
