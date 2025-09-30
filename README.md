# HyperSignal on Cloudflare

HyperSignal is a Next.js dashboard that monitors Hyperliquid wallets, clusters fills into actionable trading signals, and keeps a full audit trail of its automation. The application now runs entirely on Cloudflare's free tier:

- **Cloudflare Pages** serves the Next.js dashboard and API routes.
- **Cloudflare D1** stores all persistent state (signals, wallets, settings, analytics, logs).
- **Cloudflare Workers Cron** runs the background automation so detection continues 24/7 even when no browser is open.

## Prerequisites

- Node.js 18+
- npm 10+
- A free Cloudflare account with access to Pages, Workers and D1

## Local development

```bash
npm install
npm run dev      # Start the Next.js dashboard on http://localhost:9002
npm run typecheck
```

When running locally the app still expects Cloudflare bindings. You can emulate them with `wrangler pages dev` once you have created the D1 database (see deployment walkthrough below).

## Cloudflare deployment walkthrough

The following beginner friendly guide walks through every Cloudflare step. You only need the Cloudflare dashboard—no CLI knowledge is required beyond pasting commands that the UI provides.

### 1. Prepare your repository

1. Push this project to a GitHub repository (private or public).
2. Ensure `migrations/0001_init.sql` is committed; Cloudflare will run it automatically when the D1 database is created.

### 2. Create the D1 database

1. Log in to [dash.cloudflare.com](https://dash.cloudflare.com) and pick your account.
2. Open **Workers & Pages → D1** and click **Create**.
3. Name the database `hypersignal` (or any name you prefer) and confirm.
4. After creation, open the database details and note the **Database ID**—you will paste it into `wrangler.toml` later for local development. Cloudflare Pages automatically wires it in production, so no code changes are required.

### 3. Connect GitHub to Cloudflare Pages

1. Navigate to **Workers & Pages → Pages** and click **Create application**.
2. Choose **Connect to Git** and select the repository that hosts HyperSignal.
3. In the build configuration, set:
   - **Framework preset:** `Next.js`
   - **Build command:** `npx @cloudflare/next-on-pages build`
   - **Build output directory:** `.vercel/output/static`
   - **Root directory:** leave empty (project root)
4. Add the following environment variables under **Build settings → Environment variables**:
   - `NODE_VERSION = 18`
   - `NPM_FLAGS = --legacy-peer-deps` (prevents strict install failures on the free tier)
5. Save and start the first deploy. Cloudflare will install dependencies, build the Next.js project for the Pages runtime and ship the static assets plus API handlers.

### 4. Bind the D1 database to the Pages project

1. Inside the newly created Pages project, open **Settings → Functions**.
2. Click **Add binding → D1 database** and choose the `hypersignal` database you created earlier.
3. Set the binding name to `DB`. This matches the codebase and enables all API routes and server actions to talk to D1 automatically.

### 5. Schedule the automation worker

1. Still within your account, go to **Workers & Pages → Workers** and click **Create Worker**.
2. Choose **Deploy** to generate an empty worker, then switch to the **Quick edit** view.
3. Replace the default script with the contents of `cloudflare/worker.ts` and save.
4. Under **Settings → Triggers** enable **Cron Triggers** and add the schedule `*/5 * * * *` (every five minutes) or adjust as needed.
5. In **Settings → Bindings** add the same D1 database with the binding name `DB`.
6. (Optional) Copy the worker URL and store it in a safe place—you can manually trigger a run with `curl -X POST https://<worker-subdomain>.workers.dev/run`.

### 6. Verify the live dashboard

1. Open your Pages deployment URL. The dashboard will call the bundled API routes (served from Cloudflare Pages functions) which talk to D1.
2. Use the **Logs** tab to confirm the worker is writing entries every time it runs.
3. Configure Telegram or additional wallets through the Settings page—the changes persist in D1, so every subsequent deploy reuses the same data.

## Architecture overview

- **Cloudflare-first persistence** – `src/server/storage/jsonStore.ts` now stores all structured JSON data in the D1 table `kv_store`, so every part of the app (UI, APIs, worker automation) shares the same durable backend.
- **Automation as a Worker** – `cloudflare/worker.ts` executes the detection and price refresh loops on a schedule. It uses the same service layer as the dashboard and logs progress back into D1.
- **API consumption from the UI** – Front-end pages call the REST endpoints served by Next.js on Cloudflare Pages. Because everything runs on the same origin you don’t need extra configuration—the dashboard simply polls `/api/**` routes.

## Useful scripts

```bash
npm run dev        # Local Next.js dev server (requires wrangler for D1 emulation)
npm run build      # Production build (used by Cloudflare Pages)
npm run start      # Serve the production build locally
npm run typecheck  # Static type checks
```

## Manual worker testing

You can run the Cloudflare worker logic locally through Wrangler once you have configured your `wrangler.toml` with the database ID:

```bash
npx wrangler d1 migrations apply hypersignal --local
npx wrangler dev --test-scheduled
```

This spins up the worker, injects a temporary D1 database and executes the scheduled job so you can verify signal detection without deploying.
