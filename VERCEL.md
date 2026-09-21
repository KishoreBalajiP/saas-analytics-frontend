# Deploying to Vercel

The frontend is configured for Vercel out of the box.

## Build configuration

`vite.config.ts` pins the Nitro server preset to `vercel`:

```ts
nitro: { preset: "vercel" }
```

`vercel.json` at the repo root sets:

- `buildCommand`: `npm run build`
- `installCommand`: `npm install`
- `outputDirectory`: `.vercel/output` (created by Nitro for the Vercel preset)

## Required environment variables

Set these in **Vercel Project → Settings → Environment Variables**:

| Key | Value | Environments |
|-----|-------|--------------|
| `VITE_API_BASE_URL` | `https://saas-analytics-backend-ffao.onrender.com` | Production |
| `VITE_API_BASE_URL` | `http://localhost:8080` | Preview / Development |
| `VITE_API_PREFIX` | `/api/v1` | All |

## SSR

SSR is fully enabled. TanStack Start renders every route on the server first
then hydrates on the client. There is no client-only mode toggled in this
project.

## Switching platforms

To deploy elsewhere (Netlify, Cloudflare, Node), unset the preset and rely on
Nitro's auto-detection:

```ts
// vite.config.ts
nitro: true  // or omit and set NITRO_PRESET in CI
```

Then provide your platform-specific configuration (e.g. a `netlify.toml` or
`wrangler.toml`).
