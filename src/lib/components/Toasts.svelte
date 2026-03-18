<script lang="ts">
	import { getToasts, dismissToast } from '$lib/stores/toast.svelte.js';

	let toasts = $derived(getToasts());
</script>

{#if toasts.length > 0}
	<div class="toast-container">
		{#each toasts as toast (toast.id)}
			<div class="toast toast-{toast.type}">
				<div class="toast-icon">
					{#if toast.type === 'success'}&#10003;{:else if toast.type === 'error'}&#10007;{:else}&#9888;{/if}
				</div>
				<div class="toast-body">
					<span class="toast-message">{toast.message}</span>
					{#if toast.details}
						<span class="toast-details">{toast.details}</span>
					{/if}
				</div>
				<button class="toast-dismiss" onclick={() => dismissToast(toast.id)}>&#10005;</button>
			</div>
		{/each}
	</div>
{/if}

<style>
	.toast-container {
		position: fixed;
		bottom: 1.5rem;
		right: 1.5rem;
		z-index: 9999;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		max-width: 420px;
		width: calc(100% - 3rem);
	}

	.toast {
		display: flex;
		align-items: flex-start;
		gap: 0.625rem;
		padding: 0.75rem 1rem;
		border-radius: 8px;
		background: var(--color-surface-raised);
		border: 1px solid var(--color-border);
		box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
		animation: slide-in 0.2s ease-out;
	}

	@keyframes slide-in {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.toast-error {
		border-color: var(--color-danger);
	}

	.toast-success {
		border-color: var(--color-synced);
	}

	.toast-warning {
		border-color: var(--color-partial);
	}

	.toast-icon {
		flex-shrink: 0;
		width: 20px;
		height: 20px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.75rem;
		font-weight: 700;
		border-radius: 50%;
	}

	.toast-error .toast-icon {
		background: rgba(212, 80, 80, 0.15);
		color: var(--color-danger);
	}

	.toast-success .toast-icon {
		background: rgba(76, 175, 106, 0.15);
		color: var(--color-synced);
	}

	.toast-warning .toast-icon {
		background: rgba(212, 168, 67, 0.15);
		color: var(--color-partial);
	}

	.toast-body {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.1875rem;
	}

	.toast-message {
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--color-text);
	}

	.toast-details {
		font-size: 0.75rem;
		color: var(--color-text-muted);
		white-space: pre-wrap;
		word-break: break-word;
	}

	.toast-dismiss {
		flex-shrink: 0;
		background: none;
		border: none;
		color: var(--color-text-faint);
		cursor: pointer;
		padding: 0;
		font-size: 0.75rem;
		line-height: 1;
	}

	.toast-dismiss:hover {
		color: var(--color-text);
	}
</style>
