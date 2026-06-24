<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { Plus, Server } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import { serversState } from '$lib/state/servers.svelte';

	const shouldShowEmptyState = $derived(
		!serversState.loading &&
			serversState.firstStatusRefreshComplete &&
			serversState.servers.length === 0
	);
</script>

{#if shouldShowEmptyState}
	<div class="flex h-full flex-col items-center justify-center text-gray-500">
		<div class="flex flex-col items-center text-center">
			<div class="flex w-80 flex-col items-center gap-4 border border-dashed border-gray-700 p-8">
				<Server class="size-6 text-gray-500" />
				<div>
					<p class="text-sm font-medium text-gray-300">No servers deployed</p>
					<p class="mt-1 text-xs text-gray-500">
						This project has no servers yet. Deploy your first VPS to get started.
					</p>
				</div>
				<Button
					variant="outline"
					size="sm"
					class="mt-2 gap-1.5 border-gray-700 text-gray-300 hover:border-gray-600 hover:bg-gray-800 hover:text-gray-100"
					onclick={() => goto(`/projects/${page.params.projectid}/servers/create`)}
				>
					<Plus class="size-3.5" />
					New Server
				</Button>
			</div>
		</div>
	</div>
{:else}
	<div class="flex h-full items-center justify-center text-xs text-gray-500">Loading server...</div>
{/if}
