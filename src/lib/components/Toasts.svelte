<script lang="ts">
	import { getToasts, dismissToast } from '$lib/stores/toast.svelte.js';

	let toasts = $derived(getToasts());
</script>

{#if toasts.length > 0}
	<div class="toast-container">
		{#each toasts as toast (toast.id)}
			<div
				class="toast toast-{toast.type}"
				style="--duration: {toast.duration}ms"
			>
				<div class="toast-icon">
					{#if toast.type === 'success'}
						<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
							<path d="M3 8l3.5 3.5L13 4.5" />
						</svg>
					{:else if toast.type === 'error'}
						<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
							<path d="M4 4l8 8M12 4l-8 8" />
						</svg>
					{:else}
						<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M8 2L14 13H2L8 2z" /><path d="M8 7v3" /><circle cx="8" cy="11.5" r="0.5" fill="currentColor" />
						</svg>
					{/if}
				</div>
				<div class="toast-body">
					<span class="toast-message">{toast.message}</span>
					{#if toast.details}
						<span class="toast-details">{toast.details}</span>
					{/if}
				</div>
				<button class="toast-dismiss" onclick={() => dismissToast(toast.id)} aria-label="Dismiss">
					<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
						<path d="M4 4l8 8M12 4l-8 8" />
					</svg>
				</button>
				{#if toast.duration > 0}
					<div class="toast-progress"></div>
				{/if}
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
		max-width: 380px;
		width: calc(100% - 3rem);
	}

	.toast {
		position: relative;
		display: flex;
		align-items: flex-start;
		gap: 0.625rem;
		padding: 0.75rem 1rem 0.875rem;
		border-radius: 8px;
		background: var(--color-surface-raised);
		border: 1px solid var(--color-border);
		box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
		animation: slide-in 0.2s ease-out;
		overflow: hidden;
	}

	@keyframes slide-in {
		from {
			opacity: 0;
			transform: translateX(16px);
		}
		to {
			opacity: 1;
			transform: translateX(0);
		}
	}

	.toast-error { border-color: var(--color-danger); }
	.toast-success { border-color: var(--color-synced); }
	.toast-warning { border-color: var(--color-partial); }

	.toast-icon {
		flex-shrink: 0;
		width: 22px;
		height: 22px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		margin-top: 1px;
	}

	.toast-icon svg {
		width: 12px;
		height: 12px;
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
		gap: 0.25rem;
	}

	.toast-message {
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--color-text);
		line-height: 1.4;
	}

	.toast-details {
		font-size: 0.75rem;
		color: var(--color-text-muted);
		white-space: pre-wrap;
		word-break: break-word;
		line-height: 1.4;
	}

	.toast-dismiss {
		flex-shrink: 0;
		background: none;
		border: none;
		color: var(--color-text-faint);
		cursor: pointer;
		padding: 2px;
		border-radius: 3px;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-top: 1px;
		transition: color 0.1s, background 0.1s;
	}

	.toast-dismiss svg {
		width: 12px;
		height: 12px;
	}

	.toast-dismiss:hover {
		color: var(--color-text);
		background: rgba(255, 255, 255, 0.06);
	}

	/* Auto-dismiss progress bar */
	.toast-progress {
		position: absolute;
		bottom: 0;
		left: 0;
		height: 2px;
		width: 100%;
		transform-origin: left;
		animation: shrink-progress var(--duration, 4000ms) linear forwards;
	}

	.toast-success .toast-progress { background: var(--color-synced); opacity: 0.5; }
	.toast-error .toast-progress { background: var(--color-danger); opacity: 0.5; }
	.toast-warning .toast-progress { background: var(--color-partial); opacity: 0.5; }

	@keyframes shrink-progress {
		from { transform: scaleX(1); }
		to { transform: scaleX(0); }
	}
</style>
