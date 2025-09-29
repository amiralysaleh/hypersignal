# HyperSignal Dashboard

This project is a Next.js dashboard that keeps track of Hyperliquid wallets, clusters fills into actionable trading signals, and keeps a rolling log of what the automation is doing.

The application persists its state to JSON files at the project root (`signals.json`, `wallets.json`, `settings.json`, and `logs.json`). Every server action in the dashboard reads and writes through these files which makes it easy to understand and debug the system.

## Prerequisites

- Node.js 18 or newer (provides the built-in `fetch` API used by the worker)
- npm 10+

## Available scripts

```bash
npm run dev      # Start the Next.js dashboard on http://localhost:9002
npm run build    # Create a production build
npm run start    # Serve the production build
npm run worker   # Run the background worker that keeps signals in sync 24/7
```

The background worker imports the same server actions that power the dashboard UI. It periodically:

1. Calls `detectAndSaveSignals` to scan tracked wallets for new clustered positions.
2. Calls `updateSignalPrices` to refresh PnL / ROI and close signals that have hit TP/SL.
3. Writes detailed progress (and any errors) to `logs.json` so the dashboard can show a live audit trail.

By default the worker detects new signals every 60 seconds and refreshes prices every 30 seconds. You can override those defaults with environment variables:

```bash
DETECTION_INTERVAL_MS=120000 PRICE_REFRESH_INTERVAL_MS=60000 npm run worker
```

For production deployments run the worker alongside the Next.js server. A typical configuration is to keep the worker alive with a process manager such as `pm2`, Docker, or a systemd service.

### Avoiding Hyperliquid rate limits

The worker spaces Hyperliquid API calls so coordinated trading signals continue to flow even when the dashboard is closed. You can fine-tune that behaviour with environment variables if you hit remote rate limits:

```bash
# Ensure at least one request every 1.5 seconds and cap retry backoff at 2 minutes
HYPERLIQUID_MIN_REQUEST_INTERVAL_MS=1500 \
USER_FILLS_INITIAL_BACKOFF_MS=2000 \
USER_FILLS_MAX_BACKOFF_MS=120000 npm run worker
```

When the API responds with HTTP 429 the worker retries with exponential backoff and logs the event, so no signals are lost—the UI continues to receive up-to-date data via the REST endpoints as soon as the retry succeeds.

## Project structure

- `src/app/(dashboard)/**` – Dashboard pages and the server actions that power them.
- `signals.json` – Persisted signals detected from the blockchain.
- `wallets.json` – Wallet registry with stats and cooldown metadata.
- `settings.json` – Operator configurable thresholds (minimum wallets, time window, TP/SL values, Telegram credentials, etc.).
- `logs.json` – Rolling log file written by both the UI and the worker so you can diagnose issues quickly.

Whenever you make manual edits to the JSON files make sure the contents stay valid – malformed JSON will be reported in the dashboard logs and the background worker will skip execution until the data is fixed.
