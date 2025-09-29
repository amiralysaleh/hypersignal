# Hypersignal Dashboard

This project provides a Next.js dashboard for monitoring Hyperliquid wallet activity along with a standalone background worker that continuously detects new signals and keeps performance data fresh.

## Getting started

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Run the development server**

   ```bash
   npm run dev
   ```

3. **Start the background worker** (in a separate process) to keep detection logic running 24/7:

   ```bash
   npm run worker
   ```

The dashboard consumes the REST APIs under `src/app/api`, so the UI stays in sync with the background job even if no browser tab is open.
