<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	onMount(() => {
		goto('/servers');
	});
</script>

<div class="flex h-full items-center justify-center">
	<p class="text-sm text-fyra-gray-500">Redirecting to servers...</p>
</div>
