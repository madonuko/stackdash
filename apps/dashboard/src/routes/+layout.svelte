<script lang="ts">
	import './layout.css';
	import NavigationProgress from '$lib/components/navigation-progress.svelte';

	let { children } = $props();
</script>

<NavigationProgress />

{@render children()}
