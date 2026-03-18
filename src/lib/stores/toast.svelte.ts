export interface Toast {
	id: number;
	type: 'success' | 'error' | 'warning';
	message: string;
	details?: string;
}

let nextId = 0;
let toasts = $state<Toast[]>([]);

export function getToasts(): Toast[] {
	return toasts;
}

export function addToast(type: Toast['type'], message: string, details?: string, duration = 6000) {
	const id = nextId++;
	toasts = [...toasts, { id, type, message, details }];

	if (duration > 0) {
		setTimeout(() => dismissToast(id), duration);
	}
}

export function dismissToast(id: number) {
	toasts = toasts.filter(t => t.id !== id);
}
