# Rug Checker

A Solana token risk-checker: paste a contract address, get a red/yellow/green
verdict based on liquidity lock, mint/freeze authority, holder concentration,
and transfer fees — pulled live from the GoPlus Security API.

## Why this needs a backend (short version)

GoPlus's API isn't set up to be called directly from a browser (no CORS
headers for arbitrary origins). `api/check.js` is a tiny serverless function
that makes the GoPlus call **from the server**, where CORS doesn't apply, and
hands the result back to the frontend.

## Deploying (Vercel — free)

1. Sign up / log in at vercel.com
2. Click "Add New → Project", connect this GitHub repo, and click Deploy.
   Vercel auto-detects this as a Vite project and the `api/` folder as
   serverless functions — no configuration needed.

## Testing it

Once deployed, paste a real Solana token address into the scanner, e.g.:

- USDC: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` (should come back clean)
- BONK: `DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263`

If GoPlus is unreachable or rate-limits you, the app automatically falls
back to demo data and shows a clear amber banner saying so.

## What's NOT wired up yet

- No true honeypot/sell-simulation — `transfer_fee` is used as an
  approximation.
- Contract age isn't returned by this GoPlus endpoint.
- No rate limiting or caching on `/api/check` yet.
