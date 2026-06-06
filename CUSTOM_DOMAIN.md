# Custom Domain Setup — making device memory durable on iPhones

## Why
Today the site (`mostlane.github.io`) and the API (`sitelog-api.jamie-def.workers.dev`)
are **different domains**. The device cookie the worker sets is therefore a
**third-party cookie**, which Safari blocks — so on iPhones the only thing
remembering a device is browser storage, which iOS can wipe after ~7 days of
no use.

If the site and API live on **one registered domain** (e.g. both under
`mostlane.co.uk`), the cookie becomes **first-party** and Safari keeps it.
That is the single biggest real-world durability win — short of installing the
app or telling staff to avoid Incognito.

> Replace `mostlane.co.uk` below with whatever domain you actually own.

---

## Recommended setup (least code change)

Two subdomains of the same registered domain:

| What            | URL                          | Hosted by                    |
|-----------------|------------------------------|------------------------------|
| The site/pages  | `sitelog.mostlane.co.uk`     | GitHub Pages (or CF Pages)   |
| The API/worker  | `api.mostlane.co.uk`         | Cloudflare Worker            |

Because both end in `mostlane.co.uk`, the browser treats API calls as
**first-party**, so the `ml_did` cookie is sent and kept — including on iOS.

### Step 1 — Put the domain on Cloudflare (if it isn't already)
1. Cloudflare dashboard → **Add a site** → enter `mostlane.co.uk`.
2. Cloudflare gives you two **nameservers**. Set these at your domain registrar
   (where you bought the domain). DNS propagation can take a few hours.

### Step 2 — Give the Worker a custom domain
1. Cloudflare → **Workers & Pages** → your `sitelog-api` worker.
2. **Settings → Domains & Routes → Add → Custom Domain**.
3. Enter `api.mostlane.co.uk` and save. Cloudflare creates the DNS + TLS
   automatically. The worker is now reachable at `https://api.mostlane.co.uk`.

### Step 3 — Point the site at your domain
**If staying on GitHub Pages:**
1. Add a file `docs/CNAME` containing exactly: `sitelog.mostlane.co.uk`
2. GitHub repo → Settings → Pages → set the custom domain to
   `sitelog.mostlane.co.uk` and enable “Enforce HTTPS”.
3. In Cloudflare DNS add a record: `CNAME  sitelog  →  mostlane.github.io`
   (set to **DNS only / grey cloud**, not proxied).

**Or move to Cloudflare Pages (cleaner, optional):**
- Workers & Pages → Create → Pages → connect this GitHub repo →
  build output directory `docs` → add custom domain `sitelog.mostlane.co.uk`.

### Step 4 — Code changes (I can do these once you confirm the domain)
1. **Frontend API base** — change the API URL in every page
   (`admin.html`, `app.html`, `scan.html`, `documents.html`, `sites.html`)
   from `https://sitelog-api.jamie-def.workers.dev` to
   `https://api.mostlane.co.uk`.
2. **Worker cookie** — set the cookie for the whole domain so both subdomains
   share it, and use `SameSite=Lax` (now that it's same-site):
   `ml_did=<token>; Max-Age=63072000; Path=/; Secure; SameSite=Lax; Domain=mostlane.co.uk; HttpOnly`
3. **CORS (optional tightening)** — restrict the worker's
   `Access-Control-Allow-Origin` to `https://sitelog.mostlane.co.uk`.
4. **PWA manifest** (`manifest.json`) — if the site now lives at the root of
   `sitelog.mostlane.co.uk` (not `/SiteLog/`), set `start_url` to `/app.html`
   and `scope` to `/`.

### Step 5 — Things outside the repo
1. **Google Maps API key** — in Google Cloud Console, add
   `https://sitelog.mostlane.co.uk/*` to the key's allowed HTTP referrers
   (keep Maps JavaScript, Places, and Maps Embed APIs enabled).
2. **QR codes** — regenerate them to point at the new address:
   `https://sitelog.mostlane.co.uk/scan.html`
3. **Redeploy the worker** after the cookie change.

---

## Even simpler variant (advanced): one origin, no CORS
Put the API under the *same* subdomain as the site using a path prefix —
e.g. site at `sitelog.mostlane.co.uk` and the worker on the route
`sitelog.mostlane.co.uk/api/*`. Then it's literally same-origin: no CORS at
all, and cookies work with `SameSite=Strict`. This needs the worker to strip
the `/api` prefix from paths, so it's a slightly bigger worker change — happy
to do it if you'd prefer this route.

---

## What this does and doesn't fix
- ✅ Device is remembered across iOS's storage eviction (first-party cookie).
- ✅ One clean branded URL for staff and QR codes.
- ❌ **Incognito** still forgets everything every session — unavoidable, by
  browser design. Staff who want to be remembered should use normal mode or
  install the app to their home screen.
