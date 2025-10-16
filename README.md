# HyperSignal on Cloudflare

HyperSignal is a Next.js dashboard that monitors Hyperliquid wallets, clusters fills into actionable trading signals, and keeps a full audit trail of its automation. The application now runs entirely on Cloudflare Workers using [OpenNext](https://github.com/opennextjs/opennextjs-cloudflare):

- **Cloudflare Workers (OpenNext)** serve the Next.js dashboard, API routes, and background automation from a single worker script.
- **Cloudflare D1** stores all persistent state (signals, wallets, settings, analytics, logs) and is exposed to the worker under the binding name `DB`.
- **Cloudflare Durable Objects + Alarms** keep the automation loop running continuously without relying on cron triggers. The Durable Object schedules alarms, calls the automation route, and reschedules itself after every run.

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

All deployment commands are driven by OpenNext through Wrangler. They compile the Next.js application, generate the `.open-next` worker bundle, patch in the Durable Object scheduler, and push everything to Cloudflare.

```bash
npm run deploy   # Builds via OpenNext, patches Durable Object scheduler, and deploys with wrangler
```

Use `npm run upload` if you only want to push the assets without publishing, or `npm run preview` to run Wrangler's preview environment locally before promoting.

### 3. Verify the live dashboard

1. Open the worker's deployed URL. The dashboard will call the bundled API routes which talk to D1.
2. From your terminal run `curl -X POST https://<your-worker-domain>/api/automation/bootstrap` (or trigger the same route via the dashboard once available). This instantiates the Durable Object and schedules the first alarm.
3. Inspect the **Logs** tab or the in-app Logs page to confirm the automation route executes after each alarm.

## Architecture overview

- **Cloudflare-first persistence** – `src/server/storage/jsonStore.ts` stores structured JSON data in the D1 table `kv_store`, so every part of the app (UI, APIs, worker automation) shares the same durable backend.
- **Automation inside the Worker** – `src/app/api/automation/run/route.ts` encapsulates the background job. The Durable Object alarm calls this route through the generated worker, reusing the same service layer and logging progress back into D1.
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

Wrangler can run the automation scheduler locally so you can validate signal detection without deploying:

```bash
npx wrangler d1 migrations apply hypersignal --local
npx wrangler dev
# In another terminal once wrangler dev is running:
curl -X POST http://127.0.0.1:8787/api/automation/bootstrap
```

Wrangler will emulate the worker, D1, and Durable Object locally. Bootstrapping schedules the first alarm; subsequent alarms will continue without additional intervention
