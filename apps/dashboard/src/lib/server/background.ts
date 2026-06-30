import { getRequestEvent } from '$app/server';

export function runInBackground(work: Promise<unknown>, label?: string) {
	const guarded = work.catch((error) => {
		console.error(`Background task${label ? ` (${label})` : ''} failed`, error);
	});

	getRequestEvent().platform?.ctx?.waitUntil(guarded);
}
