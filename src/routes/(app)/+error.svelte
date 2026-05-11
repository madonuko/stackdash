<script lang="ts">
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
</script>

<svelte:head>
	<title>{page.status} / Stack</title>
</svelte:head>

<div class="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 text-center">
	<p class="text-4xl font-bold text-gray-100">{page.status}</p>
	<p class="text-sm text-gray-400">{page.error?.message ?? 'Something went wrong'}</p>
	<Button variant="outline" size="sm" class="mt-2" onclick={() => goto(resolve('/'))}>
		Go Home
	</Button>
</div>
