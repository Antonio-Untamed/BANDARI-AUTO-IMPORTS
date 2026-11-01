# Bandari Auto Imports

Order, track and clear imported vehicles for Kenya. Next.js (App Router) + PostgreSQL (Drizzle ORM).

- `/` marketing site, KRA CRSP duty estimator, WhatsApp callback requests
- `/vehicles`, `/vehicles/[slug]` inventory + full KRA duty breakdown
- `/vehicles/[slug]/order` reservation → opens a tracking file
- `/track`, `/track/[code]` shipment tracking (8 milestones)
- `/engagements` client engagement wall
- `/admin` staff desk: upload units, edit stock, advance shipments, read callbacks

---

## "This uploader does not yet support projects that require a build process"

**That warning is not a bug in the app — it is the wrong deploy tool for it.**

Cloudflare's drag-and-drop *Upload and deploy* box only accepts **already-built
static files** (HTML/CSS/JS). It does not run `npm install`, does not run
`next build`, and has no Node server. This project needs all three, plus a
PostgreSQL database:

| Requirement | Needed for |
| --- | --- |
| `npm run build` | compiling the Next.js server bundle |
| A Node.js server | server components, API routes, cookies (admin login) |
| PostgreSQL | vehicles, orders, shipment events, engagements, inquiries |
| Writable disk | admin photo uploads (`public/uploads`) |

Uploading `src/`, `drizzle.config.json`, `eslint.config.mjs` etc. will never
work: without compilation your pages would not exist, and the database would be
unreachable. **Do not drag the repo into the static uploader.**

Pick one of the paths below instead. All three serve the exact same codebase.

---

### Option A — Vercel + hosted Postgres (fastest)

1. Create a database (Neon, Supabase or Vercel Postgres) and copy its connection string.
2. Push this repo to GitHub, then **Vercel → Add New → Project → Import**.
3. Vercel auto-detects Next.js — keep the default build command (`npm run build`).
4. Add environment variables:
   - `DATABASE_URL` = your Postgres URL (include `?sslmode=require`)
   - `ADMIN_PASSCODE` = a private passcode for `/admin`
   - `ADMIN_SECRET` = a long random string
5. Deploy, then open `/api/health` (should return `{"ok":true}`).

Tables and demo data are created automatically on the first request — no
migration step needed. The first request after a cold start may take ~1s longer.

> Uploaded photos are written to `public/uploads`, which is **ephemeral** on
> Vercel. For production, paste image URLs in the admin form, or mount object
> storage (S3/R2).

### Option B — Docker on Render / Railway / Fly.io / a VPS (recommended for this app)

The included `Dockerfile` builds the standalone Next server and exposes port 3000.

```bash
docker build -t bandari-autos .
docker run -p 3000:3000 \
  -e DATABASE_URL="postgres://user:pass@host:5432/db" \
  -e ADMIN_PASSCODE="your-passcode" \
  -e ADMIN_SECRET="a-long-random-string" \
  -v bandari-uploads:/app/public/uploads \
  bandari-autos
```

- **Render**: New → Web Service → Docker → add the three env vars → attach a disk at `/app/public/uploads`.
- **Railway / Fly.io**: same idea; the health check is `GET /api/health`.
- **VPS**: run behind Nginx/Caddy with TLS; the container listens on `3000`.

This path keeps uploads on a real filesystem, so the admin photo upload works
exactly as it does locally.

### Option C — Stay on Cloudflare Workers (needs the OpenNext adapter)

Static upload cannot work, but Workers can run the app when it is compiled by
the official adapter. From the project root:

```bash
# 1. Install the adapter + CLI
npm install -D @opennextjs/cloudflare wrangler

# 2. Create the adapter config (open-next.config.ts)
cat > open-next.config.ts <<'EOF'
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
export default defineCloudflareConfig({});
EOF

# 3. Copy the reference Workers config
cp deploy/cloudflare/wrangler.jsonc ./wrangler.jsonc

# 4. Give Workers a Postgres connection pool (Hyperdrive)
npx wrangler hyperdrive create bandari-db \
  --connection-string="postgres://user:pass@host:5432/db?sslmode=require"
# paste the returned id into wrangler.jsonc -> hyperdrive[0].id

# 5. Secrets
npx wrangler secret put DATABASE_URL
npx wrangler secret put ADMIN_PASSCODE
npx wrangler secret put ADMIN_SECRET

# 6. Build and deploy
npx opennextjs-cloudflare build
npx wrangler deploy
```

Notes for Workers:

- `DATABASE_URL` must be a **Hyperdrive** connection string; Workers cannot open
  raw TCP connections to Postgres directly.
- `public/uploads` is not writable. Upload photos via URL, or switch
  `src/app/api/admin/upload/route.ts` to R2/S3 before using the upload button.
- For Git-based deploys, connect the repo in **Workers Builds** and set the
  build command to `npx opennextjs-cloudflare build`, deploy command
  `npx wrangler deploy`.

---

## Local development

```bash
cp .env.example .env          # set DATABASE_URL and ADMIN_PASSCODE
npm install
npm run dev                   # http://localhost:3000
```

Health check: `http://localhost:3000/api/health` → `{"ok":true}`

Validation:

```bash
npx next typegen
npm exec tsc -- --noEmit
npm run build
```

## Import desk (admin)

Open `/admin` (linked as *Staff sign-in* in the footer).

- Default passcode: `bandari2026` — **set `ADMIN_PASSCODE` before going live.**
- Sessions use a signed, httpOnly cookie for 12 hours; every admin API rejects
  unauthenticated requests.

Admin capabilities:

- **Units for sale** — upload a unit with specs, price, KRA CRSP value and photos
  (drag file upload or image URL), publish/edit/delete stock.
- **Shipments** — move an order through the 8 stages and update vessel, voyage,
  bill of lading, ETD/ETA; the client's tracking page updates immediately.
- **Callbacks** — every website request is stored here and pushed to WhatsApp
  (+254 799 007 101), with one-tap reply buttons.

## Contact details

Phone / WhatsApp: **0799 007 101** (`tel:+254799007101`,
`https://wa.me/254799007101`). Change them in one place: `src/lib/site.ts`.

## KRA duty engine

`src/lib/crsp.ts` implements the revised (July 2025) CRSP valuation:

1. Start from the unit's CRSP (new retail value in Kenya).
2. Apply age depreciation (0%, 20%, 30%, 40%, 50%, 55%, 60%, capped at 65%).
3. Compare the depreciated CRSP with the declared CIF value — KRA taxes the **higher**.
4. Import duty 35% (passenger) / 25% (pickup, commercial, EV); excise 20–35% by
   engine band (10% EV/hybrid) on customs value + duty; IDF 3.5%; RDL 2%;
   VAT 16% on the compounded base.

Every vehicle page shows this arithmetic, and the estimator lets clients switch
between the KRA breakdown and the full landed cost. Figures are indicative until
the KRA assessment is raised at Mombasa.
