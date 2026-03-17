<script lang="ts">
	import '../app.css';

	let { children } = $props();
</script>

<svelte:head>
	<title>Rockbox Manager</title>
</svelte:head>

{@render children()}
