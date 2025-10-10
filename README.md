# HyperSignal on Cloudflare

HyperSignal is a Next.js dashboard that monitors Hyperliquid wallets, clusters fills into actionable trading signals, and keeps a full audit trail of its automation. The application now runs entirely on Cloudflare Workers using [OpenNext](https://github.com/opennextjs/opennextjs-cloudflare):

- **Cloudflare Workers (OpenNext)** serve the Next.js dashboard, API routes, and background automation from a single worker script.
- **Cloudflare D1** stores all persistent state (signals, wallets, settings, analytics, logs) and is exposed to the worker under the binding name `DB`.
- **Cloudflare Workers Cron** triggers the same worker every five minutes so detection continues 24/7 even when no browser is open.

## Prerequisites

- Node.js 20+
- npm 10+
- A Cloudflare account with access to Workers and D1

## Local development

```bash
npm install
npm run dev      # Start the Next.js dashboard on http://localhost:9002
npm run typecheck
```

The worker expects Cloudflare bindings. Populate `.dev.vars` (already added with `NEXTJS_ENV=development`) and use Wrangler's local D1 emulation when you need to exercise the worker runtime:

```bash
npx wrangler d1 migrations apply hypersignal --local
npm run preview   # Builds with OpenNext and runs wrangler dev + assets
```

## Cloudflare deployment walkthrough

### 1. Create the D1 database

1. Log in to [dash.cloudflare.com](https://dash.cloudflare.com) and pick your account.
2. Open **Workers & Pages → D1** and click **Create**.
3. Name the database `hypersignal` (or any name you prefer) and confirm.
4. After creation, copy the **Database ID** and paste it into `wrangler.jsonc` under the `database_id` field for the `DB` binding.

### 2. Deploy the Worker

All deployment commands are driven by OpenNext through Wrangler. They compile the Next.js application, generate the `.open-next` worker bundle, patch in the cron handler, and push everything to Cloudflare.

```bash
npm run deploy   # Builds via OpenNext, patches cron handler, and deploys with wrangler
```

Use `npm run upload` if you only want to push the assets without publishing, or `npm run preview` to run Wrangler's preview environment locally before promoting.

### 3. Verify the live dashboard

1. Open the worker's deployed URL. The dashboard will call the bundled API routes which talk to D1.
2. Use the **Workers → Triggers** tab to confirm the cron schedule (`*/5 * * * *`) is active.
3. Inspect the **Logs** tab or the in-app Logs page to confirm the automation route runs on every cron tick.

## Architecture overview

- **Cloudflare-first persistence** – `src/server/storage/jsonStore.ts` stores structured JSON data in the D1 table `kv_store`, so every part of the app (UI, APIs, worker automation) shares the same durable backend.
- **Automation inside the Worker** – `src/app/api/automation/run/route.ts` encapsulates the background job. Cron triggers call this route through the generated worker, reusing the same service layer and logging progress back into D1.
- **API consumption from the UI** – Front-end pages call the REST endpoints served by the Next.js app on Cloudflare Workers. Because everything runs on the same origin you don’t need extra configuration—the dashboard simply polls `/api/**` routes.

## Useful scripts

```bash
npm run dev        # Local Next.js dev server (requires Wrangler for D1 emulation)
npm run build      # Production build (Next.js only)
npm run preview    # Build with OpenNext and run wrangler dev for the worker bundle
npm run deploy     # Build with OpenNext and deploy the Cloudflare worker
npm run upload     # Build with OpenNext and upload assets/bundle without publishing
npm run cf:typegen # Generate cloudflare-env.d.ts from Wrangler bindings
```

## Manual worker testing

Wrangler can execute the cron handler locally so you can validate automation without deploying:

```bash
npx wrangler d1 migrations apply hypersignal --local
npx wrangler dev --test-scheduled
```

This spins up the worker, injects a temporary D1 database and executes the scheduled job so you can verify signal detection without pushing to production.
