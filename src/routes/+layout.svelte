<script lang="ts">
	import '../app.css';
	import Toasts from '$lib/components/Toasts.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<title>Rockbox Manager</title>
</svelte:head>

{@render children()}
<Toasts />
