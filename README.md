# SiteLog

QR-code-based site attendance system for Mostlane. Workers scan in/out via their phone; admins view live attendance, timesheets, and PDF reports.

-----

## Architecture

|Layer   |Technology                                                          |
|--------|--------------------------------------------------------------------|
|Frontend|Static HTML/CSS/JS (no build step)                                  |
|API     |Cloudflare Worker (`worker.js`)                                     |
|Database|Cloudflare D1 (SQLite)                                              |
|Maps    |Google Maps Embed API (scan page), Maps JS API + Places (site setup)|

-----

## Environment Variables

Set these in your Cloudflare Worker **Secrets** (via `wrangler secret put` or the dashboard):

|Variable      |Description                                                                                                                                     |
|--------------|------------------------------------------------------------------------------------------------------------------------------------------------|
|`ADMIN_SECRET`|Optional shared secret. If set, all `/admin` GET requests must include the header `x-admin-secret: <value>`. Leave unset in dev to disable auth.|

Bind your D1 database in `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "sitelog"
database_id   = "<your-d1-database-id>"
```

-----

## Database Schema

```sql
CREATE TABLE sites (
  id        TEXT PRIMARY KEY,
  site_name TEXT NOT NULL,
  lat       REAL NOT NULL,
  lng       REAL NOT NULL,
  radius_m  INTEGER NOT NULL DEFAULT 500,
  archived  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE companies (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE site_company_map (
  site_id    TEXT NOT NULL REFERENCES sites(id),
  company_id TEXT NOT NULL REFERENCES companies(id),
  PRIMARY KEY (site_id, company_id)
);

CREATE TABLE people (
  id          TEXT PRIMARY KEY,
  first_name  TEXT,
  last_name   TEXT,
  company     TEXT,
  purpose     TEXT,
  archived    INTEGER NOT NULL DEFAULT 0,
  hourly_rate REAL    NOT NULL DEFAULT 0
);

CREATE TABLE devices (
  device_token TEXT NOT NULL,
  person_id    TEXT NOT NULL REFERENCES people(id)
);

CREATE TABLE visits (
  id           TEXT PRIMARY KEY,
  person_id    TEXT NOT NULL REFERENCES people(id),
  site_code    TEXT NOT NULL,
  check_in_at  TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  check_out_at TEXT,
  lat          REAL,
  lng          REAL,
  accuracy     REAL,
  hs_ack       INTEGER NOT NULL DEFAULT 0,
  auto_checkout INTEGER NOT NULL DEFAULT 0
);
```

-----

## Pages

|File        |Purpose                                                                                                                                    |
|------------|-------------------------------------------------------------------------------------------------------------------------------------------|
|`index.html`|Landing page with demo scan link                                                                                                           |
|`scan.html` |Worker scan page — opened from QR code. Handles check-in, check-out, and first-time registration. Requires `?site=<SITE_NAME>` query param.|
|`sites.html`|Admin: add a new site location on a map                                                                                                    |
|`admin.html`|Admin dashboard: live view, timesheets, PDF export, engineer/company/site management                                                       |

-----

## QR Codes

Each site needs a QR code that points to:

```
https://<your-domain>/scan.html?site=<SITE_NAME>
```

`SITE_NAME` must match the `site_name` value stored in the `sites` table exactly (case-sensitive). Generate QR codes with any standard tool (e.g. qr-code-generator.com) and print/laminate them for site entrance.

-----

## Cron Job (Auto Sign-Out)

The worker includes a `scheduled` handler that runs daily at 04:00 UTC and auto-closes any visits from previous days, setting checkout to 16:00 London time.

Configure in `wrangler.toml`:

```toml
[triggers]
crons = ["0 4 * * *"]
```

-----

## Deployment

```bash
# Install Wrangler
npm install -g wrangler

# Login
wrangler login

# Deploy worker
wrangler deploy

# Set admin secret (optional)
wrangler secret put ADMIN_SECRET
```

Deploy the HTML files to any static host (Cloudflare Pages, S3, etc.).

-----

## Google Maps API Key

The Maps API key in `sites.html` and `scan.html` is a browser key. Restrict it in the [Google Cloud Console](https://console.cloud.google.com/) to:

- **HTTP referrers** — your domain only (e.g. `https://yourdomain.com/*`)
- **APIs** — Maps JavaScript API, Places API, Maps Embed API
