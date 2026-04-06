# stack-dashboard

SvelteKit app configured for Cloudflare Workers with Wrangler JSONC config.

## Local development

Install dependencies, then start the standard Vite dev server:

```sh
bun install
bun run dev
```

To run against the Cloudflare Workers runtime locally:

```sh
bun run cf:dev
```

If you do not have a direct local or test Postgres connection string, use the real Cloudflare runtime instead:

```sh
bun run cf:dev:remote
```

Create a `.dev.vars` file from [`.dev.vars.example`](./.dev.vars.example) for local Wrangler vars. Wrangler does not read your app's `.env` file for these bindings:

```sh
ORIGIN="http://127.0.0.1:8787"
BETTER_AUTH_SECRET="replace-with-a-long-random-secret"
CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE="postgres://user:password@host:5432/database?sslmode=require"
```

For `wrangler dev`, Hyperdrive local development can use either:

```sh
export CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE="postgres://user:password@host:5432/database?sslmode=require"
```

or `localConnectionString` inside [`wrangler.jsonc`](/Users/addison/dev/stack/stack-dashboard/wrangler.jsonc).

`bun run dev` does not run inside Wrangler, so it falls back to `DATABASE_URL` from your local env:

```sh
DATABASE_URL="postgres://user:password@host:port/db-name"
```

## Cloudflare deployment

The project uses [`wrangler.jsonc`](./wrangler.jsonc) and the Cloudflare SvelteKit adapter. Build and deploy with:

```sh
bun run build
bun run cf:deploy
```

In Cloudflare, set these Worker secrets or plain-text vars before deploying:

- `ORIGIN`
- `BETTER_AUTH_SECRET`

The production database connection is provided by the `HYPERDRIVE` binding in [`wrangler.jsonc`](/Users/addison/dev/stack/stack-dashboard/wrangler.jsonc), not by `DATABASE_URL`.
