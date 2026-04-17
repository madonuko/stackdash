import type { User, Session } from 'better-auth';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from '$lib/server/db/schema';

export type Database = NodePgDatabase<typeof schema>;

/** Passed to every remote function on dispatch. */
export interface RpcContext {
	user: User;
	session: Session;
	db: Database;
}

/**
 * A remote function: takes typed params + context, returns typed data.
 * These are pure business logic — the barrel route handles HTTP for them.
 */
export type RpcFunction<TParams = unknown, TResult = unknown> = (
	params: TParams,
	ctx: RpcContext
) => Promise<TResult>;

/** Map of dotted function names to their implementations. */
export type FunctionRegistry = Record<string, RpcFunction<any, any>>;

/** Thrown by remote functions to signal a client-facing error. */
export class RpcError extends Error {
	status: number;

	constructor(status: number, message: string) {
		super(message);
		this.status = status;
	}
}
