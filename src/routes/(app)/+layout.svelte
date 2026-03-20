<script lang="ts">
	import AppShell from '$lib/components/AppShell.svelte';
	import { invalidateAll, onNavigate } from '$app/navigation';

	onNavigate((navigation) => {
		if (!document.startViewTransition) return;
		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
		});
	});

	let { children, data } = $props();

	async function handlePlayerSelect(playerId: number) {
		try {
			const response = await fetch(`/api/players/${playerId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'activate' })
			});

			if (response.ok) {
				// Reload page data to reflect the new active player
				invalidateAll();
			} else {
				console.error('Failed to activate player');
			}
		} catch (err) {
			console.error('Error activating player:', err);
		}
	}
</script>

<AppShell
	players={data.players}
	activePlayer={data.activePlayer}
	onPlayerSelect={handlePlayerSelect}
>
	{@render children()}
</AppShell>