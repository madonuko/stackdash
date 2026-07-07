# Stack Dashboard

## Usage (dev)

1. `pnpm install`
2. Start a Postgres server: `podman run -p 5432:5432 -e POSTGRES_PASSWORD=mysecretpassword -d postgres`
3. Copy `apps/dashboard/.env.example` to `apps/dashboard/.env`
4. Add secrets to `apps/dashboard/.env`
   - Update `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` and set all `VPC` stuff to false
   - set `BETTER_AUTH_SECRET`, `AUTUMN_SECRET` to anything
5. Set up the database: `pnpm --filter stack-dashboard db:migrate`
6. `pnpm --filter stack-dashboard dev`

### Postgres Setup

- If you want the data to persist:
  - `podman volume create postgres_volume`
  - `podman run -p 5432:5432 --replace --name dashboard_postgres -e POSTGRES_PASSWORD=mysecretpassword -v postgres_volume:/var/lib/postgresql -d postgres`
- More detailed guide: https://orm.drizzle.team/docs/guides/postgresql-local-setup

### secrets

- Required:
  - Generate Better Auth
  - Autumn
  - Postgres connection URL
    - if you use the podman command(s) listed above, the connection string is `postgres://postgres:mysecretpassword@127.0.0.1:5432/postgres`
- Highly recommended:
  - Proxmox
- Optional:
  - VyOS
  - GitHub
  - Google
  - Billing meter secret
  - Cloudflare email key
