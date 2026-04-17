import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dispatch, RpcError, functionNames } from '$lib/server/rpc';
import { initDrizzle } from '$lib/server/db';

/**
 * Barrel route — every remote function is reachable via:
 *
 *   POST /api/rpc/<function.name>
 *   Body: JSON params (or empty object)
 *
 * Response envelope:
 *   { ok: true,  data: <result> }
 *   { ok: false, error: <message> }
 */
export const POST: RequestHandler = async ({ params, request, locals }) => {
	const name = params.fn;

	// Bare /api/rpc with no function name → list available functions
	if (!name) {
		return json({ ok: true, functions: functionNames });
	}

	// Auth gate — every RPC call requires a session
	if (!locals.user || !locals.session) {
		return json({ ok: false, error: 'Authentication required' }, { status: 401 });
	}

	// Parse params from request body (allow empty body for parameterless fns)
	let body: unknown = {};
	try {
		const text = await request.text();
		if (text) body = JSON.parse(text);
	} catch {
		return json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
	}

	try {
		const db = initDrizzle();
		const result = await dispatch(name, body, {
			user: locals.user,
			session: locals.session,
			db
		});

		return json({ ok: true, data: result ?? null });
	} catch (err) {
		if (err instanceof RpcError) {
			return json({ ok: false, error: err.message }, { status: err.status });
		}

		// Surface ky/fetch errors from backend providers with their real status
		if (err && typeof err === 'object' && 'response' in err) {
			const httpErr = err as { response: Response; data?: { message?: string } };
			const status = httpErr.response?.status ?? 502;
			const detail = httpErr.data?.message ?? httpErr.response?.statusText ?? 'Backend request failed';
			console.error(`[rpc] ${name} backend error (${status}):`, detail);
			return json({ ok: false, error: `Backend error: ${detail.trim()}` }, { status });
		}

		console.error(`[rpc] ${name} failed:`, err);
		return json({ ok: false, error: 'Internal server error' }, { status: 500 });
	}
};

/**
 * GET /api/rpc — list available functions.
 * GET /api/rpc/<name> — not allowed (use POST).
 */
export const GET: RequestHandler = async ({ params }) => {
	if (params.fn) {
		return json(
			{ ok: false, error: 'Use POST to call remote functions' },
			{ status: 405 }
		);
	}

	return json({ ok: true, functions: functionNames });
};
